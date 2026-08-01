const appointmentModel = require('../models/appointmentModel');
const doctorModel = require('../models/doctorModel');
const { serverError, isUniqueViolation } = require('../utils/errors');
const {
  cleanText,
  isValidDate,
  isPastDate,
  currentClinicDateTime,
  normalizeTime,
  sameId,
} = require('../utils/validation');
const {
  isDayOff,
  validateAppointmentSlot,
  availableSlotsForDate,
} = require('../utils/appointmentRules');

// GET /api/appointments/available-slots?doctorId=&date=YYYY-MM-DD
async function getAvailableSlots(req, res) {
  try {
    const doctorId = cleanText(req.query.doctorId);
    const date = cleanText(req.query.date);
    if (!doctorId || !date) {
      return res.status(400).json({ message: 'doctorId and date are required' });
    }
    if (!isValidDate(date) || isPastDate(date)) {
      return res.status(400).json({ message: 'Please choose a valid date that is not in the past' });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    if (isDayOff(date)) {
      return res.status(200).json({ date, slots: [], message: 'Doctor is not available this day' });
    }

    const bookedTimes = await appointmentModel.findBookedTimes(doctorId, date);
    const availableSlots = availableSlotsForDate(date, bookedTimes);

    res.status(200).json({ date, slots: availableSlots });
  } catch (err) {
    return serverError(res, 'Available slot lookup failed', err);
  }
}

// POST /api/appointments/book  (protected -- patient)
async function bookAppointment(req, res) {
  try {
    const doctorId = cleanText(req.body.doctorId);
    const date = cleanText(req.body.date);
    const reason = cleanText(req.body.reason);
    const slotValidation = validateAppointmentSlot(date, req.body.time);

    if (!doctorId || !date || !req.body.time) {
      return res.status(400).json({ message: 'doctorId, date, and time are required' });
    }
    if (!slotValidation.valid) {
      return res.status(400).json({ message: slotValidation.message });
    }
    if (reason.length > 255) {
      return res.status(400).json({ message: 'Reason must be 255 characters or fewer' });
    }

    const doctor = await doctorModel.findById(doctorId);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });

    const clash = await appointmentModel.findConflict(doctorId, date, slotValidation.time);
    if (clash) {
      return res.status(409).json({ message: 'That slot was just taken. Please pick another.' });
    }

    const appointment = await appointmentModel.createAppointment({
      patientId: req.patient.id,
      doctorId,
      date,
      time: slotValidation.time,
      reason,
    });

    res.status(201).json({ message: 'Appointment booked', appointment });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: 'That slot was just taken. Please pick another.' });
    }
    return serverError(res, 'Appointment booking failed', err);
  }
}

// PUT /api/appointments/:id/cancel  (protected -- patient, own appointment only)
async function cancelAppointment(req, res) {
  try {
    const appointment = await appointmentModel.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    if (!sameId(appointment.patientid, req.user.id)) {
      return res.status(403).json({ message: 'You can only cancel your own appointments' });
    }
    if (appointment.status !== 'Scheduled') {
      return res.status(400).json({ message: 'Only scheduled appointments can be cancelled' });
    }

    const updated = await appointmentModel.updateStatus(req.params.id, 'Cancelled');
    res.status(200).json({ message: 'Appointment cancelled', appointment: updated });
  } catch (err) {
    return serverError(res, 'Appointment cancellation failed', err);
  }
}

// PUT /api/appointments/:id/reschedule  (protected -- patient, own appointment only)
async function rescheduleAppointment(req, res) {
  try {
    const date = cleanText(req.body.date);
    const slotValidation = validateAppointmentSlot(date, req.body.time);
    if (!date || !req.body.time) {
      return res.status(400).json({ message: 'New date and time are required' });
    }
    if (!slotValidation.valid) {
      return res.status(400).json({ message: slotValidation.message });
    }

    const appointment = await appointmentModel.findById(req.params.id);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    if (!sameId(appointment.patientid, req.user.id)) {
      return res.status(403).json({ message: 'You can only reschedule your own appointments' });
    }
    if (appointment.status !== 'Scheduled') {
      return res.status(400).json({ message: 'Only scheduled appointments can be rescheduled' });
    }

    const clash = await appointmentModel.findConflict(
      appointment.doctorid,
      date,
      slotValidation.time,
      appointment.appointmentid
    );
    if (clash) {
      return res.status(409).json({ message: 'That slot is already booked. Please pick another.' });
    }

    const updated = await appointmentModel.reschedule(req.params.id, date, slotValidation.time);
    res.status(200).json({ message: 'Appointment rescheduled', appointment: updated });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: 'That slot is already booked. Please pick another.' });
    }
    return serverError(res, 'Appointment rescheduling failed', err);
  }
}

// GET /api/appointments/doctor/:doctorId?date=YYYY-MM-DD  (protected -- doctor/admin)
async function getDoctorSchedule(req, res) {
  try {
    const { doctorId } = req.params;
    const { date } = req.query;

    if (req.user.role === 'doctor' && !sameId(doctorId, req.user.id)) {
      return res.status(403).json({ message: 'You can only view your own schedule' });
    }
    if (date && !isValidDate(date)) {
      return res.status(400).json({ message: 'Date must use the YYYY-MM-DD format' });
    }

    const rows = await appointmentModel.findByDoctorWithPatient(doctorId, date || null);
    const appointments = rows.map((r) => ({
      _id: r.appointmentid,
      date: r.appointmentdate,
      time: (r.appointmenttime || '').toString().slice(0, 5),
      reason: r.reason,
      status: r.status,
      patientId: {
        id: r.patientid,
        firstName: r.patient_firstname,
        lastName: r.patient_lastname,
        phone: r.phone,
      },
    }));

    res.status(200).json({ count: appointments.length, appointments });
  } catch (err) {
    return serverError(res, 'Doctor schedule lookup failed', err);
  }
}

// PUT /api/appointments/:id/status  (protected -- doctor/admin)
async function updateAppointmentStatus(req, res) {
  try {
    const { status } = req.body;
    if (!['Cancelled', 'No-show'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status value' });
    }

    const existing = await appointmentModel.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Appointment not found' });

    if (req.user.role === 'doctor' && !sameId(existing.doctorid, req.user.id)) {
      return res.status(403).json({ message: 'You can only update your own appointments' });
    }
    if (existing.status !== 'Scheduled') {
      return res.status(400).json({ message: 'Only scheduled appointments can be updated' });
    }
    if (status === 'No-show') {
      const current = currentClinicDateTime();
      const appointmentTime = normalizeTime(existing.appointmenttime);
      if (
        existing.appointmentdate > current.date ||
        (existing.appointmentdate === current.date && appointmentTime > current.time)
      ) {
        return res.status(400).json({ message: 'An appointment cannot be marked no-show before its start time' });
      }
    }

    const appointment = await appointmentModel.updateStatus(req.params.id, status);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    res.status(200).json({ message: 'Status updated', appointment });
  } catch (err) {
    return serverError(res, 'Appointment status update failed', err);
  }
}

module.exports = {
  getAvailableSlots,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getDoctorSchedule,
  updateAppointmentStatus,
};

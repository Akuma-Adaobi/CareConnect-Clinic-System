const medicalRecordModel = require('../models/medicalRecordModel');
const appointmentModel = require('../models/appointmentModel');
const auditLogModel = require('../models/auditLogModel');
const { serverError, isUniqueViolation } = require('../utils/errors');
const {
  cleanText,
  currentClinicDateTime,
  normalizeTime,
  sameId,
} = require('../utils/validation');

// POST /api/medical-records  (protected -- doctor, own appointment only)
async function createRecord(req, res) {
  try {
    const appointmentId = cleanText(req.body.appointmentId);
    const diagnosis = cleanText(req.body.diagnosis);
    const prescription = cleanText(req.body.prescription);
    const notes = cleanText(req.body.notes);
    if (!appointmentId || !diagnosis) {
      return res.status(400).json({ message: 'appointmentId and diagnosis are required' });
    }

    const appointment = await appointmentModel.findById(appointmentId);
    if (!appointment) return res.status(404).json({ message: 'Appointment not found' });

    if (!sameId(appointment.doctorid, req.user.id)) {
      return res.status(403).json({ message: 'You can only add records for your own appointments' });
    }
    if (appointment.status !== 'Scheduled') {
      return res.status(400).json({ message: 'Visit notes can only be added to scheduled appointments' });
    }

    const appointmentTime = normalizeTime(appointment.appointmenttime);
    const current = currentClinicDateTime();
    if (
      appointment.appointmentdate > current.date ||
      (appointment.appointmentdate === current.date && appointmentTime > current.time)
    ) {
      return res.status(400).json({ message: 'Visit notes cannot be added before the appointment time' });
    }

    if (diagnosis.length > 2000 || prescription.length > 4000 || notes.length > 8000) {
      return res.status(400).json({ message: 'One or more medical record fields are too long' });
    }

    const existing = await medicalRecordModel.findByAppointmentId(appointmentId);
    if (existing) {
      return res.status(409).json({ message: 'A record already exists for this appointment' });
    }

    const record = await medicalRecordModel.createRecordAndCompleteAppointment({
      patientId: appointment.patientid,
      doctorId: appointment.doctorid,
      appointmentId,
      diagnosis,
      prescription,
      notes,
    });

    res.status(201).json({ message: 'Medical record saved', record });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: 'A record already exists for this appointment' });
    }
    return serverError(res, 'Medical record creation failed', err);
  }
}

// GET /api/medical-records/my  (protected -- patient, own records only)
async function getMyRecords(req, res) {
  try {
    const rows = await medicalRecordModel.findByPatientWithDoctor(req.patient.id);
    await auditLogModel.logAction({
      tableName: 'medical_record',
      recordId: req.patient.id,
      action: 'SELECT',
      performedBy: req.patient.id,
      performedByRole: 'patient',
      details: 'Viewed own medical history',
    });
    const records = rows.map((r) => ({
      _id: r.recordid,
      visitDate: r.visitdate,
      diagnosis: r.diagnosis,
      prescription: r.prescription,
      notes: r.notes,
      doctorId: { firstName: r.doctor_firstname, lastName: r.doctor_lastname },
    }));
    res.status(200).json({ count: records.length, records });
  } catch (err) {
    return serverError(res, 'Medical record lookup failed', err);
  }
}

module.exports = { createRecord, getMyRecords };

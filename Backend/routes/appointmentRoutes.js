const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const {
  getAvailableSlots,
  bookAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getDoctorSchedule,
  updateAppointmentStatus,
} = require('../controllers/appointmentController');

// Patient-facing
router.get('/available-slots', protect, requireRole('patient'), getAvailableSlots);
router.post('/book', protect, requireRole('patient'), bookAppointment);
router.put('/:id/cancel', protect, requireRole('patient'), cancelAppointment);
router.put('/:id/reschedule', protect, requireRole('patient'), rescheduleAppointment);

router.get('/doctor/:doctorId', protect, requireRole('doctor', 'admin'), getDoctorSchedule);
router.put('/:id/status', protect, requireRole('doctor', 'admin'), updateAppointmentStatus);

module.exports = router;

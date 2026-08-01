const express = require('express');
const router = express.Router();
const { protectPatient, requireRole } = require('../middleware/auth');
const {
  registerPatient,
  loginPatient,
  getProfile,
  updateProfile,
  getAppointmentHistory,
} = require('../controllers/patientController');

// Public
router.post('/register', registerPatient);
router.post('/login', loginPatient);

// Protected (require a valid Bearer token)
router.get('/profile', protectPatient, requireRole('patient'), getProfile);
router.put('/profile', protectPatient, requireRole('patient'), updateProfile);
router.get('/appointments', protectPatient, requireRole('patient'), getAppointmentHistory);

module.exports = router;

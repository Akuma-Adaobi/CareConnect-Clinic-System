const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { listDoctors, getDoctorById, loginDoctor, getMyProfile } = require('../controllers/doctorController');

router.get('/', listDoctors);
router.post('/login', loginDoctor);
router.get('/me/profile', protect, requireRole('doctor'), getMyProfile);
router.get('/:id', getDoctorById);

module.exports = router;

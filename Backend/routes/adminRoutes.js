const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { loginAdmin, addDoctor, getReports } = require('../controllers/adminController');

router.post('/login', loginAdmin);
router.post('/doctors', protect, requireRole('admin'), addDoctor);
router.get('/reports', protect, requireRole('admin'), getReports);

module.exports = router;

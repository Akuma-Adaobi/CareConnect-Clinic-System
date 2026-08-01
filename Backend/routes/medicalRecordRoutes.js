const express = require('express');
const router = express.Router();
const { protect, requireRole } = require('../middleware/auth');
const { createRecord, getMyRecords } = require('../controllers/medicalRecordController');

router.post('/', protect, requireRole('doctor'), createRecord);
router.get('/my', protect, requireRole('patient'), getMyRecords);

module.exports = router;

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const adminModel = require('../models/adminModel');
const doctorModel = require('../models/doctorModel');
const appointmentModel = require('../models/appointmentModel');
const auditLogModel = require('../models/auditLogModel');
const { serverError, isUniqueViolation } = require('../utils/errors');
const {
  cleanText,
  normalizeEmail,
  normalizePhone,
  isValidEmail,
  isValidPhone,
  isValidDate,
  currentClinicDateTime,
} = require('../utils/validation');

function generateToken(admin) {
  return jwt.sign(
    { id: admin.adminid, email: admin.email, role: 'admin' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// POST /api/admin/login
async function loginAdmin(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await adminModel.findByEmail(email);
    if (!admin || !admin.passwordhash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordhash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = generateToken(admin);
    res.status(200).json({
      message: 'Login successful',
      token,
      admin: { id: admin.adminid, firstName: admin.firstname, lastName: admin.lastname, email: admin.email },
    });
  } catch (err) {
    return serverError(res, 'Admin login failed', err);
  }
}

// POST /api/admin/doctors  (protected -- admin)
async function addDoctor(req, res) {
  try {
    const firstName = cleanText(req.body.firstName);
    const lastName = cleanText(req.body.lastName);
    const email = normalizeEmail(req.body.email);
    const phone = normalizePhone(req.body.phone);
    const specialization = cleanText(req.body.specialization) || 'General Practice';
    const password = typeof req.body.password === 'string' ? req.body.password : '';

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).json({ message: 'firstName, lastName, email, and password are required' });
    }

    if (firstName.length > 50 || lastName.length > 50 || specialization.length > 50) {
      return res.status(400).json({ message: 'Names and specialty must be 50 characters or fewer' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (phone && !isValidPhone(phone)) {
      return res.status(400).json({ message: 'Phone number must contain 10 to 15 digits' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Temporary password must be at least 8 characters long' });
    }

    const existing = await doctorModel.findByEmail(email);
    if (existing) return res.status(409).json({ message: 'A doctor with this email already exists' });

    const passwordHash = await bcrypt.hash(password, 10);
    const doctor = await doctorModel.createDoctor({
      firstName,
      lastName,
      email,
      phone,
      specialization,
      passwordHash,
    });

    await auditLogModel.logAction({
      tableName: 'doctor',
      recordId: doctor.doctorid,
      action: 'INSERT',
      performedBy: req.user.id,
      performedByRole: 'admin',
      details: `Added doctor ${firstName} ${lastName}`,
    });

    res.status(201).json({
      message: 'Doctor added',
      doctor: {
        id: doctor.doctorid,
        firstName: doctor.firstname,
        lastName: doctor.lastname,
        email: doctor.email,
        specialty: doctor.specialization,
      },
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: 'A doctor with this email already exists' });
    }
    return serverError(res, 'Adding doctor failed', err);
  }
}

// GET /api/admin/reports?from=YYYY-MM-DD&to=YYYY-MM-DD  (protected -- admin)
async function getReports(req, res) {
  try {
    const currentDate = currentClinicDateTime().date;
    const defaultFromDate = new Date(`${currentDate}T12:00:00Z`);
    defaultFromDate.setUTCDate(defaultFromDate.getUTCDate() - 30);

    const to = req.query.to || currentDate;
    const from = req.query.from || defaultFromDate.toISOString().split('T')[0];

    if (!isValidDate(from) || !isValidDate(to)) {
      return res.status(400).json({ message: 'Report dates must use the YYYY-MM-DD format' });
    }
    if (from > to) {
      return res.status(400).json({ message: 'The report start date cannot be after the end date' });
    }

    const [statusCounts, perDay, utilization] = await Promise.all([
      appointmentModel.countByStatus(from, to),
      appointmentModel.countPerDay(from, to),
      appointmentModel.doctorUtilization(from, to),
    ]);

    const summary = { Scheduled: 0, Completed: 0, Cancelled: 0, 'No-show': 0 };
    statusCounts.forEach((row) => {
      summary[row.status] = row.count;
    });

    const totalBooked = summary.Scheduled + summary.Completed + summary['No-show'];
    const noShowRate = totalBooked > 0 ? Math.round((summary['No-show'] / totalBooked) * 1000) / 10 : 0;

    res.status(200).json({
      range: { from, to },
      summary,
      noShowRate,
      appointmentsPerDay: perDay,
      doctorUtilization: utilization.map((d) => ({
        doctorId: d.doctorid,
        name: `Dr. ${d.firstname} ${d.lastname}`,
        total: d.total,
        scheduled: d.scheduled,
        completed: d.completed,
        noShow: d.noshow,
        utilizationRate: d.total > 0 ? Math.round((d.completed / d.total) * 1000) / 10 : 0,
      })),
    });
  } catch (err) {
    return serverError(res, 'Admin report generation failed', err);
  }
}

module.exports = { loginAdmin, addDoctor, getReports };

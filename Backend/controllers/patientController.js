const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const patientModel = require('../models/patientModel');
const appointmentModel = require('../models/appointmentModel');
const { serverError, isUniqueViolation } = require('../utils/errors');
const {
  cleanText,
  normalizeEmail,
  normalizePhone,
  isValidEmail,
  isValidPhone,
  isValidDate,
  isPastDate,
} = require('../utils/validation');

function generateToken(patient) {
  return jwt.sign(
    { id: patient.patientid, email: patient.email, role: 'patient' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// Shapes a db row into what the frontend expects, and strips the password hash
function serializePatient(p) {
  return {
    id: p.patientid,
    firstName: p.firstname,
    lastName: p.lastname,
    email: p.email,
    phone: p.phone,
    dateOfBirth: p.dateofbirth,
    gender: p.gender,
    address: p.address,
  };
}

// POST /api/patients/register
async function registerPatient(req, res) {
  try {
    const firstName = cleanText(req.body.firstName);
    const lastName = cleanText(req.body.lastName);
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const phone = normalizePhone(req.body.phone);
    const dateOfBirth = cleanText(req.body.dateOfBirth);
    const gender = cleanText(req.body.gender);
    const address = cleanText(req.body.address);

    if (!firstName || !lastName || !email || !password || !phone || !dateOfBirth || !gender) {
      return res.status(400).json({ message: 'Please fill in all required fields' });
    }

    if (firstName.length > 50 || lastName.length > 50) {
      return res.status(400).json({ message: 'First and last names must be 50 characters or fewer' });
    }
    if (!isValidEmail(email)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters long' });
    }
    if (!isValidPhone(phone)) {
      return res.status(400).json({ message: 'Phone number must contain 10 to 15 digits' });
    }
    if (!isValidDate(dateOfBirth) || !isPastDate(dateOfBirth)) {
      return res.status(400).json({ message: 'Date of birth must be a valid past date' });
    }
    if (!['Male', 'Female', 'Other'].includes(gender)) {
      return res.status(400).json({ message: 'Please select a valid gender value' });
    }
    if (address.length > 255) {
      return res.status(400).json({ message: 'Address must be 255 characters or fewer' });
    }

    const existing = await patientModel.findByEmail(email);
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const patient = await patientModel.createPatient({
      firstName,
      lastName,
      dateOfBirth,
      gender,
      phone,
      email,
      passwordHash,
      address,
    });

    const token = generateToken(patient);
    res.status(201).json({ message: 'Registration successful', token, patient: serializePatient(patient) });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return res.status(409).json({ message: 'An account with this email already exists' });
    }
    return serverError(res, 'Patient registration failed', err);
  }
}

// POST /api/patients/login
async function loginPatient(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const patient = await patientModel.findByEmail(email);
    if (!patient || !patient.passwordhash) return res.status(401).json({ message: 'Invalid email or password' });

    const isMatch = await bcrypt.compare(password, patient.passwordhash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = generateToken(patient);
    res.status(200).json({ message: 'Login successful', token, patient: serializePatient(patient) });
  } catch (err) {
    return serverError(res, 'Patient login failed', err);
  }
}

// GET /api/patients/profile  (protected)
async function getProfile(req, res) {
  try {
    const patient = await patientModel.findById(req.patient.id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.status(200).json({ patient: serializePatient(patient) });
  } catch (err) {
    return serverError(res, 'Patient profile lookup failed', err);
  }
}

// PUT /api/patients/profile  (protected)
async function updateProfile(req, res) {
  try {
    // maps the camelCase fields the frontend sends to the actual lowercase db columns
    const columnMap = {
      firstName: 'firstname',
      lastName: 'lastname',
      phone: 'phone',
      address: 'address',
      dateOfBirth: 'dateofbirth',
      gender: 'gender',
    };

    const fields = {};
    Object.keys(columnMap).forEach((key) => {
      if (req.body[key] !== undefined) fields[columnMap[key]] = cleanText(req.body[key]);
    });

    if (
      (fields.firstname !== undefined && (!fields.firstname || fields.firstname.length > 50)) ||
      (fields.lastname !== undefined && (!fields.lastname || fields.lastname.length > 50))
    ) {
      return res.status(400).json({ message: 'First and last names are required and limited to 50 characters' });
    }
    if (fields.phone !== undefined) {
      fields.phone = normalizePhone(fields.phone);
      if (!isValidPhone(fields.phone)) {
        return res.status(400).json({ message: 'Phone number must contain 10 to 15 digits' });
      }
    }
    if (
      fields.dateofbirth !== undefined &&
      (!isValidDate(fields.dateofbirth) || !isPastDate(fields.dateofbirth))
    ) {
      return res.status(400).json({ message: 'Date of birth must be a valid past date' });
    }
    if (fields.gender !== undefined && !['Male', 'Female', 'Other'].includes(fields.gender)) {
      return res.status(400).json({ message: 'Please select a valid gender value' });
    }
    if (fields.address !== undefined && fields.address.length > 255) {
      return res.status(400).json({ message: 'Address must be 255 characters or fewer' });
    }

    const patient = await patientModel.updateProfile(req.patient.id, fields);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.status(200).json({ message: 'Profile updated', patient: serializePatient(patient) });
  } catch (err) {
    return serverError(res, 'Patient profile update failed', err);
  }
}

// GET /api/patients/appointments  (protected)
async function getAppointmentHistory(req, res) {
  try {
    const rows = await appointmentModel.findByPatientWithDoctor(req.patient.id);

    const appointments = rows.map((r) => ({
      _id: r.appointmentid,
      date: r.appointmentdate,
      time: (r.appointmenttime || '').toString().slice(0, 5),
      reason: r.reason,
      status: r.status,
      doctorId: {
        id: r.doctorid,
        firstName: r.doctor_firstname,
        lastName: r.doctor_lastname,
      },
    }));

    res.status(200).json({ count: appointments.length, appointments });
  } catch (err) {
    return serverError(res, 'Patient appointment history lookup failed', err);
  }
}

module.exports = {
  registerPatient,
  loginPatient,
  getProfile,
  updateProfile,
  getAppointmentHistory,
};

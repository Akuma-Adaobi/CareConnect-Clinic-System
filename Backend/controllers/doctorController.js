const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const doctorModel = require('../models/doctorModel');
const { serverError } = require('../utils/errors');
const { normalizeEmail } = require('../utils/validation');

function generateToken(doctor) {
  return jwt.sign(
    { id: doctor.doctorid, email: doctor.email, role: 'doctor' },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function serializeDoctor(d) {
  return {
    id: d.doctorid,
    firstName: d.firstname,
    lastName: d.lastname,
    email: d.email,
    phone: d.phone,
    specialty: d.specialization,
  };
}

// GET /api/doctors  (public -- powers the booking dropdown)
async function listDoctors(req, res) {
  try {
    const doctors = await doctorModel.listDoctors();
    res.status(200).json({
      doctors: doctors.map((d) => ({
        _id: d.doctorid,
        firstName: d.firstname,
        lastName: d.lastname,
        specialty: d.specialization,
      })),
    });
  } catch (err) {
    return serverError(res, 'Doctor list lookup failed', err);
  }
}

// GET /api/doctors/:id  (public)
async function getDoctorById(req, res) {
  try {
    const doctor = await doctorModel.findById(req.params.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    res.status(200).json({ doctor: serializeDoctor(doctor) });
  } catch (err) {
    return serverError(res, 'Doctor lookup failed', err);
  }
}

// POST /api/doctors/login
async function loginDoctor(req, res) {
  try {
    const email = normalizeEmail(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const doctor = await doctorModel.findByEmail(email);
    if (!doctor || !doctor.passwordhash) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, doctor.passwordhash);
    if (!isMatch) return res.status(401).json({ message: 'Invalid email or password' });

    const token = generateToken(doctor);
    res.status(200).json({ message: 'Login successful', token, doctor: serializeDoctor(doctor) });
  } catch (err) {
    return serverError(res, 'Doctor login failed', err);
  }
}

// GET /api/doctors/me/profile  (protected -- doctor)
async function getMyProfile(req, res) {
  try {
    const doctor = await doctorModel.findById(req.user.id);
    if (!doctor) return res.status(404).json({ message: 'Doctor not found' });
    res.status(200).json({ doctor: serializeDoctor(doctor) });
  } catch (err) {
    return serverError(res, 'Doctor profile lookup failed', err);
  }
}

module.exports = { listDoctors, getDoctorById, loginDoctor, getMyProfile };

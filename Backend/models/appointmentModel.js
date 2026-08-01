const pool = require('../db');

// TIME columns come back from pg as "HH:MM:SS" strings already -- no parsing needed
async function findBookedTimes(doctorId, date) {
  const result = await pool.query(
    `SELECT appointmenttime FROM appointment
     WHERE doctorid = $1 AND appointmentdate = $2 AND status != 'Cancelled'`,
    [doctorId, date]
  );
  return result.rows.map((r) => r.appointmenttime.slice(0, 5)); // "09:30:00" -> "09:30"
}

async function findConflict(doctorId, date, time, excludeAppointmentId = null) {
  let query = `SELECT appointmentid FROM appointment
    WHERE doctorid = $1 AND appointmentdate = $2 AND appointmenttime = $3 AND status != 'Cancelled'`;
  const params = [doctorId, date, time];

  if (excludeAppointmentId) {
    query += ` AND appointmentid != $4`;
    params.push(excludeAppointmentId);
  }

  const result = await pool.query(query, params);
  return result.rows[0] || null;
}

async function createAppointment({ patientId, doctorId, date, time, reason }) {
  const result = await pool.query(
    `INSERT INTO appointment (patientid, doctorid, appointmentdate, appointmenttime, reason)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [patientId, doctorId, date, time, reason || null]
  );
  return result.rows[0];
}

async function findById(id) {
  const result = await pool.query('SELECT * FROM appointment WHERE appointmentid = $1', [id]);
  return result.rows[0] || null;
}

// JOINs in the doctor's name -- this replaces what .populate('doctorId') did in Mongoose
async function findByPatientWithDoctor(patientId) {
  const result = await pool.query(
    `SELECT a.appointmentid, a.appointmentdate, a.appointmenttime, a.reason, a.status,
            d.doctorid, d.firstname AS doctor_firstname, d.lastname AS doctor_lastname
     FROM appointment a
     JOIN doctor d ON d.doctorid = a.doctorid
     WHERE a.patientid = $1
     ORDER BY a.appointmentdate DESC, a.appointmenttime DESC`,
    [patientId]
  );
  return result.rows;
}

// Same idea in the other direction -- a doctor's day, with patient names attached
async function findByDoctorWithPatient(doctorId, date = null) {
  let query = `
    SELECT a.appointmentid, a.appointmentdate, a.appointmenttime, a.reason, a.status,
           p.patientid, p.firstname AS patient_firstname, p.lastname AS patient_lastname, p.phone
    FROM appointment a
    JOIN patient p ON p.patientid = a.patientid
    WHERE a.doctorid = $1 AND a.status != 'Cancelled'`;
  const params = [doctorId];

  if (date) {
    query += ` AND a.appointmentdate = $2`;
    params.push(date);
  }
  query += ' ORDER BY a.appointmentdate, a.appointmenttime';

  const result = await pool.query(query, params);
  return result.rows;
}

async function updateStatus(id, status) {
  const result = await pool.query(
    `UPDATE appointment SET status = $2 WHERE appointmentid = $1 RETURNING *`,
    [id, status]
  );
  return result.rows[0] || null;
}

async function reschedule(id, date, time) {
  const result = await pool.query(
    `UPDATE appointment SET appointmentdate = $2, appointmenttime = $3
     WHERE appointmentid = $1 RETURNING *`,
    [id, date, time]
  );
  return result.rows[0] || null;
}

// ---- Reporting (used by the admin dashboard) ----

async function countByStatus(fromDate, toDate) {
  const result = await pool.query(
    `SELECT status, COUNT(*)::int AS count
     FROM appointment
     WHERE appointmentdate BETWEEN $1 AND $2
     GROUP BY status`,
    [fromDate, toDate]
  );
  return result.rows;
}

async function countPerDay(fromDate, toDate) {
  const result = await pool.query(
    `SELECT appointmentdate, COUNT(*)::int AS count
     FROM appointment
     WHERE appointmentdate BETWEEN $1 AND $2
     GROUP BY appointmentdate
     ORDER BY appointmentdate`,
    [fromDate, toDate]
  );
  return result.rows;
}

async function doctorUtilization(fromDate, toDate) {
  const result = await pool.query(
    `SELECT d.doctorid, d.firstname, d.lastname,
            COUNT(*) FILTER (WHERE a.status != 'Cancelled')::int AS total,
            COUNT(*) FILTER (WHERE a.status = 'Scheduled')::int AS scheduled,
            COUNT(*) FILTER (WHERE a.status = 'Completed')::int AS completed,
            COUNT(*) FILTER (WHERE a.status = 'No-show')::int AS noshow
     FROM doctor d
     LEFT JOIN appointment a
       ON a.doctorid = d.doctorid AND a.appointmentdate BETWEEN $1 AND $2
     GROUP BY d.doctorid, d.firstname, d.lastname
     ORDER BY d.lastname`,
    [fromDate, toDate]
  );
  return result.rows;
}

module.exports = {
  findBookedTimes,
  findConflict,
  createAppointment,
  findById,
  findByPatientWithDoctor,
  findByDoctorWithPatient,
  updateStatus,
  reschedule,
  countByStatus,
  countPerDay,
  doctorUtilization,
};

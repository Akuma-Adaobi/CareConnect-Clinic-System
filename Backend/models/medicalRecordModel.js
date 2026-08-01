const pool = require('../db');

async function createRecordAndCompleteAppointment({
  patientId,
  doctorId,
  appointmentId,
  diagnosis,
  prescription,
  notes,
}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO medical_record
         (patientid, doctorid, appointmentid, visitdate, diagnosis, prescription, notes)
       VALUES ($1, $2, $3, CURRENT_DATE, $4, $5, $6)
       RETURNING *`,
      [patientId, doctorId, appointmentId, diagnosis, prescription || null, notes || null]
    );
    const record = result.rows[0];

    await client.query(
      `UPDATE appointment
       SET status = 'Completed'
       WHERE appointmentid = $1`,
      [appointmentId]
    );

    await client.query(
      `INSERT INTO audit_log
         (tablename, recordid, action, performedby, performedbyrole, details)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        'medical_record',
        record.recordid,
        'INSERT',
        doctorId,
        'doctor',
        `Visit note for appointment ${appointmentId}`,
      ]
    );

    await client.query('COMMIT');
    return record;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findByAppointmentId(appointmentId) {
  const result = await pool.query('SELECT * FROM medical_record WHERE appointmentid = $1', [appointmentId]);
  return result.rows[0] || null;
}

// JOINs in the doctor's name, same pattern as appointmentModel's history query
async function findByPatientWithDoctor(patientId) {
  const result = await pool.query(
    `SELECT m.recordid, m.visitdate, m.diagnosis, m.prescription, m.notes,
            d.firstname AS doctor_firstname, d.lastname AS doctor_lastname
     FROM medical_record m
     JOIN doctor d ON d.doctorid = m.doctorid
     WHERE m.patientid = $1
     ORDER BY m.visitdate DESC`,
    [patientId]
  );
  return result.rows;
}

module.exports = {
  createRecordAndCompleteAppointment,
  findByAppointmentId,
  findByPatientWithDoctor,
};

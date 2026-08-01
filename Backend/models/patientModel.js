const pool = require('../db');

async function createPatient({ firstName, lastName, dateOfBirth, gender, phone, email, passwordHash, address }) {
  const result = await pool.query(
    `INSERT INTO patient (firstname, lastname, dateofbirth, gender, phone, email, passwordhash, address)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING patientid, firstname, lastname, email, phone, dateofbirth, gender, address`,
    [firstName, lastName, dateOfBirth, gender, phone, email, passwordHash, address || null]
  );
  return result.rows[0];
}

// Includes passwordhash -- only use this one for login, never send it back to the client
async function findByEmail(email) {
  const result = await pool.query('SELECT * FROM patient WHERE LOWER(email) = LOWER($1)', [email]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    `SELECT patientid, firstname, lastname, email, phone, dateofbirth, gender, address
     FROM patient WHERE patientid = $1`,
    [id]
  );
  return result.rows[0] || null;
}

// fields must already use lowercase db column names, e.g. { firstname: 'Ada' }
async function updateProfile(id, fields) {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);

  const setClause = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
  const values = keys.map((key) => fields[key]);

  const result = await pool.query(
    `UPDATE patient SET ${setClause} WHERE patientid = $1
     RETURNING patientid, firstname, lastname, email, phone, dateofbirth, gender, address`,
    [id, ...values]
  );
  return result.rows[0] || null;
}

module.exports = { createPatient, findByEmail, findById, updateProfile };

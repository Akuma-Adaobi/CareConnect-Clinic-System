const pool = require('../db');

async function listDoctors() {
  const result = await pool.query(
    'SELECT doctorid, firstname, lastname, specialization FROM doctor ORDER BY lastname'
  );
  return result.rows;
}

async function findById(id) {
  const result = await pool.query(
    'SELECT doctorid, firstname, lastname, email, phone, specialization FROM doctor WHERE doctorid = $1',
    [id]
  );
  return result.rows[0] || null;
}

// Includes passwordhash -- only use this one for login
async function findByEmail(email) {
  const result = await pool.query('SELECT * FROM doctor WHERE LOWER(email) = LOWER($1)', [email]);
  return result.rows[0] || null;
}

async function createDoctor({ firstName, lastName, email, phone, specialization, passwordHash }) {
  const result = await pool.query(
    `INSERT INTO doctor (firstname, lastname, email, phone, specialization, passwordhash)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING doctorid, firstname, lastname, email, phone, specialization`,
    [firstName, lastName, email, phone || null, specialization || 'General Practice', passwordHash]
  );
  return result.rows[0];
}

module.exports = { listDoctors, findById, findByEmail, createDoctor };

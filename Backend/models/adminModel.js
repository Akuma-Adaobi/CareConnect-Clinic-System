const pool = require('../db');

async function findByEmail(email) {
  const result = await pool.query('SELECT * FROM admin_user WHERE LOWER(email) = LOWER($1)', [email]);
  return result.rows[0] || null;
}

async function findById(id) {
  const result = await pool.query(
    'SELECT adminid, firstname, lastname, email FROM admin_user WHERE adminid = $1',
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { findByEmail, findById };

// Run once with: node Backend/seed/seedAdmin.js
// Creates one manager/admin account so you can log into the Admin dashboard.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

const ADMIN_EMAIL = 'manager@careconnect.test';
const ADMIN_PASSWORD = 'Manager123!';

async function seed() {
  const existing = await pool.query('SELECT adminid FROM admin_user WHERE email = $1', [ADMIN_EMAIL]);
  if (existing.rows.length > 0) {
    console.log('Admin account already exists -- skipping');
    await pool.end();
    return;
  }

  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  await pool.query(
    'INSERT INTO admin_user (firstname, lastname, email, passwordhash) VALUES ($1, $2, $3, $4)',
    ['Clinic', 'Manager', ADMIN_EMAIL, passwordHash]
  );

  console.log(`Admin created -- login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
  await pool.end();
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

// Run once with: node Backend/seed/seedDoctors.js
// Adds 3 test doctors, all with the same test password, so you can test
// login + the booking flow before Admin's "add doctor" form is your only
// way to create one. Safe to run more than once -- skips existing emails.
//
// If you ran the OLD version of this script before migration 002 added
// the passwordhash column, those rows have passwordhash = '' and can't log
// in. Run `DELETE FROM doctor;` first, then re-run this.
require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db');

const TEST_PASSWORD = 'Doctor123!';

const sampleDoctors = [
  { firstName: 'Ifeoma', lastName: 'Nwosu', email: 'ifeoma.nwosu@careconnect.test', specialization: 'General Practice' },
  { firstName: 'Tunde', lastName: 'Bakare', email: 'tunde.bakare@careconnect.test', specialization: 'Pediatrics' },
  { firstName: 'Chinwe', lastName: 'Eze', email: 'chinwe.eze@careconnect.test', specialization: 'Dermatology' },
];

async function seed() {
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 10);

  for (const doc of sampleDoctors) {
    const existing = await pool.query('SELECT doctorid FROM doctor WHERE email = $1', [doc.email]);
    if (existing.rows.length > 0) {
      console.log(`Skipping ${doc.firstName} ${doc.lastName} -- already exists`);
      continue;
    }
    await pool.query(
      'INSERT INTO doctor (firstname, lastname, email, specialization, passwordhash) VALUES ($1, $2, $3, $4, $5)',
      [doc.firstName, doc.lastName, doc.email, doc.specialization, passwordHash]
    );
    console.log(`Added Dr. ${doc.firstName} ${doc.lastName} (login: ${doc.email} / ${TEST_PASSWORD})`);
  }

  await pool.end();
  console.log('Done.');
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});

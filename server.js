require('dotenv').config();
const express = require('express');
const path = require('path');
const app = require('./Backend/app');
const pool = require('./Backend/db');

const missingEnvironment = ['DATABASE_URL', 'JWT_SECRET'].filter((key) => !process.env[key]);
if (missingEnvironment.length > 0) {
  throw new Error(`Missing required environment variables: ${missingEnvironment.join(', ')}`);
}

const port = Number(process.env.PORT || 5000);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535');
}

const staticOptions = {
  dotfiles: 'deny',
  fallthrough: true,
  index: false,
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0,
};

for (const directory of ['patient', 'Doctor', 'Admin', 'Appointment', 'css', 'js']) {
  app.use(
    `/${directory}`,
    express.static(path.join(__dirname, directory), staticOptions)
  );
}

app.get('/', (req, res) => {
  res.redirect('/patient/login.html');
});

app.use('/api', (req, res) => {
  res.status(404).json({ message: 'API endpoint not found' });
});

app.use((req, res) => {
  res.status(404).type('text').send('Page not found');
});

const server = app.listen(port, () => {
  console.log(`CareConnect running at http://localhost:${port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received, shutting down`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

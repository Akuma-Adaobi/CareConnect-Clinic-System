const { Pool, types } = require('pg');
require('dotenv').config();

// Without this, node-postgres returns DATE columns as JS Date objects, which
// get shifted by a day when later formatted in a non-UTC timezone. Keeping
// them as plain 'YYYY-MM-DD' strings avoids that entirely.
types.setTypeParser(1082, (val) => val); // 1082 = the DATE type

const databaseUrl = process.env.DATABASE_URL;
const isLocalDatabase = databaseUrl
  ? /(?:localhost|127\.0\.0\.1)/i.test(databaseUrl)
  : true;
const useSsl = process.env.PGSSL
  ? process.env.PGSSL === 'true'
  : !isLocalDatabase;

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: useSsl ? { rejectUnauthorized: false } : false,
});

pool.on('error', (err) => {
  console.error('Unexpected Postgres pool error:', err.message);
});

module.exports = pool;

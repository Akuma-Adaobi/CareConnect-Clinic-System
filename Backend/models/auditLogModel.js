const pool = require('../db');

async function logAction({ tableName, recordId, action, performedBy, performedByRole, details }) {
  await pool.query(
    `INSERT INTO audit_log (tablename, recordid, action, performedby, performedbyrole, details)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [tableName, recordId, action, performedBy, performedByRole, details || null]
  );
}

module.exports = { logAction };

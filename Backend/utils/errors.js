function serverError(res, context, err) {
  console.error(`${context}:`, err);
  return res.status(500).json({ message: 'An unexpected server error occurred' });
}

function isUniqueViolation(err) {
  return err && err.code === '23505';
}

module.exports = { serverError, isUniqueViolation };

const jwt = require('jsonwebtoken');

// Verifies "Authorization: Bearer <token>" and attaches the decoded payload.
// Sets both req.user (generic, use this in new code) and req.patient
// (kept for the patient controller, which was written against this name).
function protect(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Not authorized, no token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    req.patient = decoded; // backward-compatible alias -- see patientController.js
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Not authorized, token invalid or expired' });
  }
}

// Use after protect() to gate a route to specific roles, e.g.
//   router.get('/schedule', protect, requireRole('doctor', 'admin'), handler)
// Requires the token to have been issued with a `role` field. Patient tokens
// need to include `role: 'patient'` -- see the note in patientController.js.
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Not authorized for this action' });
    }
    next();
  };
}

module.exports = { protect, protectPatient: protect, requireRole };

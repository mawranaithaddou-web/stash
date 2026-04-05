const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');
const User = require('../models/User');

// Verify JWT and attach user to request
exports.protect = asyncHandler(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }
  if (!token) {
    res.status(401);
    throw new Error('Not authorized, no token');
  }
  const decoded = jwt.verify(token, process.env.JWT_SECRET);
  req.user = await User.findById(decoded.id);
  // NEW CODE (Returns 401 Unauthorized)
if (!req.user) {
  return res.status(401).json({ message: 'User not found. Please login again.' });
}
  if (!req.user.isActive) {
    res.status(401);
    throw new Error('Account suspended');
  }
  next();
});

// Role-based access
exports.authorize = (...roles) =>
  (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      res.status(403);
      throw new Error(`Role '${req.user.role}' is not allowed to access this route`);
    }
    next();
  };

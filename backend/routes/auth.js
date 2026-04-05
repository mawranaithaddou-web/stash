const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const { protect } = require('../middleware/auth');

// Helper: send token response
const sendToken = (user, statusCode, res) => {
  const token = user.getSignedJwtToken();
  res.status(statusCode).json({
    success: true,
    token,
    user: {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
    },
  });
};

// @POST /api/auth/register
router.post('/register', asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    res.status(400); throw new Error('Please provide name, email and password');
  }
  const exists = await User.findOne({ email });
  if (exists) { res.status(400); throw new Error('Email already registered'); }

  const allowedRoles = ['buyer', 'vendor','delivery'];
  const userRole = allowedRoles.includes(role) ? role : 'buyer';
  const user = await User.create({ name, email, password, role: userRole });
  sendToken(user, 201, res);
}));

// @POST /api/auth/login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) { res.status(400); throw new Error('Please provide email and password'); }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    res.status(401); throw new Error('Invalid credentials');
  }
  sendToken(user, 200, res);
}));

// @GET /api/auth/me
router.get('/me', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  let vendorProfile = null;
  if (user.role === 'vendor') {
    vendorProfile = await Vendor.findOne({ user: user._id });
  }
  res.json({ success: true, user, vendorProfile });
}));

// @PUT /api/auth/updatepassword
router.put('/updatepassword', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  const { currentPassword, newPassword } = req.body;
  if (!(await user.matchPassword(currentPassword))) {
    res.status(401); throw new Error('Current password incorrect');
  }
  user.password = newPassword;
  await user.save();
  sendToken(user, 200, res);
}));

module.exports = router;

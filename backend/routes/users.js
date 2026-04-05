const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');
const { uploadAvatar } = require('../middleware/upload');

// @GET /api/users/profile
router.get('/profile', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('wishlist', 'name thumbnail price rating');
  res.json({ success: true, user });
}));

// @PUT /api/users/profile
router.put('/profile', protect, asyncHandler(async (req, res) => {
  const fields = ['name', 'phone', 'address'];
  const updates = {};
  fields.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
  res.json({ success: true, user });
}));

// @POST /api/users/avatar
router.post('/avatar', protect, uploadAvatar, asyncHandler(async (req, res) => {
  if (!req.file) { res.status(400); throw new Error('Please upload an image'); }
  const user = await User.findByIdAndUpdate(req.user._id, { avatar: req.file.path }, { new: true });
  res.json({ success: true, avatar: user.avatar });
}));

// @POST /api/users/wishlist/:productId
router.post('/wishlist/:productId', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);
  const pid = req.params.productId;
  const idx = user.wishlist.indexOf(pid);
  if (idx === -1) {
    user.wishlist.push(pid);
  } else {
    user.wishlist.splice(idx, 1);
  }
  await user.save();
  res.json({ success: true, wishlist: user.wishlist });
}));

// @GET /api/users/wishlist
router.get('/wishlist', protect, asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id)
    .populate({ path: 'wishlist', populate: { path: 'vendor', select: 'storeName' } });
  res.json({ success: true, wishlist: user.wishlist });
}));

module.exports = router;

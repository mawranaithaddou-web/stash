const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Newsletter = require('../models/Newsletter');

// @POST /api/newsletter/subscribe
router.post('/subscribe', asyncHandler(async (req, res) => {
  const { email } = req.body;
  if (!email) { res.status(400); throw new Error('Email is required'); }
  const exists = await Newsletter.findOne({ email });
  if (exists) {
    if (!exists.isActive) {
      exists.isActive = true;
      await exists.save();
      return res.json({ success: true, message: 'Resubscribed successfully!' });
    }
    return res.json({ success: true, message: 'Already subscribed!' });
  }
  await Newsletter.create({ email });
  res.status(201).json({ success: true, message: 'Subscribed successfully!' });
}));

// @POST /api/newsletter/unsubscribe
router.post('/unsubscribe', asyncHandler(async (req, res) => {
  const { email } = req.body;
  await Newsletter.findOneAndUpdate({ email }, { isActive: false });
  res.json({ success: true, message: 'Unsubscribed' });
}));

module.exports = router;

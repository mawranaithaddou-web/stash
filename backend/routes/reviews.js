const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect } = require('../middleware/auth');

// @POST /api/reviews/:productId
router.post('/:productId', protect, asyncHandler(async (req, res) => {
  const { rating, comment } = req.body;
  if (!rating || !comment) { res.status(400); throw new Error('Rating and comment required'); }

  const product = await Product.findById(req.params.productId);
  if (!product) { res.status(404); throw new Error('Product not found'); }

  // Check buyer purchased the product
  const purchased = await Order.findOne({
    buyer: req.user._id,
    'vendorOrders.items.product': product._id,
    paymentStatus: 'paid',
  });
  if (!purchased) {
    res.status(403); throw new Error('You can only review products you have purchased');
  }

  // Check if already reviewed
  const already = product.reviews.find(r => r.user.toString() === req.user._id.toString());
  if (already) { res.status(400); throw new Error('You have already reviewed this product'); }

  product.reviews.push({ user: req.user._id, name: req.user.name, rating: Number(rating), comment });
  product.updateRating();
  await product.save();
  res.status(201).json({ success: true, message: 'Review added' });
}));

// @DELETE /api/reviews/:productId/:reviewId
router.delete('/:productId/:reviewId', protect, asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.productId);
  if (!product) { res.status(404); throw new Error('Product not found'); }

  const review = product.reviews.id(req.params.reviewId);
  if (!review) { res.status(404); throw new Error('Review not found'); }

  if (review.user.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    res.status(403); throw new Error('Not authorized');
  }
  review.remove();
  product.updateRating();
  await product.save();
  res.json({ success: true, message: 'Review removed' });
}));

module.exports = router;

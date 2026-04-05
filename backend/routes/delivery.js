const express = require('express');
const router  = express.Router();
const asyncHandler = require('express-async-handler');
const Order   = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');

// All delivery routes require login + delivery role
// Make sure your auth middleware supports role: 'delivery'
// If you use a simpler guard, replace authorize('delivery') with your own check.

// ─────────────────────────────────────────────────────────────────
// GET /api/delivery/orders
// Returns orders that are confirmed (ready to ship) or already
// shipped (in-transit). Delivery person sees their queue.
// ─────────────────────────────────────────────────────────────────
router.get('/orders', protect, authorize('delivery'), asyncHandler(async (req, res) => {
  const { status } = req.query; // optional filter: 'confirmed' | 'shipped' | 'delivered'

  const query = {};
  if (status) {
    query.status = status;
  } else {
    // Default: show confirmed + shipped (active deliveries)
    query.status = { $in: ['confirmed', 'shipped'] };
  }

  const orders = await Order.find(query)
    .populate('buyer', 'name email phone')
    .populate('vendorOrders.vendor', 'storeName')
    .sort('-createdAt');

  res.json({ success: true, orders });
}));

// ─────────────────────────────────────────────────────────────────
// GET /api/delivery/orders/:id
// Single order detail for delivery person
// ─────────────────────────────────────────────────────────────────
router.get('/orders/:id', protect, authorize('delivery'), asyncHandler(async (req, res) => {
  // 1. Fetch Order
  const order = await Order.findById(req.params.id)
    .populate('buyer', 'name email') // Get Buyer Name
    .populate('vendorOrders.vendor', 'storeName logo'); // Get Vendor Names

  if (!order) {
    res.status(404);
    throw new Error('Order not found');
  }

  // 2. No need to deeply populate items because your schema 
  // stores 'name', 'price', 'thumbnail' directly in the order (denormalized).
  // This is actually better for performance!

  res.json({ success: true, order });
}));

// ─────────────────────────────────────────────────────────────────
// PUT /api/delivery/orders/:id/status
// Delivery person updates status to 'shipped' or 'delivered'
// Body: { status, estimatedDelivery?, deliveryNotes? }
//   - status: 'shipped' | 'delivered'
//   - estimatedDelivery: ISO date string (required when shipping)
//   - deliveryNotes: optional free text
// ─────────────────────────────────────────────────────────────────
router.put('/orders/:id/status', protect, authorize('delivery'), asyncHandler(async (req, res) => {
  const { status, estimatedDelivery, deliveryNotes } = req.body;

  if (!['shipped', 'delivered'].includes(status)) {
    res.status(400);
    throw new Error("Status must be 'shipped' or 'delivered'");
  }

  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error('Order not found'); }

  // Can only act on confirmed or shipped orders
  if (!['confirmed', 'shipped'].includes(order.status)) {
    res.status(400);
    throw new Error(`Cannot update a ${order.status} order`);
  }

  // ── Apply status ────────────────────────────────────────────
  order.status = status;
  order.deliveryPerson = req.user._id;
  if (deliveryNotes !== undefined) order.deliveryNotes = deliveryNotes;

  if (status === 'shipped') {
    order.shippedAt = new Date();
    if (!estimatedDelivery) {
      res.status(400);
      throw new Error('Estimated delivery date is required when marking as shipped');
    }
    order.estimatedDelivery = new Date(estimatedDelivery);
    // Sync all vendor sub-orders to shipped
    order.vendorOrders.forEach(vo => {
      if (vo.status !== 'cancelled') {
        vo.status = 'shipped';
        vo.shippedAt = new Date();
      }
    });
  }

  if (status === 'delivered') {
    order.deliveredAt = new Date();
    // Sync all vendor sub-orders to delivered
    order.vendorOrders.forEach(vo => {
      if (vo.status !== 'cancelled') {
        vo.status    = 'delivered';
        vo.deliveredAt = new Date();
      }
    });

    // ── COD: automatically mark payment as paid on delivery ──
    if (order.paymentMethod === 'cod') {
      order.paymentStatus = 'paid';
    }
  }

  await order.save();

  res.json({
    success: true,
    message: status === 'delivered'
      ? 'Order delivered. ' + (order.paymentMethod === 'cod' ? 'COD payment collected.' : '')
      : `Order marked as shipped. Estimated delivery: ${order.estimatedDelivery?.toDateString()}`,
    order,
  });
}));

module.exports = router;

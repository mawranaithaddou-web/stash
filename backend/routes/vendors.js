const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Vendor = require('../models/Vendor');
const User = require('../models/User');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');
const { uploadVendorLogo } = require('../middleware/upload');

// @POST /api/vendors/apply — Register as vendor
router.post('/apply', protect, asyncHandler(async (req, res) => {
  const existing = await Vendor.findOne({ user: req.user._id });
  if (existing) { res.status(400); throw new Error('You already have a vendor profile'); }

  const { storeName, description, contactEmail, contactPhone, address, social } = req.body;
  const vendor = await Vendor.create({
    user: req.user._id,
    storeName,
    description,
    contactEmail: contactEmail || req.user.email,
    contactPhone,
    address,
    social,
    status: 'pending',
  });
  // Update user role to vendor
  await User.findByIdAndUpdate(req.user._id, { role: 'vendor' });
  res.status(201).json({ success: true, vendor });
}));

// @GET /api/vendors — Public: list all approved vendors
router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, limit = 12, search } = req.query;
  const query = { status: 'approved' };
  if (search) query.storeName = { $regex: search, $options: 'i' };

  const vendors = await Vendor.find(query)
    .populate('user', 'name avatar')
    .sort('-totalSales')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Vendor.countDocuments(query);
  res.json({ success: true, vendors, total, pages: Math.ceil(total / limit) });
}));

// @GET /api/vendors/my — Vendor: get own profile
router.get('/my', protect, authorize('vendor', 'admin'), asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id }).populate('user', 'name email avatar');
  if (!vendor) { res.status(404); throw new Error('Vendor profile not found'); }
  res.json({ success: true, vendor });
}));

// @PUT /api/vendors/my — Vendor: update own profile
router.put('/my', protect, authorize('vendor', 'admin'), asyncHandler(async (req, res) => {
  const allowed = ['description', 'contactEmail', 'contactPhone', 'address', 'social'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });
  const vendor = await Vendor.findOneAndUpdate({ user: req.user._id }, updates, { new: true, runValidators: true });
  res.json({ success: true, vendor });
}));

// @POST /api/vendors/my/logo — Upload logo/banner
router.post('/my/logo', protect, authorize('vendor'), uploadVendorLogo, asyncHandler(async (req, res) => {
  const updates = {};
  if (req.files?.logo) updates.logo = req.files.logo[0].path;
  if (req.files?.banner) updates.banner = req.files.banner[0].path;
  const vendor = await Vendor.findOneAndUpdate({ user: req.user._id }, updates, { new: true });
  res.json({ success: true, vendor });
}));

// In backend/routes/users.js
router.get('/notifications', protect, asyncHandler(async (req, res) => {
  const notifications = await Notification.find({ recipient: req.user._id })
    .sort({ createdAt: -1 });
  res.json(notifications);
}));
// @GET /api/vendors/my/dashboard — Vendor analytics
router.get('/my/dashboard', protect, authorize('vendor'), asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor) { res.status(404); throw new Error('Vendor not found'); }

  const totalProducts = await Product.countDocuments({ vendor: vendor._id });
  const activeProducts = await Product.countDocuments({ vendor: vendor._id, isActive: true });

  // Orders involving this vendor
  const orders = await Order.find({ 'vendorOrders.vendor': vendor._id });
  const vendorOrders = orders.flatMap(o =>
    o.vendorOrders.filter(vo => vo.vendor.toString() === vendor._id.toString())
  );

  const totalOrders = vendorOrders.length;
  const pendingOrders = vendorOrders.filter(vo => vo.status === 'pending').length;
  const revenue = vendorOrders
    .filter(vo => ['delivered', 'shipped'].includes(vo.status))
    .reduce((sum, vo) => sum + (vo.vendorEarnings || 0), 0);

  // Monthly revenue (last 6 months)
  const monthlyRevenue = {};
  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString('default', { month: 'short', year: '2-digit' });
    monthlyRevenue[key] = 0;
  }
  orders.forEach(order => {
    const key = new Date(order.createdAt).toLocaleString('default', { month: 'short', year: '2-digit' });
    if (key in monthlyRevenue) {
      order.vendorOrders
        .filter(vo => vo.vendor.toString() === vendor._id.toString())
        .forEach(vo => { monthlyRevenue[key] += vo.vendorEarnings || 0; });
    }
  });

  res.json({
    success: true,
    stats: { totalProducts, activeProducts, totalOrders, pendingOrders, revenue, rating: vendor.rating },
    monthlyRevenue,
  });
}));

// @GET /api/vendors/my/orders — Vendor orders
router.get('/my/orders', protect, authorize('vendor'), asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  const { status, page = 1, limit = 20 } = req.query;

  const match = { 'vendorOrders.vendor': vendor._id };
  const orders = await Order.find(match)
    .populate('buyer', 'name email')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));

  // Filter vendorOrders to only this vendor
  const filtered = orders.map(order => ({
    ...order.toObject(),
    vendorOrders: order.vendorOrders.filter(
      vo => vo.vendor.toString() === vendor._id.toString() &&
        (!status || vo.status === status)
    ),
  })).filter(o => o.vendorOrders.length > 0);

  res.json({ success: true, orders: filtered });
}));

// @PUT /api/vendors/my/orders/:orderId/status — Update vendor order status
router.put('/my/orders/:orderId/status', protect, authorize('vendor'), asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  const order = await Order.findById(req.params.orderId);
  if (!order) { res.status(404); throw new Error('Order not found'); }

  const vendorOrder = order.vendorOrders.find(
    vo => vo.vendor.toString() === vendor._id.toString()
  );
  if (!vendorOrder) { res.status(403); throw new Error('Not your order'); }

  vendorOrder.status = req.body.status;
  if (req.body.trackingNumber) vendorOrder.trackingNumber = req.body.trackingNumber;
  if (req.body.status === 'shipped') vendorOrder.shippedAt = new Date();
  if (req.body.status === 'delivered') vendorOrder.deliveredAt = new Date();
  await order.save();
  res.json({ success: true, order });
}));

// @GET /api/vendors/:slug — Public: vendor store page
router.get('/:slug', asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ slug: req.params.slug, status: 'approved' })
    .populate('user', 'name');
  if (!vendor) { res.status(404); throw new Error('Vendor not found'); }

  const products = await Product.find({ vendor: vendor._id, isActive: true, status: 'published' })
    .populate('category', 'name');
  res.json({ success: true, vendor, products });
}));

module.exports = router;

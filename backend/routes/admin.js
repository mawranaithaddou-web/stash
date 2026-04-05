const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Product = require('../models/Product');
const Order = require('../models/Order');
const { protect, authorize } = require('../middleware/auth');

const Notification = require('../models/Notification'); // Ensure you created this model

// All admin routes require admin role
router.use(protect, authorize('admin'));

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
router.get('/dashboard', asyncHandler(async (req, res) => {
  const [totalUsers, totalVendors, totalProducts, totalOrders] = await Promise.all([
    User.countDocuments(),
    Vendor.countDocuments({ status: 'approved' }),
    Product.countDocuments({ isActive: true }),
    Order.countDocuments(),
  ]);

  const revenueResult = await Order.aggregate([
    { $match: { paymentStatus: 'paid' } },
    { $group: { _id: null, total: { $sum: '$totalAmount' } } },
  ]);
  const totalRevenue = revenueResult[0]?.total || 0;

  const pendingVendors = await Vendor.countDocuments({ status: 'pending' });
  const recentOrders = await Order.find({ paymentStatus: 'paid' })
    .populate('buyer', 'name email')
    .sort('-createdAt')
    .limit(10);

  // Monthly revenue (last 6 months)
  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
  sixMonthsAgo.setDate(1);
  const monthlyRevenue = await Order.aggregate([
    { $match: { paymentStatus: 'paid', createdAt: { $gte: sixMonthsAgo } } },
    {
      $group: {
        _id: { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } },
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { '_id.year': 1, '_id.month': 1 } },
  ]);

  res.json({
    success: true,
    stats: { totalUsers, totalVendors, totalProducts, totalOrders, totalRevenue, pendingVendors },
    recentOrders,
    monthlyRevenue,
  });
}));

router.post('/notify-vendor', asyncHandler(async (req, res) => {
  const { vendorId, title, message } = req.body;

  if (!vendorId || !title || !message) {
    res.status(400);
    throw new Error('Please provide vendorId, title, and message');
  }

  const notification = await Notification.create({
    recipient: vendorId,
    sender: req.user._id, // req.user comes from the 'protect' middleware
    title,
    message
  });

  res.status(201).json({ 
    success: true, 
    message: 'Notification sent successfully',
    data: notification 
  });
}));

// ─── Vendor Management ────────────────────────────────────────────────────────
router.get('/vendors', asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = status ? { status } : {};
  const vendors = await Vendor.find(query)
    .populate('user', 'name email createdAt')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Vendor.countDocuments(query);
  res.json({ success: true, vendors, total, pages: Math.ceil(total / limit) });
}));

router.put('/vendors/:id/status', asyncHandler(async (req, res) => {
  const { status } = req.body;
  if (!['approved', 'suspended', 'pending'].includes(status)) {
    res.status(400); throw new Error('Invalid status');
  }
  const vendor = await Vendor.findByIdAndUpdate(req.params.id, { status }, { new: true })
    .populate('user', 'name email');
  if (!vendor) { res.status(404); throw new Error('Vendor not found'); }
  res.json({ success: true, vendor });
}));

// ─── User Management ──────────────────────────────────────────────────────────
router.get('/users', asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 20, search } = req.query;
  const query = {};
  if (role) query.role = role;
  if (search) query.$or = [
    { name: { $regex: search, $options: 'i' } },
    { email: { $regex: search, $options: 'i' } },
  ];
  const users = await User.find(query)
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await User.countDocuments(query);
  res.json({ success: true, users, total, pages: Math.ceil(total / limit) });
}));

router.put('/users/:id/status', asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id, { isActive: req.body.isActive }, { new: true }
  );
  if (!user) { res.status(404); throw new Error('User not found'); }
  res.json({ success: true, user });
}));

// ─── Product Management ───────────────────────────────────────────────────────
router.get('/products', asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = status ? { status } : {};
  const products = await Product.find(query)
    .populate('vendor', 'storeName')
    .populate('category', 'name')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Product.countDocuments(query);
  res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
}));

const SiteConfig = require('../models/SiteConfig');

// Helper to get a config value or default
const getConfigValue = async (key, defaultValue) => {
  const config = await SiteConfig.findOne({ key });
  return config ? config.value : defaultValue;
};

// Helper to set a config value
const setConfigValue = async (key, value) => {
  await SiteConfig.findOneAndUpdate({ key }, { value }, { upsert: true, new: true });
};

// GET /api/admin/content
router.get('/content', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const content = {
    heroTitle: await getConfigValue('hero_title', 'Discover<br><em>Thousands</em> of<br>Curated Products'),
    heroSubtitle: await getConfigValue('hero_subtitle', 'Shop from hundreds of independent vendors.'),
    promoTitle: await getConfigValue('promo_title', 'Up to <em>40% Off</em>'),
    promoSubtitle: await getConfigValue('promo_subtitle', 'On selected electronics and fashion items this week only.'),
    contactAddress: await getConfigValue('contact_address', '419 State 414 Rte, New York'),
    contactPhone: await getConfigValue('contact_phone', '(607) 936-8058'),
    contactEmail: await getConfigValue('contact_email', 'hello@anon.com'),
  };
  res.json({ success: true, content });
}));

// PUT /api/admin/content
router.put('/content', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const updates = req.body;
  
  for (const [key, value] of Object.entries(updates)) {
    await setConfigValue(key, value);
  }
  
  res.json({ success: true, message: 'Content updated successfully' });
}));

// This route handles the "Active/Hidden" button in your Admin Dashboard
router.put('/products/:id/status', asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  
  const product = await Product.findByIdAndUpdate(
    req.params.id, 
    { isActive: isActive }, 
    { new: true }
  );

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.json({ success: true, product });
}));
router.put('/products/:id/featured', asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(
    req.params.id, { isFeatured: req.body.isFeatured }, { new: true }
  );
  res.json({ success: true, product });
}));

// ─── Order Management ─────────────────────────────────────────────────────────
router.get('/orders', asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const query = status ? { status } : {};
  const orders = await Order.find(query)
    .populate('buyer', 'name email')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Order.countDocuments(query);
  res.json({ success: true, orders, total, pages: Math.ceil(total / limit) });
}));


module.exports = router;

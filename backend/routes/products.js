const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { protect, authorize } = require('../middleware/auth');
const { uploadProductImages, uploadToFirebase } = require('../middleware/upload');

// @GET /api/products — Public: list/search products
router.get('/', asyncHandler(async (req, res) => {
  const { q, category, vendor, minPrice, maxPrice, rating, featured, sort, page = 1, limit = 16 } = req.query;

  const query = { isActive: true, status: 'published' };
  if (q) query.$text = { $search: q };
  if (category) query.category = category;
  if (vendor) query.vendor = vendor;
  if (featured === 'true') query.isFeatured = true;
  if (minPrice || maxPrice) {
    query.price = {};
    if (minPrice) query.price.$gte = Number(minPrice);
    if (maxPrice) query.price.$lte = Number(maxPrice);
  }
  if (rating) query.rating = { $gte: Number(rating) };

  const sortMap = {
    newest: '-createdAt',
    price_asc: 'price',
    price_desc: '-price',
    rating: '-rating',
    popular: '-sold',
  };
  const sortBy = sortMap[sort] || '-createdAt';

  const total = await Product.countDocuments(query);
  const products = await Product.find(query)
    .populate('vendor', 'storeName slug logo')
    .populate('category', 'name slug')
    .sort(sortBy)
    .skip((page - 1) * limit)
    .limit(Number(limit))
    .select('-reviews -description');

  res.json({ success: true, products, total, pages: Math.ceil(total / limit), page: Number(page) });
}));

// @GET /api/products/featured
router.get('/featured', asyncHandler(async (req, res) => {
  const products = await Product.find({ isFeatured: true, isActive: true, status: 'published' })
    .populate('vendor', 'storeName slug')
    .populate('category', 'name')
    .limit(12)
    .select('-reviews');
  res.json({ success: true, products });
}));

// @GET /api/products/:id — Public: single product
router.get('/:id', asyncHandler(async (req, res) => {
  const product = await Product.findOne({
    $or: [{ _id: req.params.id.match(/^[0-9a-fA-F]{24}$/) ? req.params.id : null }, { slug: req.params.id }],
    isActive: true,
  })
    .populate('vendor', 'storeName slug logo rating numReviews')
    .populate('category', 'name slug')
    .populate('reviews.user', 'name avatar');

  if (!product) { res.status(404); throw new Error('Product not found'); }
  res.json({ success: true, product });
}));

// @POST /api/products — Vendor: create product
// @POST /api/products — Vendor: create product
router.post('/', protect, authorize('vendor', 'admin'), uploadProductImages, asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  if (!vendor || vendor.status !== 'approved') {
    res.status(403); throw new Error('Your vendor account must be approved to list products');
  }

  // --- NEW FIREBASE LOGIC START ---
  let images = [];
  if (req.files && req.files.length > 0) {
    // Loop through each file and upload to Firebase folder 'products'
    images = await Promise.all(
      req.files.map(file => uploadToFirebase(file, 'products'))
    );
  }
  // --- NEW FIREBASE LOGIC END ---

  const productData = {
    ...req.body,
    vendor: vendor._id,
    images,
    thumbnail: images[0] || '',
    tags: req.body.tags ? req.body.tags.split(',').map(t => t.trim()) : [],
  };

  // Parse JSON fields
  ['attributes', 'variants'].forEach(field => {
    if (typeof productData[field] === 'string') {
      try { productData[field] = JSON.parse(productData[field]); } catch { delete productData[field]; }
    }
  });

  const product = await Product.create(productData);
  res.status(201).json({ success: true, product });
}));

// @PUT /api/products/:id — Vendor: update own product
// @PUT /api/products/:id — Vendor: update own product
router.put('/:id', protect, authorize('vendor', 'admin'), uploadProductImages, asyncHandler(async (req, res) => {
  let product = await Product.findById(req.params.id).populate('vendor');
  if (!product) { res.status(404); throw new Error('Product not found'); }

  // Check ownership
  if (req.user.role !== 'admin') {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (product.vendor._id.toString() !== vendor._id.toString()) {
      res.status(403); throw new Error('Not authorized to edit this product');
    }
  }

  const updates = { ...req.body };

  // --- NEW FIREBASE LOGIC START ---
  if (req.files && req.files.length > 0) {
    const newImages = await Promise.all(
      req.files.map(file => uploadToFirebase(file, 'products'))
    );
    updates.images = newImages; 
    updates.thumbnail = newImages[0];
  }
  // --- NEW FIREBASE LOGIC END ---

  if (updates.tags && typeof updates.tags === 'string') {
    updates.tags = updates.tags.split(',').map(t => t.trim());
  }

  product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  res.json({ success: true, product });
}));

// @DELETE /api/products/:id
router.delete('/:id', protect, authorize('vendor', 'admin'), asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id).populate('vendor');
  if (!product) { res.status(404); throw new Error('Product not found'); }

  if (req.user.role !== 'admin') {
    const vendor = await Vendor.findOne({ user: req.user._id });
    if (product.vendor._id.toString() !== vendor._id.toString()) {
      res.status(403); throw new Error('Not authorized');
    }
  }
  // Soft delete
  product.isActive = false;
  product.status = 'archived';
  await product.save();
  res.json({ success: true, message: 'Product removed' });
}));

// @GET /api/products/vendor/my — Vendor: list own products
router.get('/vendor/my', protect, authorize('vendor'), asyncHandler(async (req, res) => {
  const vendor = await Vendor.findOne({ user: req.user._id });
  const { status, page = 1, limit = 20 } = req.query;
  const query = { vendor: vendor._id };
  if (status) query.status = status;

  const products = await Product.find(query)
    .populate('category', 'name')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Product.countDocuments(query);
  res.json({ success: true, products, total, pages: Math.ceil(total / limit) });
}));

module.exports = router;

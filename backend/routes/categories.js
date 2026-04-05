const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Category = require('../models/Category');
const { protect, authorize } = require('../middleware/auth');
const { uploadCategoryImage } = require('../middleware/upload');

// @GET /api/categories
router.get('/', asyncHandler(async (req, res) => {
  const categories = await Category.find({ parent: null, isActive: true })
    .populate({ path: 'subcategories', match: { isActive: true } })
    .sort('order name');
  res.json({ success: true, categories });
}));

// @GET /api/categories/:slug
router.get('/:slug', asyncHandler(async (req, res) => {
  const category = await Category.findOne({ slug: req.params.slug, isActive: true })
    .populate({ path: 'subcategories', match: { isActive: true } });
  if (!category) { res.status(404); throw new Error('Category not found'); }
  res.json({ success: true, category });
}));

// @POST /api/categories — Admin only
router.post('/', protect, authorize('admin'), uploadCategoryImage, asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = req.file.path;
  const category = await Category.create(data);
  res.status(201).json({ success: true, category });
}));

// @PUT /api/categories/:id — Admin only
router.put('/:id', protect, authorize('admin'), uploadCategoryImage, asyncHandler(async (req, res) => {
  const data = { ...req.body };
  if (req.file) data.image = req.file.path;
  const category = await Category.findByIdAndUpdate(req.params.id, data, { new: true });
  if (!category) { res.status(404); throw new Error('Category not found'); }
  res.json({ success: true, category });
}));

// @DELETE /api/categories/:id — Admin only
router.delete('/:id', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const category = await Category.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
  if (!category) { res.status(404); throw new Error('Category not found'); }
  res.json({ success: true, message: 'Category deactivated' });
}));

module.exports = router;

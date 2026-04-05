const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { protect } = require('../middleware/auth');

// @GET /api/cart
router.get('/', protect, asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id })
    .populate({ path: 'items.product', select: 'name thumbnail price stock isActive' })
    .populate({ path: 'items.vendor', select: 'storeName slug' });
  if (!cart) return res.json({ success: true, cart: { items: [], subtotal: 0, totalItems: 0 } });

  // Filter out deleted/inactive products
  cart.items = cart.items.filter(item => item.product && item.product.isActive);
  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  res.json({ success: true, cart, subtotal });
}));

// @POST /api/cart — Add item
router.post('/', protect, asyncHandler(async (req, res) => {
  const { productId, quantity = 1, variant = '' } = req.body;
  const product = await Product.findById(productId).populate('vendor');
  if (!product || !product.isActive) { res.status(404); throw new Error('Product not found'); }
  if (product.stock < quantity) { res.status(400); throw new Error('Insufficient stock'); }

  let cart = await Cart.findOne({ user: req.user._id });
  if (!cart) cart = new Cart({ user: req.user._id, items: [] });

  const existingIdx = cart.items.findIndex(
    i => i.product.toString() === productId && i.variant === variant
  );
  if (existingIdx >= 0) {
    cart.items[existingIdx].quantity += Number(quantity);
  } else {
    cart.items.push({
      product: product._id,
      vendor: product.vendor._id,
      quantity: Number(quantity),
      variant,
      price: product.price,
    });
  }
  await cart.save();
  res.json({ success: true, message: 'Added to cart', totalItems: cart.items.length });
}));

// @PUT /api/cart/:itemId — Update quantity
router.put('/:itemId', protect, asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) { res.status(404); throw new Error('Cart not found'); }

  const item = cart.items.id(req.params.itemId);
  if (!item) { res.status(404); throw new Error('Item not found'); }

  const { quantity } = req.body;
  if (quantity <= 0) {
    item.remove();
  } else {
    item.quantity = Number(quantity);
  }
  await cart.save();
  const subtotal = cart.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
  res.json({ success: true, cart, subtotal });
}));

// @DELETE /api/cart/:itemId
router.delete('/:itemId', protect, asyncHandler(async (req, res) => {
  const cart = await Cart.findOne({ user: req.user._id });
  if (!cart) { res.status(404); throw new Error('Cart not found'); }
  cart.items = cart.items.filter(i => i._id.toString() !== req.params.itemId);
  await cart.save();
  res.json({ success: true, message: 'Item removed' });
}));

// @DELETE /api/cart — Clear cart
router.delete('/', protect, asyncHandler(async (req, res) => {
  await Cart.findOneAndDelete({ user: req.user._id });
  res.json({ success: true, message: 'Cart cleared' });
}));

module.exports = router;

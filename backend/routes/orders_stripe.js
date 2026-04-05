const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { protect, authorize } = require('../middleware/auth');

// @POST /api/orders — Place order from cart
router.post('/', protect, asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethod = 'stripe', notes } = req.body;
  if (!shippingAddress) { res.status(400); throw new Error('Shipping address required'); }

  const cart = await Cart.findOne({ user: req.user._id })
    .populate({ path: 'items.product', select: 'name thumbnail price stock vendor' })
    .populate('items.vendor');

  if (!cart || cart.items.length === 0) {
    res.status(400); throw new Error('Cart is empty');
  }

  // Validate stock & group by vendor
  const vendorMap = {};
  for (const item of cart.items) {
    if (!item.product || !item.product.isActive) {
      res.status(400); throw new Error(`Product ${item.product?.name || 'unknown'} is unavailable`);
    }
    if (item.product.stock < item.quantity) {
      res.status(400); throw new Error(`Insufficient stock for ${item.product.name}`);
    }
    const vid = item.vendor._id.toString();
    if (!vendorMap[vid]) vendorMap[vid] = { vendor: item.vendor._id, items: [] };
    vendorMap[vid].items.push(item);
  }

  const commissionRate = Number(process.env.PLATFORM_COMMISSION || 10) / 100;

  // Build vendor sub-orders
  const vendorOrders = Object.values(vendorMap).map(({ vendor, items }) => {
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const commission = Math.round(subtotal * commissionRate * 100) / 100;
    return {
      vendor,
      items: items.map(i => ({
        product: i.product._id,
        name: i.product.name,
        thumbnail: i.product.thumbnail,
        price: i.price,
        quantity: i.quantity,
        variant: i.variant || '',
      })),
      subtotal,
      commission,
      vendorEarnings: subtotal - commission,
      status: 'pending',
    };
  });

  const itemsTotal = vendorOrders.reduce((sum, vo) => sum + vo.subtotal, 0);
  const shippingCost = itemsTotal >= 55 ? 0 : 5.99;
  const tax = Math.round(itemsTotal * 0.08 * 100) / 100;
  const totalAmount = itemsTotal + shippingCost + tax - (cart.discount || 0);

  const order = await Order.create({
    buyer: req.user._id,
    vendorOrders,
    shippingAddress,
    paymentMethod,
    notes,
    itemsTotal,
    shippingCost,
    tax,
    discount: cart.discount || 0,
    totalAmount,
    status: 'pending',
  });

  // Decrement stock
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { stock: -item.quantity, sold: item.quantity },
    });
  }

  // Clear cart
  await Cart.findOneAndDelete({ user: req.user._id });

  res.status(201).json({ success: true, order });
}));

// @GET /api/orders/my — Buyer: own orders
router.get('/my', protect, asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const query = { buyer: req.user._id };
  if (status) query.status = status;

  const orders = await Order.find(query)
    .populate('vendorOrders.vendor', 'storeName slug logo')
    .sort('-createdAt')
    .skip((page - 1) * limit)
    .limit(Number(limit));
  const total = await Order.countDocuments(query);
  res.json({ success: true, orders, total, pages: Math.ceil(total / limit) });
}));

// @GET /api/orders/my/:id — Buyer: single order
router.get('/my/:id', protect, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id })
    .populate('vendorOrders.vendor', 'storeName slug logo contactEmail')
    .populate('buyer', 'name email');
  if (!order) { res.status(404); throw new Error('Order not found'); }
  res.json({ success: true, order });
}));

// @PUT /api/orders/my/:id/cancel — Buyer: cancel order
router.put('/my/:id/cancel', protect, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id });
  if (!order) { res.status(404); throw new Error('Order not found'); }
  if (!['pending', 'confirmed'].includes(order.status)) {
    res.status(400); throw new Error('Order cannot be cancelled at this stage');
  }
  order.status = 'cancelled';
  order.vendorOrders.forEach(vo => { vo.status = 'cancelled'; });
  await order.save();

  // Restore stock
  for (const vo of order.vendorOrders) {
    for (const item of vo.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, sold: -item.quantity },
      });
    }
  }
  res.json({ success: true, order });
}));

module.exports = router;

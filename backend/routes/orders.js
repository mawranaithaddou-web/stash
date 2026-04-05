const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const Vendor = require('../models/Vendor');
const { protect, authorize } = require('../middleware/auth');

// @POST /api/orders — Place order from cart using Cash on Delivery (COD)
router.post('/', protect, asyncHandler(async (req, res) => {
  const { shippingAddress, notes } = req.body;
  
  if (!shippingAddress) { 
    res.status(400); 
    throw new Error('Shipping address required'); 
  }

  const cart = await Cart.findOne({ user: req.user._id })
    .populate({ path: 'items.product', select: 'name thumbnail price stock vendor isActive status' })
    .populate('items.vendor');

  if (!cart || cart.items.length === 0) {
    res.status(400); 
    throw new Error('Cart is empty');
  }

  // 1. Validate stock & group items by vendor
  const vendorMap = {};
  for (const item of cart.items) {
// Replace your old check with this:
if (!item.product) {
  res.status(400);
  throw new Error(`Product in your cart no longer exists in our database.`);
}

// Only block if explicitly inactive or explicitly non-published
// (undefined/null are treated as valid to avoid false rejections when fields aren't loaded)
if (item.product.isActive === false) {
  res.status(400);
  throw new Error(`Product "${item.product.name}" is no longer available.`);
}
if (item.product.status && item.product.status !== 'published') {
  res.status(400);
  throw new Error(`Product "${item.product.name}" is currently unavailable (${item.product.status}).`);
}
    if (item.product.stock < item.quantity) {
      res.status(400); 
      throw new Error(`Insufficient stock for ${item.product.name}`);
    }
    
    const vid = item.vendor._id.toString();
    if (!vendorMap[vid]) {
      vendorMap[vid] = { vendor: item.vendor._id, items: [] };
    }
    vendorMap[vid].items.push(item);
  }

  const commissionRate = Number(process.env.PLATFORM_COMMISSION || 10) / 100;

  // 2. Build vendor sub-orders (Split-payment logic for COD)
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
      status: 'pending', // Individual vendor fulfillment status
      payoutStatus: 'pending' // Only changed to 'paid' after cash is collected and verified
    };
  });

  // 3. Calculate Global Totals
  const itemsTotal = vendorOrders.reduce((sum, vo) => sum + vo.subtotal, 0);
  const shippingCost = itemsTotal >= 55 ? 0 : 5.99;
  const tax = Math.round(itemsTotal * 0.08 * 100) / 100;
  const totalAmount = itemsTotal + shippingCost + tax - (cart.discount || 0);

  // 4. Create the Order
  const order = await Order.create({
    buyer: req.user._id,
    vendorOrders,
    shippingAddress,
    paymentMethod: 'cod',
    paymentStatus: 'pending', // Remains pending until delivery/collection
    notes,
    itemsTotal,
    shippingCost,
    tax,
    discount: cart.discount || 0,
    totalAmount,
    status: 'confirmed', // COD orders are often auto-confirmed to start processing
  });

  // 5. Inventory Management
  for (const item of cart.items) {
    await Product.findByIdAndUpdate(item.product._id, {
      $inc: { stock: -item.quantity, sold: item.quantity },
    });
  }

  // 6. Clear Cart
  await Cart.findOneAndDelete({ user: req.user._id });

  res.status(201).json({ 
    success: true, 
    message: 'Order placed successfully. Please prepare cash for delivery.',
    order 
  });
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

// @GET /api/orders/my/:id — Buyer: single order details
router.get('/my/:id', protect, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id })
    .populate('vendorOrders.vendor', 'storeName slug logo contactEmail')
    .populate('buyer', 'name email');
    
  if (!order) { 
    res.status(404); 
    throw new Error('Order not found'); 
  }
  res.json({ success: true, order });
}));

// @PUT /api/orders/my/:id/cancel — Buyer: cancel order
router.put('/my/:id/cancel', protect, asyncHandler(async (req, res) => {
  const order = await Order.findOne({ _id: req.params.id, buyer: req.user._id });
  
  if (!order) { 
    res.status(404); 
    throw new Error('Order not found'); 
  }

  // Can only cancel if it hasn't been shipped or processed far
  if (!['pending', 'confirmed'].includes(order.status)) {
    res.status(400); 
    throw new Error('Order cannot be cancelled at this stage');
  }

  order.status = 'cancelled';
  order.vendorOrders.forEach(vo => { vo.status = 'cancelled'; });
  await order.save();

  // Restore inventory
  for (const vo of order.vendorOrders) {
    for (const item of vo.items) {
      await Product.findByIdAndUpdate(item.product, {
        $inc: { stock: item.quantity, sold: -item.quantity },
      });
    }
  }
  
  res.json({ success: true, message: 'Order cancelled and stock restored', order });
}));

module.exports = router;
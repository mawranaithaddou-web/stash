const mongoose = require('mongoose');

const vendorOrderSchema = new mongoose.Schema({
  vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
  items: [
    {
      product:   { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
      name:      String,
      thumbnail: String,
      price:     Number,
      quantity:  Number,
      variant:   String,
    },
  ],
  subtotal:       Number,
  commission:     Number,
  vendorEarnings: Number,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending',
  },
  trackingNumber: String,
  shippedAt:      Date,
  deliveredAt:    Date,
  payoutStatus:   { type: String, enum: ['pending', 'paid'], default: 'pending' },
  stripeTransferId: String,
});

const orderSchema = new mongoose.Schema(
  {
    buyer:        { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    orderNumber:  { type: String, unique: true },
    vendorOrders: [vendorOrderSchema],
    shippingAddress: {
      fullName: String,
      phone:    String,
      street:   String,
      city:     String,
      state:    String,
      zip:      String,
      country:  String,
    },
    paymentMethod:         { type: String, default: 'stripe' },
    paymentStatus:         { type: String, enum: ['pending', 'paid', 'failed', 'refunded'], default: 'pending' },
    stripePaymentIntentId: String,
    itemsTotal:    Number,
    shippingCost:  { type: Number, default: 0 },
    tax:           { type: Number, default: 0 },
    discount:      { type: Number, default: 0 },
    totalAmount:   Number,
    notes:         String,
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'processing', 'partially_shipped', 'shipped', 'delivered', 'cancelled'],
      default: 'pending',
    },

    // ── Delivery fields ──────────────────────────────────────────
    deliveryPerson: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    estimatedDelivery: { type: Date, default: null },   // set by delivery person
    shippedAt:         { type: Date, default: null },
    deliveredAt:       { type: Date, default: null },
    deliveryNotes:     { type: String, default: '' },   // e.g. "Leave at door"
  },
  { timestamps: true }
);

orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = 'ORD-' + String(count + 1).padStart(6, '0');
  }
  next();
});

module.exports = mongoose.model('Order', orderSchema);
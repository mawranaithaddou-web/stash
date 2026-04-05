const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    items: [
      {
        product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
        vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', required: true },
        quantity: { type: Number, required: true, min: 1, default: 1 },
        variant: { type: String, default: '' },
        price: Number, // snapshot at time of add
      },
    ],
    couponCode: String,
    discount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

cartSchema.virtual('totalItems').get(function () {
  return this.items.reduce((sum, i) => sum + i.quantity, 0);
});

cartSchema.virtual('subtotal').get(function () {
  return this.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
});

module.exports = mongoose.model('Cart', cartSchema);

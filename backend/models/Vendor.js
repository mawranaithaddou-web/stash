const mongoose = require('mongoose');

const vendorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    storeName: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, unique: true, lowercase: true },
    description: { type: String, default: '' },
    logo: { type: String, default: '' },
    banner: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'approved', 'suspended'], default: 'pending' },
    address: {
      street: String,
      city: String,
      state: String,
      zip: String,
      country: String,
    },
    contactEmail: String,
    contactPhone: String,
    // Stripe Connect for payouts
    stripeAccountId: { type: String, default: '' },
    stripeOnboardingComplete: { type: Boolean, default: false },
    // Stats
    totalSales: { type: Number, default: 0 },
    totalRevenue: { type: Number, default: 0 },
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    // Social links
    social: {
      website: String,
      facebook: String,
      instagram: String,
      twitter: String,
    },
    commissionRate: { type: Number, default: 10 }, // override per vendor if needed
  },
  { timestamps: true }
);

// Auto-generate slug from storeName
vendorSchema.pre('save', function (next) {
  if (this.isModified('storeName')) {
    this.slug = this.storeName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }
  next();
});

module.exports = mongoose.model('Vendor', vendorSchema);

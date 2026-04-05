const mongoose = require('mongoose');
const SiteConfigSchema = new mongoose.Schema({
  key: { type: String, unique: true, required: true }, // e.g., 'hero_title', 'site_email'
  value: { type: mongoose.Schema.Types.Mixed, required: true } // Can be string, object, array
});

module.exports = mongoose.model('SiteConfig', SiteConfigSchema);
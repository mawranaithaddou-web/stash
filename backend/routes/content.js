const express = require('express');
const router = express.Router();
const asyncHandler = require('express-async-handler');
const SiteConfig = require('../models/SiteConfig');
const { protect, authorize } = require('../middleware/auth');

// ── Helper ────────────────────────────────────────────────────────────────────
const getConfigValue = async (key, defaultValue) => {
  const config = await SiteConfig.findOne({ key });
  return config ? config.value : defaultValue;
};

// ── GET /api/content  (Public — used by index.html on every load) ─────────────
router.get('/', asyncHandler(async (req, res) => {
  const content = {
    heroTitle:      await getConfigValue('hero_title',      'Discover<br><em>Thousands</em> of<br>Curated Products'),
    heroSubtitle:   await getConfigValue('hero_subtitle',   'Shop from hundreds of independent vendors. Find unique products you won\'t see anywhere else.'),
    promoTitle:     await getConfigValue('promo_title',     'Up to <em>40% Off</em>'),
    promoSubtitle:  await getConfigValue('promo_subtitle',  'On selected electronics and fashion items this week only.'),
    contactAddress: await getConfigValue('contact_address', '419 State 414 Rte, New York'),
    contactPhone:   await getConfigValue('contact_phone',   '(607) 936-8058'),
    contactEmail:   await getConfigValue('contact_email',   'hello@anon.com'),
  };
  res.json({ success: true, content });
}));

// ── PUT /api/content  (Admin only — called by admin-dashboard CMS form) ───────
router.put('/', protect, authorize('admin'), asyncHandler(async (req, res) => {
  const fields = {
    hero_title:      req.body.heroTitle,
    hero_subtitle:   req.body.heroSubtitle,
    promo_title:     req.body.promoTitle,
    promo_subtitle:  req.body.promoSubtitle,
    contact_address: req.body.contactAddress,
    contact_phone:   req.body.contactPhone,
    contact_email:   req.body.contactEmail,
  };

  // Upsert each key that was sent in the request body
  await Promise.all(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) =>
        SiteConfig.findOneAndUpdate(
          { key },
          { key, value },
          { upsert: true, new: true }
        )
      )
  );

  res.json({ success: true, message: 'Content updated successfully' });
}));

module.exports = router;

/*
  ─── IMPORTANT: Register this router in server.js ────────────────────────────
  Add this line alongside your other routes:

    app.use('/api/content', require('./routes/content'));

  Without this line the route never exists, regardless of what's in this file.
*/
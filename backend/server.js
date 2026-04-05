const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const app = express();

// ─── Middleware ───────────────────────────────────────────────────────────────

const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'https://chatty-worlds-say.loca.lt',
  'https://public-pots-admire.loca.lt',
  // ADD YOUR FIREBASE URLS HERE
  'https://vintage-shop-35421.web.app',
  'https://vintage-shop-35421.firebaseapp.com'
];

app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true
}));

app.use(morgan('dev'));

// Stripe webhook needs raw body — must come BEFORE express.json()
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api/auth',        require('./routes/auth'));
app.use('/api/users',       require('./routes/users'));
app.use('/api/vendors',     require('./routes/vendors'));
app.use('/api/products',    require('./routes/products'));
app.use('/api/categories',  require('./routes/categories'));
app.use('/api/orders',      require('./routes/orders'));
app.use('/api/cart',        require('./routes/cart'));
app.use('/api/reviews',     require('./routes/reviews'));
app.use('/api/payments',    require('./routes/payments'));
app.use('/api/admin',       require('./routes/admin'));
app.use('/api/newsletter',  require('./routes/newsletter'));
app.use('/api/delivery',    require('./routes/delivery'));
app.use('/api/content',     require('./routes/content'));

// ─── Serve frontend in production ─────────────────────────────────────────────
// We use 'public' because App Hosting isolates the 'backend' folder
const publicPath = path.join(__dirname, 'public');

app.use(express.static(publicPath));

// This handles the SPA routing (Single Page Application)
app.get('*', (req, res) => {
  // If the request isn't an API call, serve the index.html from the public folder
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(publicPath, 'index.html'), (err) => {
      if (err) {
        res.status(404).json({
          success: false,
          message: "Frontend files not found in /backend/public. Please move your HTML files there."
        });
      }
    });
  }
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

// ─── Database & Server Start ──────────────────────────────────────────────────

// Force IPv4 with family: 4 to prevent connection timeouts in Cloud Run
mongoose
  .connect(process.env.MONGO_URI, {
    family: 4
  })
  .then(() => console.log('✅ MongoDB connected'))
  .catch((err) => {
    console.error('❌ MongoDB connection error:', err.message);
    // Do NOT use process.exit(1) so the container stays alive for health checks
  });

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
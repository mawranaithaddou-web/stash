const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');
const connectDB = require('./config/db');

// 1. Load Environment Variables
dotenv.config();

// 2. Initialize Express
const app = express();

// 3. Connect to MongoDB
connectDB();

// 4. Middleware Setup
const allowedOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:5500',
  'http://localhost:8080',
  // Your Production URLs
  'https://vintage-shop-35421.web.app',
  'https://vintage-shop-35421.firebaseapp.com'
];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
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

// Stripe Webhook (MUST be before express.json() to keep raw body)
app.use('/api/payments/webhook', express.raw({ type: 'application/json' }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 5. Modular Routes
// Ensure these files exist in your /backend/routes/ directory
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/users',      require('./routes/users'));
app.use('/api/vendors',    require('./routes/vendors'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/cart',       require('./routes/cart'));
app.use('/api/reviews',    require('./routes/reviews'));
app.use('/api/payments',   require('./routes/payments'));
app.use('/api/admin',      require('./routes/admin'));
app.use('/api/newsletter', require('./routes/newsletter'));
app.use('/api/delivery',   require('./routes/delivery'));
app.use('/api/content',    require('./routes/content'));

// 6. Serve Static Files (Vanilla JS Frontend)
// This points to the /public folder in your project root
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// 7. SPA Routing (Send everything else to index.html)
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(publicPath, 'index.html'));
  }
});

// 8. Global Error Handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 9. Start Server
const PORT = process.env.PORT || 8080;
// Using 0.0.0.0 is mandatory for Firebase/Cloud Run deployment
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;
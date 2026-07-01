require('dotenv').config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
  console.error('FATAL: JWT_SECRET no configurado o demasiado corto. Saliendo.');
  process.exit(1);
}

const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const path    = require('path');

const productRoutes       = require('./src/routes/products');
const orderRoutes         = require('./src/routes/orders');
const authRoutes          = require('./src/routes/auth');
const adminProductRoutes  = require('./src/routes/admin/products');
const adminOrderRoutes    = require('./src/routes/admin/orders');
const adminPromoRoutes    = require('./src/routes/admin/promotions');
const adminUserRoutes     = require('./src/routes/admin/users');
const userOrderRoutes     = require('./src/routes/user/orders');

const app        = express();
const PORT       = process.env.PORT       || 3000;
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '../public');

// Topology: Internet → Nginx (1 hop) → Node. Allows express-rate-limit to read
// the real client IP from X-Forwarded-For instead of 127.0.0.1.
// If you remove Nginx or add another proxy layer, adjust this value accordingly.
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'"],
      styleSrc:   ["'self'", 'https://fonts.googleapis.com'],
      fontSrc:    ["'self'", 'https://fonts.gstatic.com'],
      imgSrc:     ["'self'", 'data:'],
      connectSrc: ["'self'"],
    },
  },
}));
// Restrict cross-origin requests to the configured domain.
// Set ALLOWED_ORIGIN in .env (e.g. https://tutienda.es).
// If unset, cross-origin requests are blocked for all origins.
app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

app.use(express.static(PUBLIC_DIR));

app.use('/api/products',         productRoutes);
app.use('/api/orders',           orderRoutes);
app.use('/api/auth',             authRoutes);
app.use('/api/admin/products',   adminProductRoutes);
app.use('/api/admin/orders',     adminOrderRoutes);
app.use('/api/admin/promotions', adminPromoRoutes);
app.use('/api/admin/users',      adminUserRoutes);
app.use('/api/user/orders',      userOrderRoutes);

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Carnicería Artesanal — server running on port ${PORT}`);
  });
}

module.exports = app;

require('dotenv').config();
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
const userOrderRoutes     = require('./src/routes/user/orders');

const app        = express();
const PORT       = process.env.PORT       || 3000;
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '../public');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.use(express.static(PUBLIC_DIR));

app.use('/api/products',         productRoutes);
app.use('/api/orders',           orderRoutes);
app.use('/api/auth',             authRoutes);
app.use('/api/admin/products',   adminProductRoutes);
app.use('/api/admin/orders',     adminOrderRoutes);
app.use('/api/admin/promotions', adminPromoRoutes);
app.use('/api/user/orders',      userOrderRoutes);

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Carnicería Artesanal — server running on port ${PORT}`);
});

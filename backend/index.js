require('dotenv').config();
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const path    = require('path');

const productRoutes = require('./src/routes/products');
const orderRoutes   = require('./src/routes/orders');

const app        = express();
const PORT       = process.env.PORT       || 3000;
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '../public');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors());
app.use(express.json());

app.use(express.static(PUBLIC_DIR));

app.use('/api/products', productRoutes);
app.use('/api/orders',   orderRoutes);

app.get('*', (_req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Carnicería Artesanal — server running on port ${PORT}`);
});

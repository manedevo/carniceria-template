const express      = require('express');
const router       = express.Router();
const db           = require('../../config/database');
const authenticate = require('../../middleware/authenticate');
const requireRole  = require('../../middleware/requireRole');

router.use(authenticate, requireRole('admin'));

// GET /api/admin/products
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM products ORDER BY FIELD(category,"Ternera","Cerdo","Pollo","Cordero","Embutidos"), name'
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

// POST /api/admin/products
router.post('/', async (req, res) => {
  try {
    const { name, category, price, note, image_url, unit_type, stock_qty, stock_enabled } = req.body;
    if (!name || !category || price == null) {
      return res.status(400).json({ error: 'name, category y price son obligatorios' });
    }
    const [result] = await db.query(
      `INSERT INTO products (name, category, price, unit_type, stock_qty, stock_enabled, note, image_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, category, price,
       unit_type || 'kg',
       stock_qty != null ? stock_qty : null,
       stock_enabled ? 1 : 0,
       note || null,
       image_url || null]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear producto' });
  }
});

// PUT /api/admin/products/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, category, price, note, image_url, unit_type, stock_qty, stock_enabled, active } = req.body;
    await db.query(
      `UPDATE products SET name=?, category=?, price=?, unit_type=?, stock_qty=?,
       stock_enabled=?, note=?, image_url=?, active=? WHERE id=?`,
      [name, category, price,
       unit_type || 'kg',
       stock_qty != null ? stock_qty : null,
       stock_enabled ? 1 : 0,
       note || null,
       image_url || null,
       active != null ? (active ? 1 : 0) : 1,
       req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar producto' });
  }
});

// DELETE /api/admin/products/:id — borrado lógico
router.delete('/:id', async (req, res) => {
  try {
    await db.query('UPDATE products SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar producto' });
  }
});

// PATCH /api/admin/products/:id/stock
router.patch('/:id/stock', async (req, res) => {
  try {
    const { stock_qty, stock_enabled } = req.body;
    await db.query(
      'UPDATE products SET stock_qty=?, stock_enabled=? WHERE id=?',
      [stock_qty != null ? stock_qty : null, stock_enabled ? 1 : 0, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar stock' });
  }
});

module.exports = router;

const express      = require('express');
const router       = express.Router();
const db           = require('../../config/database');
const authenticate = require('../../middleware/authenticate');
const requireRole  = require('../../middleware/requireRole');

router.use(authenticate, requireRole('admin'));

// GET /api/admin/promotions
router.get('/', async (req, res) => {
  try {
    const [promos] = await db.query('SELECT * FROM promotions ORDER BY created_at DESC');
    for (const promo of promos) {
      if (promo.applies_to === 'producto') {
        const [pids] = await db.query(
          'SELECT product_id FROM promotion_products WHERE promotion_id = ?',
          [promo.id]
        );
        promo.product_ids = pids.map(r => r.product_id);
      }
    }
    res.json(promos);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener promociones' });
  }
});

// POST /api/admin/promotions
router.post('/', async (req, res) => {
  try {
    const { name, type, value, applies_to, category, active, starts_at, ends_at, product_ids } = req.body;
    if (!name || !type || value == null) {
      return res.status(400).json({ error: 'name, type y value son obligatorios' });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();
      const [result] = await conn.query(
        `INSERT INTO promotions (name, type, value, applies_to, category, active, starts_at, ends_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [name, type, value, applies_to || 'todos', category || null,
         active ? 1 : 0, starts_at || null, ends_at || null]
      );
      const promoId = result.insertId;
      if (applies_to === 'producto' && Array.isArray(product_ids) && product_ids.length) {
        for (const pid of product_ids) {
          await conn.query('INSERT INTO promotion_products VALUES (?, ?)', [promoId, pid]);
        }
      }
      await conn.commit();
      res.status(201).json({ id: promoId });
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al crear promoción' });
  }
});

// PUT /api/admin/promotions/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, type, value, applies_to, category, active, starts_at, ends_at } = req.body;
    await db.query(
      `UPDATE promotions SET name=?, type=?, value=?, applies_to=?, category=?,
       active=?, starts_at=?, ends_at=? WHERE id=?`,
      [name, type, value, applies_to || 'todos', category || null,
       active ? 1 : 0, starts_at || null, ends_at || null, req.params.id]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar promoción' });
  }
});

// DELETE /api/admin/promotions/:id — desactivar
router.delete('/:id', async (req, res) => {
  try {
    await db.query('UPDATE promotions SET active = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al desactivar promoción' });
  }
});

module.exports = router;

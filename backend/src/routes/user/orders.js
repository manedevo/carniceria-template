const express      = require('express');
const router       = express.Router();
const db           = require('../../config/database');
const authenticate = require('../../middleware/authenticate');
const requireRole  = require('../../middleware/requireRole');

router.use(authenticate, requireRole('cliente'));

// GET /api/user/orders
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/user/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM orders WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

module.exports = router;

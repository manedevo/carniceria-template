const express         = require('express');
const router          = express.Router();
const db              = require('../../config/database');
const authenticate    = require('../../middleware/authenticate');
const requireRole     = require('../../middleware/requireRole');
const hasPermission   = require('../../middleware/hasPermission');

router.use(authenticate, requireRole('admin', 'ventas'));

const VALID_STATUSES = ['pendiente', 'confirmado', 'en camino', 'entregado', 'cancelado'];

// GET /api/admin/orders
router.get('/', async (req, res) => {
  try {
    const { status, zone, from, to } = req.query;
    const limit  = Math.min(Math.max(parseInt(req.query.limit)  || 50, 1), 200);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    let sql = `SELECT o.*, u.name AS user_name, u.email AS user_email
               FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE 1=1`;
    const params = [];
    if (status) { sql += ' AND o.status = ?';       params.push(status); }
    if (zone)   { sql += ' AND o.zone = ?';         params.push(zone); }
    if (from)   { sql += ' AND o.created_at >= ?';  params.push(from); }
    if (to)     { sql += ' AND o.created_at <= ?';  params.push(to + ' 23:59:59'); }
    sql += ' ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener pedidos' });
  }
});

// GET /api/admin/orders/:id
router.get('/:id', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT o.*, u.name AS user_name, u.email AS user_email
       FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = ?`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Pedido no encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener pedido' });
  }
});

// PUT /api/admin/orders/:id/status — admin o ventas con permiso change_order_status
router.put('/:id/status', requireRole('admin', 'ventas'), hasPermission('change_order_status'), async (req, res) => {
  try {
    const { status } = req.body;
    if (!VALID_STATUSES.includes(status)) {
      return res.status(400).json({ error: 'Estado no válido' });
    }
    await db.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar estado' });
  }
});

module.exports = router;

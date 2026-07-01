const express    = require('express');
const router     = express.Router();
const db         = require('../config/database');
const jwt        = require('jsonwebtoken');
const rateLimit  = require('express-rate-limit');

const orderLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 1000 : 4,
  message: { error: 'Hemos recibido varios pedidos desde tu conexión en muy poco tiempo. Por favor, espera un momento y vuelve a intentarlo — tu pedido es importante para nosotros.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function optionalUser(req) {
  try {
    const header = req.headers.authorization || '';
    const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return null;
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return null;
  }
}

router.post('/', orderLimiter, async (req, res) => {
  try {
    const { name, phone, address, zone, time_slot, payment_method, items } = req.body;

    if (!name || !phone || !address || !zone || !time_slot || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos. Verifica nombre, teléfono, dirección, zona, horario y carrito.' });
    }

    if (name.length > 120 || phone.length > 30 || address.length > 500
        || zone.length > 80 || time_slot.length > 60) {
      return res.status(400).json({ error: 'Campo demasiado largo' });
    }

    if (items.length > 50) {
      return res.status(400).json({ error: 'Demasiados productos en el pedido' });
    }

    const user    = optionalUser(req);
    const user_id = user?.id || null;

    let total = 0;
    const verifiedItems = [];
    for (const item of items) {
      const qty = Number(item.qty);
      if (!Number.isInteger(qty) || qty < 1) {
        return res.status(400).json({ error: `Cantidad inválida para el producto ${item.id}` });
      }
      const [rows] = await db.query(
        'SELECT id, name, price FROM products WHERE id = ? AND active = 1',
        [item.id]
      );
      if (!rows[0]) {
        return res.status(400).json({ error: `Producto ${item.id} no disponible` });
      }
      const price = parseFloat(rows[0].price);
      total += price * qty;
      verifiedItems.push({ id: rows[0].id, name: rows[0].name, price, qty });
    }

    const [result] = await db.query(
      `INSERT INTO orders (user_id, customer_name, phone, address, zone, time_slot, payment_method, items, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, name, phone, address, zone, time_slot, payment_method || 'Efectivo', JSON.stringify(verifiedItems), total]
    );

    res.status(201).json({ id: result.insertId, message: 'Pedido registrado. Te contactaremos para confirmar.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el pedido' });
  }
});

module.exports = router;

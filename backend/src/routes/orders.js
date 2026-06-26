const express = require('express');
const router  = express.Router();
const db      = require('../config/database');
const jwt     = require('jsonwebtoken');

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

router.post('/', async (req, res) => {
  try {
    const { name, phone, address, zone, time_slot, payment_method, items } = req.body;

    if (!name || !phone || !address || !zone || !time_slot || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos. Verifica nombre, teléfono, dirección, zona, horario y carrito.' });
    }

    const user    = optionalUser(req);
    const user_id = user?.id || null;
    const total   = items.reduce((sum, item) => sum + item.price * item.qty, 0);

    const [result] = await db.query(
      `INSERT INTO orders (user_id, customer_name, phone, address, zone, time_slot, payment_method, items, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [user_id, name, phone, address, zone, time_slot, payment_method || 'Efectivo', JSON.stringify(items), total]
    );

    res.status(201).json({ id: result.insertId, message: 'Pedido registrado. Te contactaremos para confirmar.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el pedido' });
  }
});

module.exports = router;

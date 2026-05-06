const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

router.post('/', async (req, res) => {
  try {
    const { name, phone, address, zone, time_slot, payment_method, items } = req.body;

    if (!name || !phone || !address || !zone || !time_slot || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Datos incompletos. Verifica nombre, teléfono, dirección, zona, horario y carrito.' });
    }

    const total    = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const [result] = await db.query(
      `INSERT INTO orders (customer_name, phone, address, zone, time_slot, payment_method, items, total)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, phone, address, zone, time_slot, payment_method || 'Efectivo', JSON.stringify(items), total]
    );

    res.status(201).json({ id: result.insertId, message: 'Pedido registrado. Te contactaremos para confirmar.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al registrar el pedido' });
  }
});

module.exports = router;

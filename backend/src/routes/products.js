const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let sql    = 'SELECT * FROM products WHERE active = 1';
    const params = [];

    if (category && category !== 'Todos') {
      sql += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      sql += ' AND (name LIKE ? OR note LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }
    sql += ' ORDER BY FIELD(category,"Ternera","Cerdo","Pollo","Cordero","Embutidos"), name';

    const [rows] = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener productos' });
  }
});

router.get('/categories', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT DISTINCT category FROM products WHERE active = 1 ORDER BY FIELD(category,"Ternera","Cerdo","Pollo","Cordero","Embutidos")'
    );
    res.json(rows.map(r => r.category));
  } catch (err) {
    res.status(500).json({ error: 'Error al obtener categorías' });
  }
});

module.exports = router;

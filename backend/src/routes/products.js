const express = require('express');
const router  = express.Router();
const db      = require('../config/database');

async function getActivePromo(productId, category) {
  const now = new Date();
  const [rows] = await db.query(
    `SELECT p.* FROM promotions p
     LEFT JOIN promotion_products pp ON pp.promotion_id = p.id
     WHERE p.active = 1
       AND (p.starts_at IS NULL OR p.starts_at <= ?)
       AND (p.ends_at   IS NULL OR p.ends_at   >= ?)
       AND (
         p.applies_to = 'todos'
         OR (p.applies_to = 'categoria' AND p.category = ?)
         OR (p.applies_to = 'producto'  AND pp.product_id = ?)
       )
     ORDER BY p.applies_to DESC
     LIMIT 1`,
    [now, now, category, productId]
  );
  return rows[0] || null;
}

function calcPromoPrice(price, promo) {
  if (!promo) return null;
  if (promo.type === 'porcentaje') {
    return Math.round(price * (1 - promo.value / 100) * 100) / 100;
  }
  return Math.max(0, Math.round((price - promo.value) * 100) / 100);
}

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

    const products = await Promise.all(rows.map(async p => {
      const promo = await getActivePromo(p.id, p.category);
      if (promo) {
        return {
          ...p,
          promo_name:       promo.name,
          promo_type:       promo.type,
          promo_value:      promo.value,
          promo_price:      calcPromoPrice(p.price, promo),
          promo_applies_to: promo.applies_to,
        };
      }
      return p;
    }));

    res.json(products);
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

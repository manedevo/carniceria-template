'use strict';

const jwt = require('jsonwebtoken');
const db  = require('../config/database');

module.exports = async function authenticate(req, res, next) {
  const header = req.headers.authorization || '';
  const token  = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token requerido' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const [rows] = await db.query(
      'SELECT permissions FROM users WHERE id = ? AND active = 1',
      [decoded.id]
    );
    if (!rows[0]) return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
    req.user = {
      ...decoded,
      permissions: rows[0].permissions
        ? (typeof rows[0].permissions === 'string'
            ? JSON.parse(rows[0].permissions)
            : rows[0].permissions)
        : null,
    };
    next();
  } catch {
    res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

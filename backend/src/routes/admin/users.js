'use strict';

const express      = require('express');
const router       = express.Router();
const db           = require('../../config/database');
const bcrypt       = require('bcryptjs');
const authenticate = require('../../middleware/authenticate');
const requireRole  = require('../../middleware/requireRole');

router.use(authenticate, requireRole('admin'));

const VALID_ROLES = ['admin', 'ventas', 'cliente'];

// GET /api/admin/users
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT id, email, name, phone, role, active, permissions, created_at
       FROM users ORDER BY role, name`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// POST /api/admin/users — crear cualquier tipo de usuario
router.post('/', async (req, res) => {
  try {
    const { email, password, name, phone, role } = req.body;
    if (!email || !password || !role || !name) {
      return res.status(400).json({ error: 'email, password, name y role son obligatorios' });
    }
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }
    const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
    const hash   = await bcrypt.hash(password, rounds);
    const [result] = await db.query(
      'INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)',
      [email, hash, name || null, phone || null, role]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'El email ya está registrado' });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// PUT /api/admin/users/:id — actualizar rol, nombre, permisos, active
router.put('/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (req.body.role !== undefined && targetId === req.user.id) {
      return res.status(400).json({ error: 'No puedes cambiar tu propio rol' });
    }
    const { name, phone, role, active, permissions } = req.body;
    if (role !== undefined && !VALID_ROLES.includes(role)) {
      return res.status(400).json({ error: 'Rol no válido' });
    }

    const sets = [];
    const vals = [];
    if (name !== undefined)        { sets.push('name = ?');        vals.push(name || null); }
    if (phone !== undefined)       { sets.push('phone = ?');       vals.push(phone || null); }
    if (role !== undefined)        { sets.push('role = ?');        vals.push(role); }
    if (active !== undefined)      { sets.push('active = ?');      vals.push(active ? 1 : 0); }
    if (permissions !== undefined) { sets.push('permissions = ?'); vals.push(permissions !== null ? JSON.stringify(permissions) : null); }

    if (sets.length === 0) return res.status(400).json({ error: 'Nada que actualizar' });

    vals.push(targetId);
    await db.query(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, vals);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// DELETE /api/admin/users/:id — hard delete; pedidos quedan con user_id = NULL (ON DELETE SET NULL)
router.delete('/:id', async (req, res) => {
  try {
    const targetId = parseInt(req.params.id, 10);
    if (targetId === req.user.id) {
      return res.status(400).json({ error: 'No puedes eliminar tu propia cuenta' });
    }
    await db.query('DELETE FROM users WHERE id = ?', [targetId]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;

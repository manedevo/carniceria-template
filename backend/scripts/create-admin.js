#!/usr/bin/env node
/**
 * Crea un usuario con rol 'admin' en la base de datos.
 * Uso: node scripts/create-admin.js <email> <password> [nombre]
 *
 * Ejemplo:
 *   node scripts/create-admin.js admin@carniceria.es MiPassword123 "Juan García"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const db     = require('../src/config/database');

async function main() {
  const [,, email, password, name = 'Administrador'] = process.argv;

  if (!email || !password) {
    console.error('Uso: node scripts/create-admin.js <email> <password> [nombre]');
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('Error: la contraseña debe tener al menos 8 caracteres.');
    process.exit(1);
  }

  const rounds = parseInt(process.env.BCRYPT_ROUNDS, 10) || 12;
  console.log(`Generando hash bcrypt (coste ${rounds})...`);
  const hash = await bcrypt.hash(password, rounds);

  try {
    const [result] = await db.query(
      "INSERT INTO users (email, password_hash, role, name) VALUES (?, ?, 'admin', ?)",
      [email.toLowerCase().trim(), hash, name.trim()]
    );
    console.log(`✓ Admin creado — id: ${result.insertId}, email: ${email.toLowerCase().trim()}`);
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      console.error(`Error: ya existe un usuario con el email "${email}".`);
    } else {
      console.error('Error al insertar en la BD:', err.message);
    }
    process.exit(1);
  }

  process.exit(0);
}

main();

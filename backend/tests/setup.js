'use strict';

const mysql2  = require('mysql2/promise');
const fs      = require('fs');
const path    = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.test') });

let rootPool;

beforeAll(async () => {
  rootPool = await mysql2.createPool({
    host:               process.env.DB_HOST,
    port:               parseInt(process.env.DB_PORT) || 3306,
    user:               process.env.DB_USER,
    password:           process.env.DB_PASSWORD,
    multipleStatements: true,
  });

  await rootPool.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
  await rootPool.query(`CREATE DATABASE \`${process.env.DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  await rootPool.query(`USE \`${process.env.DB_NAME}\``);

  const schema = fs.readFileSync(
    path.join(__dirname, '../database/schema.sql'), 'utf8'
  );
  // Remove the USE statement that points to carniceria_db (already using test DB)
  const cleanedSchema = schema.replace(/USE\s+`?carniceria_db`?\s*;/gi, '');
  await rootPool.query(cleanedSchema);

  const bcrypt = require('bcryptjs');
  const hash   = await bcrypt.hash('AdminPass123', 4);
  await rootPool.query(
    `INSERT INTO \`${process.env.DB_NAME}\`.users (email, password_hash, name, role)
     VALUES ('admin@test.es', ?, 'Admin Test', 'admin')`,
    [hash]
  );
}, 30000);

afterEach(async () => {
  if (!rootPool) return;
  await rootPool.query(`
    DELETE FROM \`${process.env.DB_NAME}\`.promotion_products;
    DELETE FROM \`${process.env.DB_NAME}\`.promotions;
    DELETE FROM \`${process.env.DB_NAME}\`.orders;
    DELETE FROM \`${process.env.DB_NAME}\`.products;
    DELETE FROM \`${process.env.DB_NAME}\`.users WHERE email != 'admin@test.es';
  `);
});

afterAll(async () => {
  if (!rootPool) return;
  await rootPool.query(`DROP DATABASE IF EXISTS \`${process.env.DB_NAME}\``);
  await rootPool.end();
});

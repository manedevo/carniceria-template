const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host:             process.env.DB_HOST     || 'localhost',
  port:             parseInt(process.env.DB_PORT) || 3306,
  user:             process.env.DB_USER     || 'carniceria',
  password:         process.env.DB_PASSWORD || 'secret',
  database:         process.env.DB_NAME     || 'carniceria_db',
  waitForConnections: true,
  connectionLimit:  10,
  charset:          'utf8mb4',
});

module.exports = pool;

const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error('❌ Thiếu biến môi trường JWT_SECRET');
}

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

pool.on('error', (err) => {
  console.error('Lỗi kết nối database:', err);
});

module.exports = pool;
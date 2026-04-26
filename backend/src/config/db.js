const { Pool } = require('pg');
require('dotenv').config();

if (!process.env.JWT_SECRET) {
  throw new Error('❌ Thiếu biến môi trường JWT_SECRET');
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

pool.on('error', (err) => {
  console.error('Lỗi kết nối database:', err);
});

module.exports = pool;
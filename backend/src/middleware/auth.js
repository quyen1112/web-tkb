const jwt = require('jsonwebtoken');
const pool = require('../config/db');

let revocationTableReady;

function ensureRevocationTable() {
  if (!revocationTableReady) {
    revocationTableReady = pool.query(`
      CREATE TABLE IF NOT EXISTS token_revocation (
        token_jti VARCHAR(64) PRIMARY KEY,
        user_id INT REFERENCES nguoidung(user_id) ON DELETE CASCADE,
        expires_at TIMESTAMP NOT NULL,
        revoked_at TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_token_revocation_expires_at
        ON token_revocation(expires_at);
    `);
  }
  return revocationTableReady;
}

const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Khong co token! Chua dang nhap.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded.jti) {
      return res.status(403).json({ error: 'Token khong hop le!' });
    }

    await ensureRevocationTable();
    await pool.query('DELETE FROM token_revocation WHERE expires_at <= NOW()');

    const revoked = await pool.query(
      'SELECT 1 FROM token_revocation WHERE token_jti = $1 AND expires_at > NOW() LIMIT 1',
      [decoded.jti]
    );
    if (revoked.rows.length > 0) {
      return res.status(401).json({ error: 'Phien dang nhap da het hieu luc!' });
    }

    req.token = token;
    req.user = decoded;
    return next();
  } catch (err) {
    console.error('AUTH VERIFY TOKEN ERROR:', err);
    return res.status(403).json({ error: 'Token khong hop le!' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.some(role => (req.user.vai_tros || []).includes(role))) {
      return res.status(403).json({ error: 'Ban khong co quyen truy cap!' });
    }
    return next();
  };
};

module.exports = { verifyToken, authorize, ensureRevocationTable };

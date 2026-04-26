require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const app = express();

const allowedOrigins = (process.env.ALLOWED_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error('CORS origin không được phép!'));
  },
  credentials: true,
}));
app.use(express.json());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  message: {
    error: 'Quá nhiều lần đăng nhập thất bại. Thử lại sau 15 phút!'
  }
});

// Routes
const authRoutes = require('./routes/auth');
const giaoVuRoutes = require('./routes/giaoVu');
const giangVienRoutes = require('./routes/giangVien');
const sinhVienRoutes = require('./routes/sinhVien');
const truongKhoaRoutes = require('./routes/truongKhoa');
const adminRoutes = require('./routes/admin');

app.use('/api/auth/login', loginLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/giao-vu', giaoVuRoutes);
app.use('/api/giang-vien', giangVienRoutes);
app.use('/api/sinh-vien', sinhVienRoutes);
app.use('/api/truong-khoa', truongKhoaRoutes);
app.use('/api/admin', adminRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.status(204).end();
});

// Error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Đã xảy ra lỗi server!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server đang chạy tại http://localhost:${PORT}`);
});

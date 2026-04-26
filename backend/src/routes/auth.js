const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const pool = require('../config/db');
const { verifyToken, ensureRevocationTable } = require('../middleware/auth');

router.post('/login', async (req, res) => {
  try {
    const { email, mat_khau } = req.body;
    const emailClean = email?.trim().toLowerCase();

    if (!emailClean || !mat_khau) {
      return res.status(400).json({ error: 'Email và mật khẩu không được để trống!' });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailClean)) {
      return res.status(400).json({ error: 'Email không hợp lệ!' });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET chưa được cấu hình!' });
    }

    const result = await pool.query(`
      SELECT
        nd.user_id,
        nd.ho_ten,
        nd.email,
        nd.mat_khau,
        nd.trang_thai,
        gv.ma_gv,
        gv.hoc_vi,
        gv.giang_vien_id,
        sv.ma_sv,
        sv.sinh_vien_id,
        sv.lop_hanh_chinh_id,
        vc.ten_vai_tro,
        vai_tros.vai_tros
      FROM nguoidung nd
      LEFT JOIN giangvien gv ON nd.user_id = gv.user_id
      LEFT JOIN sinhvien sv ON nd.user_id = sv.user_id
      LEFT JOIN (
        SELECT
          nvt.user_id,
          vt.ten_vai_tro,
          ROW_NUMBER() OVER (
            PARTITION BY nvt.user_id
            ORDER BY vt.thu_tu_uu_tien ASC, nvt.ngay_gan ASC
          ) AS rn
        FROM nguoidung_vai_tro nvt
        JOIN vai_tro_catalog vt ON nvt.vai_tro_id = vt.vai_tro_id
      ) vc ON nd.user_id = vc.user_id AND vc.rn = 1
      LEFT JOIN (
        SELECT
          nvt.user_id,
          ARRAY_AGG(vt.ten_vai_tro ORDER BY vt.thu_tu_uu_tien ASC, nvt.ngay_gan ASC) AS vai_tros
        FROM nguoidung_vai_tro nvt
        JOIN vai_tro_catalog vt ON nvt.vai_tro_id = vt.vai_tro_id
        GROUP BY nvt.user_id
      ) vai_tros ON nd.user_id = vai_tros.user_id
      WHERE nd.email = $1
    `, [emailClean]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng!' });
    }

    const user = result.rows[0];

    if (!user.mat_khau) {
      return res.status(500).json({ error: 'Tài khoản chưa được cấu hình mật khẩu!' });
    }

    const isMatch = await bcrypt.compare(mat_khau, user.mat_khau);
    if (!isMatch) {
      return res.status(401).json({ error: 'Email hoặc mật khẩu không đúng!' });
    }

    if (user.trang_thai === 'khoa') {
      return res.status(403).json({ error: 'Tài khoản đã bị khóa!' });
    }

    if (!user.ten_vai_tro) {
      return res.status(403).json({ error: 'Tài khoản chưa được gán vai trò!' });
    }

    const tokenPayload = {
      user_id: user.user_id,
      email: user.email,
      ho_ten: user.ho_ten,
      vai_tro: user.ten_vai_tro,
      vai_tros: user.vai_tros || []
    };
    if (user.ma_gv) {
      tokenPayload.ma_gv = user.ma_gv;
      tokenPayload.giang_vien_id = user.giang_vien_id;
      tokenPayload.hoc_vi = user.hoc_vi;
    }
    if (user.ma_sv) {
      tokenPayload.ma_sv = user.ma_sv;
      tokenPayload.sinh_vien_id = user.sinh_vien_id;
      tokenPayload.lop_hanh_chinh_id = user.lop_hanh_chinh_id;
    }

    const token = jwt.sign(tokenPayload, process.env.JWT_SECRET, {
      expiresIn: '24h',
      jwtid: crypto.randomUUID(),
    });

    // Build user response theo vai trò
    const userResponse = {
      user_id: user.user_id,
      ho_ten: user.ho_ten,
      email: user.email,
      vai_tro: user.ten_vai_tro,
      vai_tros: user.vai_tros || []
    };
    if (user.ma_gv) {
      userResponse.ma_gv = user.ma_gv;
      userResponse.giang_vien_id = user.giang_vien_id;
      userResponse.hoc_vi = user.hoc_vi;
    }
    if (user.ma_sv) {
      userResponse.ma_sv = user.ma_sv;
      userResponse.sinh_vien_id = user.sinh_vien_id;
      userResponse.lop_hanh_chinh_id = user.lop_hanh_chinh_id;
    }

    res.json({ message: 'Đăng nhập thành công!', token, user: userResponse });
  } catch (err) {
    console.error('AUTH LOGIN ERROR:', err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/logout', verifyToken, async (req, res) => {
  try {
    if (!req.user?.jti || !req.user?.exp) {
      return res.status(400).json({ error: 'Token khong hop le!' });
    }

    await ensureRevocationTable();
    await pool.query(
      `INSERT INTO token_revocation (token_jti, user_id, expires_at)
       VALUES ($1, $2, to_timestamp($3))
       ON CONFLICT (token_jti) DO NOTHING`,
      [req.user.jti, req.user.user_id, req.user.exp]
    );

    res.json({ message: 'Dang xuat thanh cong!' });
  } catch (err) {
    console.error('AUTH LOGOUT ERROR:', err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.post('/doi-mat-khau', verifyToken, async (req, res) => {
  try {
    const { user_id } = req.user;
    const { mat_khau_cu, mat_khau_moi } = req.body;

    if (!mat_khau_cu || !mat_khau_moi) {
      return res.status(400).json({ error: 'Mật khẩu cũ và mật khẩu mới không được để trống!' });
    }

    if (mat_khau_moi.length < 6) {
      return res.status(400).json({ error: 'Mật khẩu mới phải có ít nhất 6 ký tự!' });
    }

    if (mat_khau_moi.length > 128) {
      return res.status(400).json({ error: 'Mật khẩu mới không được quá 128 ký tự!' });
    }

    const result = await pool.query(
      'SELECT mat_khau FROM nguoidung WHERE user_id = $1',
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng!' });
    }

    const currentHashedPassword = result.rows[0].mat_khau;

    const isMatch = await bcrypt.compare(mat_khau_cu, currentHashedPassword);
    if (!isMatch) {
      return res.status(400).json({ error: 'Mật khẩu cũ không đúng!' });
    }

    const isSameAsOld = await bcrypt.compare(mat_khau_moi, currentHashedPassword);
    if (isSameAsOld) {
      return res.status(400).json({ error: 'Mật khẩu mới không được trùng với mật khẩu cũ!' });
    }

    const hashedPassword = await bcrypt.hash(mat_khau_moi, 10);
    await pool.query(
      'UPDATE nguoidung SET mat_khau = $1 WHERE user_id = $2',
      [hashedPassword, user_id]
    );

    res.json({ message: 'Đổi mật khẩu thành công!' });
  } catch (err) {
    console.error('AUTH DOI MAT KHAU ERROR:', err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.get('/me', verifyToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        nd.user_id,
        nd.ho_ten,
        nd.email,
        gv.ma_gv,
        gv.hoc_vi,
        gv.giang_vien_id,
        sv.ma_sv,
        sv.sinh_vien_id,
        sv.lop_hanh_chinh_id,
        vc.ten_vai_tro,
        vai_tros.vai_tros
      FROM nguoidung nd
      LEFT JOIN giangvien gv ON nd.user_id = gv.user_id
      LEFT JOIN sinhvien sv ON nd.user_id = sv.user_id
      LEFT JOIN (
        SELECT
          nvt.user_id,
          vt.ten_vai_tro,
          ROW_NUMBER() OVER (
            PARTITION BY nvt.user_id
            ORDER BY vt.thu_tu_uu_tien ASC, nvt.ngay_gan ASC
          ) AS rn
        FROM nguoidung_vai_tro nvt
        JOIN vai_tro_catalog vt ON nvt.vai_tro_id = vt.vai_tro_id
      ) vc ON nd.user_id = vc.user_id AND vc.rn = 1
      LEFT JOIN (
        SELECT
          nvt.user_id,
          ARRAY_AGG(vt.ten_vai_tro ORDER BY vt.thu_tu_uu_tien ASC, nvt.ngay_gan ASC) AS vai_tros
        FROM nguoidung_vai_tro nvt
        JOIN vai_tro_catalog vt ON nvt.vai_tro_id = vt.vai_tro_id
        GROUP BY nvt.user_id
      ) vai_tros ON nd.user_id = vai_tros.user_id
      WHERE nd.user_id = $1
    `, [req.user.user_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy người dùng!' });
    }

    const user = result.rows[0];
    res.json({ user });
  } catch (err) {
    console.error('AUTH /me ERROR:', err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

module.exports = router;

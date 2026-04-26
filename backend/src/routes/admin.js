const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const { verifyToken, authorize } = require('../middleware/auth');

router.use(verifyToken);
router.use(authorize('admin'));

// ===== HELPER =====
function parseIntParam(value, paramName) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return { error: `${paramName} phải là số nguyên dương!` };
  }
  return { value: num };
}

async function insertNotification(client, { tieu_de, noi_dung, loai_thong_bao = 'thong_tin', nguoi_tao_id, recipients }) {
  const uniqueRecipients = [...new Set((recipients || []).filter(Boolean))];
  if (uniqueRecipients.length === 0) return null;

  const tbResult = await client.query(
    `INSERT INTO thong_bao (tieu_de, noi_dung, loai_thong_bao, ngay_tao, nguoi_tao_id)
     VALUES ($1, $2, $3, NOW(), $4)
     RETURNING thong_bao_id`,
    [tieu_de, noi_dung, loai_thong_bao, nguoi_tao_id]
  );

  const values = uniqueRecipients.map((_, index) => `($1, $${index + 2}, 'da_gui')`).join(', ');
  await client.query(
    `INSERT INTO thong_bao_nguoi_nhan (thong_bao_id, nguoi_dung_id, trang_thai_gui)
     VALUES ${values}
     ON CONFLICT (thong_bao_id, nguoi_dung_id) DO NOTHING`,
    [tbResult.rows[0].thong_bao_id, ...uniqueRecipients]
  );

  return tbResult.rows[0].thong_bao_id;
}

async function getUserLockImpact(client, userId) {
  const userResult = await client.query(
    `SELECT nd.user_id, nd.ho_ten, nd.email, nd.trang_thai,
            sv.sinh_vien_id, gv.giang_vien_id,
            ARRAY_AGG(DISTINCT vc.ten_vai_tro) FILTER (WHERE vc.ten_vai_tro IS NOT NULL) AS vai_tro
     FROM nguoidung nd
     LEFT JOIN sinhvien sv ON nd.user_id = sv.user_id
     LEFT JOIN giangvien gv ON nd.user_id = gv.user_id
     LEFT JOIN nguoidung_vai_tro nvt ON nd.user_id = nvt.user_id
     LEFT JOIN vai_tro_catalog vc ON nvt.vai_tro_id = vc.vai_tro_id
     WHERE nd.user_id = $1
     GROUP BY nd.user_id, sv.sinh_vien_id, gv.giang_vien_id`,
    [userId]
  );

  if (userResult.rows.length === 0) return null;

  const user = userResult.rows[0];
  const roles = user.vai_tro || [];
  const primaryRole = roles.includes('admin')
    ? 'admin'
    : roles.includes('sinh_vien')
      ? 'sinh_vien'
      : roles.includes('giang_vien')
        ? 'giang_vien'
        : roles[0] || null;
  let lopHocPhan = [];

  if (primaryRole === 'sinh_vien' && user.sinh_vien_id) {
    const lhpResult = await client.query(
      `SELECT svlh.id AS sinhvien_lophocphan_id,
              lhp.lop_hoc_phan_id, lhp.ma_lop_hp, lhp.ten_lop_hp,
              mh.ten_mon, gv_nd.user_id AS giang_vien_user_id, gv_nd.ho_ten AS ten_gv
       FROM sinhvien_lophocphan svlh
       JOIN lop_hoc_phan lhp ON svlh.lop_hoc_phan_id = lhp.lop_hoc_phan_id
       JOIN hoc_ky hk ON lhp.hoc_ky_id = hk.hoc_ky_id
       JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
       LEFT JOIN phan_cong_giang_day pcgd ON lhp.lop_hoc_phan_id = pcgd.lop_hoc_phan_id
       LEFT JOIN giangvien gv ON pcgd.giang_vien_id = gv.giang_vien_id
       LEFT JOIN nguoidung gv_nd ON gv.user_id = gv_nd.user_id
       WHERE svlh.sinh_vien_id = $1
         AND svlh.trang_thai = 'hoat_dong'
         AND lhp.trang_thai = 'hoat_dong'
         AND hk.trang_thai = 'hoat_dong'
       ORDER BY lhp.ma_lop_hp`,
      [user.sinh_vien_id]
    );
    lopHocPhan = lhpResult.rows;
  }

  if (primaryRole === 'giang_vien' && user.giang_vien_id) {
    const lhpResult = await client.query(
      `SELECT pcgd.phan_cong_id,
              lhp.lop_hoc_phan_id, lhp.ma_lop_hp, lhp.ten_lop_hp,
              mh.ten_mon
       FROM phan_cong_giang_day pcgd
       JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
       JOIN hoc_ky hk ON lhp.hoc_ky_id = hk.hoc_ky_id
       JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
       WHERE pcgd.giang_vien_id = $1
         AND lhp.trang_thai = 'hoat_dong'
         AND hk.trang_thai = 'hoat_dong'
       ORDER BY lhp.ma_lop_hp`,
      [user.giang_vien_id]
    );
    lopHocPhan = lhpResult.rows;
  }

  return {
    user,
    primaryRole,
    lop_hoc_phan: lopHocPhan,
    requires_confirm: ['sinh_vien', 'giang_vien'].includes(primaryRole) && lopHocPhan.length > 0,
  };
}

async function lockUserWithImpact(client, userId, actorUserId) {
  const impact = await getUserLockImpact(client, userId);
  if (!impact) return { status: 404, error: 'Người dùng không tồn tại!' };

  const { user, primaryRole, lop_hoc_phan: lopHocPhan } = impact;
  if (primaryRole === 'admin') {
    return { status: 403, error: 'Không thể khóa tài khoản admin!' };
  }

  if (user.trang_thai === 'khoa') {
    await client.query('UPDATE nguoidung SET trang_thai = $1 WHERE user_id = $2', ['hoat_dong', userId]);
    return { message: 'Mở khóa tài khoản thành công!', trang_thai: 'hoat_dong', impact };
  }

  await client.query('UPDATE nguoidung SET trang_thai = $1 WHERE user_id = $2', ['khoa', userId]);

  if (primaryRole === 'sinh_vien' && user.sinh_vien_id && lopHocPhan.length > 0) {
    const lhpIds = lopHocPhan.map((item) => item.lop_hoc_phan_id);
    await client.query(
      `UPDATE sinhvien_lophocphan
       SET trang_thai = 'huy'
       WHERE sinh_vien_id = $1
         AND trang_thai = 'hoat_dong'
         AND lop_hoc_phan_id = ANY($2::int[])`,
      [user.sinh_vien_id, lhpIds]
    );

    const classText = lopHocPhan.map((item) => `${item.ma_lop_hp} - ${item.ten_mon}`).join(', ');
    const teacherRecipients = lopHocPhan.map((item) => item.giang_vien_user_id);

    await insertNotification(client, {
      tieu_de: `Sinh viên bị khóa tài khoản ${user.user_id} ${Date.now()}`,
      noi_dung: `Sinh viên ${user.ho_ten} đã bị khóa tài khoản và được đưa khỏi các lớp học phần: ${classText}.`,
      loai_thong_bao: 'thong_tin',
      nguoi_tao_id: actorUserId,
      recipients: [user.user_id, ...teacherRecipients],
    });
  }

  if (primaryRole === 'giang_vien' && user.giang_vien_id && lopHocPhan.length > 0) {
    const lhpIds = lopHocPhan.map((item) => item.lop_hoc_phan_id);
    const classText = lopHocPhan.map((item) => `${item.ma_lop_hp} - ${item.ten_mon}`).join(', ');

    const giaoVuResult = await client.query(
      `SELECT DISTINCT nd.user_id
       FROM nguoidung nd
       JOIN nguoidung_vai_tro nvt ON nd.user_id = nvt.user_id
       JOIN vai_tro_catalog vc ON nvt.vai_tro_id = vc.vai_tro_id
       WHERE vc.ten_vai_tro = 'giao_vu'
         AND nd.trang_thai = 'hoat_dong'`
    );
    const sinhVienResult = await client.query(
      `SELECT DISTINCT sv.user_id
       FROM sinhvien_lophocphan svlh
       JOIN sinhvien sv ON svlh.sinh_vien_id = sv.sinh_vien_id
       JOIN nguoidung nd ON sv.user_id = nd.user_id
       WHERE svlh.lop_hoc_phan_id = ANY($1::int[])
         AND svlh.trang_thai = 'hoat_dong'
         AND nd.trang_thai = 'hoat_dong'`,
      [lhpIds]
    );

    await insertNotification(client, {
      tieu_de: `Cần phân công lại giảng viên ${user.user_id} ${Date.now()}`,
      noi_dung: `Giảng viên ${user.ho_ten} đã bị khóa tài khoản. Giáo vụ cần phân công giảng viên khác cho các lớp học phần: ${classText}.`,
      loai_thong_bao: 'thong_bao_khan',
      nguoi_tao_id: actorUserId,
      recipients: giaoVuResult.rows.map((row) => row.user_id),
    });

    await insertNotification(client, {
      tieu_de: `Thông báo thay đổi giảng viên ${user.user_id} ${Date.now()}`,
      noi_dung: `Giảng viên hiện tại của các lớp học phần ${classText} đã bị khóa tài khoản. Nhà trường sẽ cập nhật giảng viên phụ trách mới.`,
      loai_thong_bao: 'thay_doi_lich',
      nguoi_tao_id: actorUserId,
      recipients: sinhVienResult.rows.map((row) => row.user_id),
    });
  }

  return { message: 'Khóa tài khoản thành công!', trang_thai: 'khoa', impact };
}

router.get('/nguoi-dung', async (req, res) => {
  try {
    const {
      trang_thai,             // hoat_dong | khoa
      vai_tro,                // giang_vien | sinh_vien | giao_vu | truong_khoa | admin
      q,                      // tìm theo họ tên, email, ma_sv, ma_gv
      lop_hanh_chinh_id,     // lọc sinh viên theo lớp hành chính
      page = 1,
      limit = 50
    } = req.query;

    const allowedTrangThai = ['hoat_dong', 'khoa'];
    const allowedVaiTro = ['giang_vien', 'sinh_vien', 'giao_vu', 'truong_khoa', 'admin'];

    const conditions = [];
    const params = [];

    if (trang_thai) {
      if (!allowedTrangThai.includes(trang_thai)) {
        return res.status(400).json({ error: 'trang_thai không hợp lệ!' });
      }
      params.push(trang_thai);
      conditions.push(`nd.trang_thai = $${params.length}`);
    }

    if (vai_tro) {
      if (typeof vai_tro !== 'string' || !allowedVaiTro.includes(vai_tro.trim())) {
        return res.status(400).json({ error: 'vai_tro không hợp lệ!' });
      }
      params.push(vai_tro.trim());
      conditions.push(`
        EXISTS (
          SELECT 1
          FROM nguoidung_vai_tro nvt2
          JOIN vai_tro_catalog vc2 ON nvt2.vai_tro_id = vc2.vai_tro_id
          WHERE nvt2.user_id = nd.user_id
            AND vc2.ten_vai_tro = $${params.length}
        )
      `);
    }

    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim()}%`);
      conditions.push(`
        (
          nd.ho_ten ILIKE $${params.length}
          OR nd.email ILIKE $${params.length}
          OR sv.ma_sv ILIKE $${params.length}
          OR gv.ma_gv ILIKE $${params.length}
        )
      `);
    }

    if (lop_hanh_chinh_id !== undefined) {
      const lopId = parseInt(lop_hanh_chinh_id, 10);
      if (isNaN(lopId) || lopId <= 0) {
        return res.status(400).json({ error: 'lop_hanh_chinh_id không hợp lệ!' });
      }
      params.push(lopId);
      conditions.push(`sv.lop_hanh_chinh_id = $${params.length}`);
    }

    const pageNum = parseInt(page, 10);
    const limitNum = parseInt(limit, 10);

    if (isNaN(pageNum) || pageNum <= 0) {
      return res.status(400).json({ error: 'page không hợp lệ!' });
    }
    if (isNaN(limitNum) || limitNum <= 0 || limitNum > 100) {
      return res.status(400).json({ error: 'limit không hợp lệ! (1-100)' });
    }

    const offset = (pageNum - 1) * limitNum;
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // COUNT: thêm đủ JOIN để filter vai_tro và q (ma_sv, ma_gv) chính xác
    const countResult = await pool.query(
      `SELECT COUNT(DISTINCT nd.user_id) AS total
       FROM nguoidung nd
       LEFT JOIN giangvien gv ON nd.user_id = gv.user_id
       LEFT JOIN sinhvien sv ON nd.user_id = sv.user_id
       ${whereClause}`,
      params
    );

    const total = parseInt(countResult.rows[0].total, 10);

    // LIMIT / OFFSET dùng chỉ số đúng
    const limitPlaceholder = params.length + 1;
    const offsetPlaceholder = params.length + 2;

    const dataResult = await pool.query(`
      SELECT nd.user_id, nd.ho_ten, nd.email, nd.trang_thai,
             gv.ma_gv, gv.hoc_vi,
             sv.sinh_vien_id, sv.ma_sv, sv.lop_hanh_chinh_id,
             ARRAY_AGG(DISTINCT vc.ten_vai_tro) FILTER (WHERE vc.ten_vai_tro IS NOT NULL) AS vai_tro
      FROM nguoidung nd
      LEFT JOIN giangvien gv ON nd.user_id = gv.user_id
      LEFT JOIN sinhvien sv ON nd.user_id = sv.user_id
      LEFT JOIN nguoidung_vai_tro nvt ON nd.user_id = nvt.user_id
      LEFT JOIN vai_tro_catalog vc ON nvt.vai_tro_id = vc.vai_tro_id
      ${whereClause}
      GROUP BY nd.user_id, gv.ma_gv, gv.hoc_vi, sv.sinh_vien_id, sv.ma_sv, sv.lop_hanh_chinh_id
      ORDER BY nd.ho_ten ASC
      LIMIT $${limitPlaceholder} OFFSET $${offsetPlaceholder}
    `, [...params, limitNum, offset]);

    res.json({
      data: dataResult.rows,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        total_pages: Math.ceil(total / limitNum)
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// Fix: bỏ vai_tro khỏi INSERT nguoidung (cột không tồn tại)
//      thêm INSERT vào nguoidung_vai_tro để gán vai trò
router.post('/nguoi-dung', async (req, res) => {
  // Validate cơ bản TRƯỚC kết nối DB
  const { ho_ten, email, mat_khau, vai_tro, ma_gv, hoc_vi, ma_sv, lop_hanh_chinh_id } = req.body;

  // Validate ho_ten bắt buộc
  if (!ho_ten || typeof ho_ten !== 'string' || !ho_ten.trim()) {
    return res.status(400).json({ error: 'Thiếu họ tên (ho_ten)!' });
  }

  // Validate email bắt buộc
  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Thiếu email!' });
  }
  const emailClean = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailClean)) {
    return res.status(400).json({ error: 'Email không hợp lệ!' });
  }

  // Validate vai_tro bắt buộc
  if (!vai_tro || typeof vai_tro !== 'string') {
    return res.status(400).json({ error: 'Thiếu vai_tro hợp lệ!' });
  }

  // Validate các trường bắt buộc theo vai_tro
  if (vai_tro === 'giang_vien') {
    if (!ma_gv || typeof ma_gv !== 'string' || !ma_gv.trim()) {
      return res.status(400).json({ error: 'Thiếu mã giảng viên (ma_gv)!' });
    }
  }
  if (vai_tro === 'sinh_vien') {
    if (!ma_sv || typeof ma_sv !== 'string' || !ma_sv.trim()) {
      return res.status(400).json({ error: 'Thiếu mã sinh viên (ma_sv)!' });
    }
    if (!lop_hanh_chinh_id || typeof lop_hanh_chinh_id !== 'number') {
      return res.status(400).json({ error: 'Thiếu hoặc sai kiểu lớp hành chính (lop_hanh_chinh_id)!' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Kiểm tra vai_tro tồn tại trong catalog
    const vtResult = await client.query(
      'SELECT vai_tro_id FROM vai_tro_catalog WHERE ten_vai_tro = $1',
      [vai_tro]
    );
    if (vtResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Vai trò '${vai_tro}' không tồn tại!` });
    }

    // Kiểm tra email trùng
    const existCheck = await client.query(
      'SELECT user_id FROM nguoidung WHERE email = $1',
      [emailClean]
    );
    if (existCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email đã tồn tại!' });
    }

    // mat_khau là bắt buộc
    if (!mat_khau || typeof mat_khau !== 'string' || mat_khau.length < 6) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'mat_khau phải có ít nhất 6 ký tự!' });
    }

    const hashedPassword = await bcrypt.hash(mat_khau, 10);

    const ndResult = await client.query(
      `INSERT INTO nguoidung (ho_ten, email, mat_khau, trang_thai)
       VALUES ($1, $2, $3, 'hoat_dong') RETURNING user_id, ho_ten, email, trang_thai`,
      [ho_ten, emailClean, hashedPassword]
    );

    const user_id = ndResult.rows[0].user_id;

    // Gán vai trò vào nguoidung_vai_tro (dùng vai_tro_id đã tra)
    await client.query(
      `INSERT INTO nguoidung_vai_tro (user_id, vai_tro_id, ngay_gan)
       VALUES ($1, $2, NOW())`,
      [user_id, vtResult.rows[0].vai_tro_id]
    );

    // Tạo bản ghi giang_vien hoặc sinh_vien nếu có
    if (vai_tro === 'giang_vien') {
      await client.query(
        `INSERT INTO giangvien (user_id, ma_gv, hoc_vi)
         VALUES ($1, $2, $3)`,
        [user_id, ma_gv, hoc_vi]
      );
    } else if (vai_tro === 'sinh_vien') {
      await client.query(
        `INSERT INTO sinhvien (user_id, ma_sv, lop_hanh_chinh_id)
         VALUES ($1, $2, $3)`,
        [user_id, ma_sv, lop_hanh_chinh_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Thêm người dùng thành công!', data: ndResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') {
      const detail = err.detail || '';
      if (detail.includes('email')) return res.status(409).json({ error: 'Email đã tồn tại!' });
      if (detail.includes('ma_gv')) return res.status(409).json({ error: 'Mã giảng viên đã tồn tại!' });
      if (detail.includes('ma_sv')) return res.status(409).json({ error: 'Mã sinh viên đã tồn tại!' });
      return res.status(409).json({ error: 'Dữ liệu trùng lặp!' });
    }
    if (err.code === '23503') return res.status(400).json({ error: 'Tham chiếu không hợp lệ (lớp hành chính, học kỳ...)!' });
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

// Fix: kiểm tra admin qua JOIN nguoidung_vai_tro + vai_tro_catalog
//      (không dùng vai_tro trên nguoidung vì cột không tồn tại)
router.put('/nguoi-dung/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'ID người dùng không hợp lệ!' });
  }

  const {
    ho_ten,
    email,
    trang_thai,
    ma_gv,
    hoc_vi,
    ma_sv,
    lop_hanh_chinh_id,
  } = req.body;

  if (!ho_ten || typeof ho_ten !== 'string' || !ho_ten.trim()) {
    return res.status(400).json({ error: 'Thiếu họ tên (ho_ten)!' });
  }

  if (!email || typeof email !== 'string' || !email.trim()) {
    return res.status(400).json({ error: 'Thiếu email!' });
  }

  const emailClean = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(emailClean)) {
    return res.status(400).json({ error: 'Email không hợp lệ!' });
  }

  if (!trang_thai || !['hoat_dong', 'khoa'].includes(trang_thai)) {
    return res.status(400).json({ error: 'trang_thai phải là "hoat_dong" hoặc "khoa"!' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const userResult = await client.query(`
      SELECT nd.user_id, nd.trang_thai,
             ARRAY_AGG(DISTINCT vc.ten_vai_tro) FILTER (WHERE vc.ten_vai_tro IS NOT NULL) AS vai_tro
      FROM nguoidung nd
      LEFT JOIN nguoidung_vai_tro nvt ON nd.user_id = nvt.user_id
      LEFT JOIN vai_tro_catalog vc ON nvt.vai_tro_id = vc.vai_tro_id
      WHERE nd.user_id = $1
      GROUP BY nd.user_id
    `, [userId]);

    if (userResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Người dùng không tồn tại!' });
    }

    const currentRoles = userResult.rows[0].vai_tro || [];
    const currentRole = currentRoles.includes('sinh_vien')
      ? 'sinh_vien'
      : currentRoles.includes('giang_vien')
        ? 'giang_vien'
        : currentRoles[0] || null;

    if (currentRoles.includes('admin') && trang_thai === 'khoa') {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Không thể khóa tài khoản admin!' });
    }

    if (['sinh_vien', 'giang_vien'].includes(currentRole) && userResult.rows[0].trang_thai !== 'khoa' && trang_thai === 'khoa') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Vui lòng dùng nút Khóa/Mở để xem ảnh hưởng và xác nhận khóa tài khoản!' });
    }

    const emailCheck = await client.query(
      'SELECT user_id FROM nguoidung WHERE email = $1 AND user_id != $2',
      [emailClean, userId]
    );
    if (emailCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Email đã tồn tại!' });
    }

    await client.query(
      `UPDATE nguoidung
       SET ho_ten = $1, email = $2, trang_thai = $3
       WHERE user_id = $4`,
      [ho_ten.trim(), emailClean, trang_thai, userId]
    );

    if (currentRole === 'giang_vien') {
      if (!ma_gv || typeof ma_gv !== 'string' || !ma_gv.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Thiếu mã giảng viên (ma_gv)!' });
      }

      const maGVCheck = await client.query(
        'SELECT giang_vien_id FROM giangvien WHERE ma_gv = $1 AND user_id != $2',
        [ma_gv.trim(), userId]
      );
      if (maGVCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Mã giảng viên đã tồn tại!' });
      }

      await client.query(
        `UPDATE giangvien
         SET ma_gv = $1, hoc_vi = $2
         WHERE user_id = $3`,
        [ma_gv.trim(), hoc_vi || null, userId]
      );
    }

    if (currentRole === 'sinh_vien') {
      if (!ma_sv || typeof ma_sv !== 'string' || !ma_sv.trim()) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Thiếu mã sinh viên (ma_sv)!' });
      }

      const lopId = parseInt(lop_hanh_chinh_id, 10);
      if (isNaN(lopId) || lopId <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'lop_hanh_chinh_id không hợp lệ!' });
      }

      const lopCheck = await client.query(
        'SELECT lop_hanh_chinh_id FROM lop_hanh_chinh WHERE lop_hanh_chinh_id = $1',
        [lopId]
      );
      if (lopCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `lop_hanh_chinh_id ${lopId} không tồn tại!` });
      }

      const maSVCheck = await client.query(
        'SELECT sinh_vien_id FROM sinhvien WHERE ma_sv = $1 AND user_id != $2',
        [ma_sv.trim(), userId]
      );
      if (maSVCheck.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Mã sinh viên đã tồn tại!' });
      }

      await client.query(
        `UPDATE sinhvien
         SET ma_sv = $1, lop_hanh_chinh_id = $2
         WHERE user_id = $3`,
        [ma_sv.trim(), lopId, userId]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Cập nhật người dùng thành công!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    if (err.code === '23505') {
      const detail = err.detail || '';
      if (detail.includes('email')) return res.status(409).json({ error: 'Email đã tồn tại!' });
      if (detail.includes('ma_gv')) return res.status(409).json({ error: 'Mã giảng viên đã tồn tại!' });
      if (detail.includes('ma_sv')) return res.status(409).json({ error: 'Mã sinh viên đã tồn tại!' });
      return res.status(409).json({ error: 'Dữ liệu trùng lặp!' });
    }
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Tham chiếu không hợp lệ!' });
    }
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

router.put('/nguoi-dung/:id/khoa', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'ID người dùng không hợp lệ!' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const impact = await getUserLockImpact(client, userId);
    if (!impact) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Người dùng không tồn tại!' });
    }
    if (impact.user.trang_thai !== 'khoa' && impact.requires_confirm && req.body?.confirm !== true) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Cần xác nhận khóa tài khoản!', requires_confirm: true, impact });
    }

    const result = await lockUserWithImpact(client, userId, req.user.user_id);
    if (result.error) {
      await client.query('ROLLBACK');
      return res.status(result.status || 400).json({ error: result.error });
    }

    await client.query('COMMIT');
    res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

router.get('/nguoi-dung/:id/khoa-preview', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'ID người dùng không hợp lệ!' });
  }

  const client = await pool.connect();
  try {
    const impact = await getUserLockImpact(client, userId);
    if (!impact) {
      return res.status(404).json({ error: 'Người dùng không tồn tại!' });
    }
    if (impact.primaryRole === 'admin') {
      return res.status(403).json({ error: 'Không thể khóa tài khoản admin!' });
    }
    res.json(impact);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

router.delete('/nguoi-dung/:id', async (req, res) => {
  const userId = parseInt(req.params.id, 10);
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'ID người dùng không hợp lệ!' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const impact = await getUserLockImpact(client, userId);
    if (!impact) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Người dùng không tồn tại!' });
    }
    if (impact.user.trang_thai === 'khoa') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Người dùng đã bị khóa trước đó!' });
    }

    const result = await lockUserWithImpact(client, userId, req.user.user_id);
    if (result.error) {
      await client.query('ROLLBACK');
      return res.status(result.status || 400).json({ error: result.error });
    }

    await client.query('COMMIT');
    res.json(result);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

// ===== QUẢN LÝ SINH VIÊN - LỚP HỌC PHẦN =====
// Fix: sv.lop_hanh_chinh → sv.lop_hanh_chinh_id
router.get('/sinh-vien-lhp', async (req, res) => {
  try {
    const lhpResult = parseIntParam(req.query.lop_hoc_phan_id, 'lop_hoc_phan_id');
    if (lhpResult && lhpResult.error) return res.status(400).json({ error: lhpResult.error });
    const allowedTrangThai = ['hoat_dong', 'huy', 'all'];
    const trangThai = req.query.trang_thai || 'hoat_dong';

    if (!allowedTrangThai.includes(trangThai)) {
      return res.status(400).json({ error: 'trang_thai khong hop le!' });
    }

    // Task 4 fix: phân trang limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);

    let query = `
      SELECT svlh.*, sv.ma_sv, nd.ho_ten, sv.lop_hanh_chinh_id
      FROM sinhvien_lophocphan svlh
      JOIN sinhvien sv ON svlh.sinh_vien_id = sv.sinh_vien_id
      JOIN nguoidung nd ON sv.user_id = nd.user_id
    `;
    const params = [];
    const conditions = [];
    if (lhpResult && lhpResult.value !== undefined) {
      params.push(lhpResult.value);
      conditions.push(`svlh.lop_hoc_phan_id = $${params.length}`);
    }
    if (trangThai !== 'all') {
      params.push(trangThai);
      conditions.push(`svlh.trang_thai = $${params.length}`);
    }
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ` ORDER BY svlh.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await pool.query(query, [...params, pageLimit, pageOffset]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// Fix: ngay_xep không tồn tại → bỏ, dùng DEFAULT của schema (ngay_phan_lop)
router.post('/sinh-vien-lhp', async (req, res) => {
  const { sinh_vien_id, lop_hoc_phan_id } = req.body;

  // Validate bắt buộc
  if (!sinh_vien_id || typeof sinh_vien_id !== 'number') {
    return res.status(400).json({ error: 'Thiếu hoặc sai kiểu sinh_vien_id!' });
  }
  if (!lop_hoc_phan_id || typeof lop_hoc_phan_id !== 'number') {
    return res.status(400).json({ error: 'Thiếu hoặc sai kiểu lop_hoc_phan_id!' });
  }

  try {
    // Validation FK: sinh_vien tồn tại
    const svCheck = await pool.query(
      `SELECT nd.trang_thai
       FROM sinhvien sv
       JOIN nguoidung nd ON sv.user_id = nd.user_id
       WHERE sv.sinh_vien_id = $1`,
      [sinh_vien_id]
    );
    if (svCheck.rows.length === 0) {
      return res.status(400).json({ error: `sinh_vien_id ${sinh_vien_id} không tồn tại!` });
    }

    // Validation FK: lop_hoc_phan tồn tại + lấy sĩ số
    if (svCheck.rows[0].trang_thai !== 'hoat_dong') {
      return res.status(400).json({ error: 'Sinh vien da bi khoa, khong the xep vao lop hoc phan!' });
    }

    const lhpCheck = await pool.query(
      `SELECT lhp.si_so_toi_da, lhp.trang_thai, hk.trang_thai AS hoc_ky_trang_thai,
              (SELECT COUNT(*) FROM sinhvien_lophocphan WHERE lop_hoc_phan_id = $1 AND trang_thai = $2) AS so_luong
       FROM lop_hoc_phan lhp
       JOIN hoc_ky hk ON lhp.hoc_ky_id = hk.hoc_ky_id
       WHERE lhp.lop_hoc_phan_id = $1`,
      [lop_hoc_phan_id, 'hoat_dong']
    );
    if (lhpCheck.rows.length === 0) {
      return res.status(400).json({ error: `lop_hoc_phan_id ${lop_hoc_phan_id} không tồn tại!` });
    }
    if (lhpCheck.rows[0].trang_thai !== 'hoat_dong' || lhpCheck.rows[0].hoc_ky_trang_thai === 'ket_thuc') {
      return res.status(400).json({ error: 'Không thể xếp sinh viên vào lớp học phần đã kết thúc!' });
    }

    // Kiểm tra sĩ số
    const { si_so_toi_da, so_luong } = lhpCheck.rows[0];
    if (parseInt(so_luong) >= si_so_toi_da) {
      return res.status(400).json({ error: 'Lớp học phần đã đủ sĩ số!' });
    }

    // Kiểm tra đã từng đăng ký chưa (kể cả đang 'huy')
    const existing = await pool.query(
      'SELECT id, trang_thai FROM sinhvien_lophocphan WHERE sinh_vien_id = $1 AND lop_hoc_phan_id = $2',
      [sinh_vien_id, lop_hoc_phan_id]
    );

    let result;
    if (existing.rows.length > 0) {
      // Đã đăng ký rồi (trạng thái 'huy') → khôi phục lại
      if (existing.rows[0].trang_thai === 'hoat_dong') {
        return res.status(409).json({ error: 'Sinh viên đã có trong lớp học phần này!' });
      }
      result = await pool.query(
        `UPDATE sinhvien_lophocphan SET trang_thai = 'hoat_dong' WHERE id = $1 RETURNING *`,
        [existing.rows[0].id]
      );
      return res.json({ message: 'Khôi phục sinh viên vào lớp học phần thành công!', data: result.rows[0] });
    }

    result = await pool.query(
      `INSERT INTO sinhvien_lophocphan (sinh_vien_id, lop_hoc_phan_id, trang_thai)
       VALUES ($1, $2, 'hoat_dong') RETURNING *`,
      [sinh_vien_id, lop_hoc_phan_id]
    );
    res.json({ message: 'Xếp sinh viên vào lớp học phần thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Sinh viên hoặc lớp học phần không tồn tại!' });
    }
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// Bug 7: DELETE sinh viên khỏi lớp học phần
router.delete('/sinh-vien-lhp', async (req, res) => {
  const { sinh_vien_id, lop_hoc_phan_id } = req.query;

  if (!sinh_vien_id || !lop_hoc_phan_id) {
    return res.status(400).json({ error: 'sinh_vien_id và lop_hoc_phan_id là bắt buộc!' });
  }

  const svId = parseInt(sinh_vien_id, 10);
  const lhpId = parseInt(lop_hoc_phan_id, 10);
  if (isNaN(svId) || isNaN(lhpId) || svId <= 0 || lhpId <= 0) {
    return res.status(400).json({ error: 'ID không hợp lệ!' });
  }

  try {
    // Check tồn tại
    const exist = await pool.query(
      'SELECT id, trang_thai FROM sinhvien_lophocphan WHERE sinh_vien_id = $1 AND lop_hoc_phan_id = $2',
      [svId, lhpId]
    );
    if (exist.rows.length === 0) {
      return res.status(404).json({ error: 'Sinh viên không có trong lớp học phần này!' });
    }
    if (exist.rows[0].trang_thai === 'huy') {
      return res.status(400).json({ error: 'Sinh viên đã bị xóa khỏi lớp học phần trước đó!' });
    }

    // Soft delete: cập nhật trạng thái thành 'huy'
    await pool.query(
      `UPDATE sinhvien_lophocphan SET trang_thai = 'huy'
       WHERE sinh_vien_id = $1 AND lop_hoc_phan_id = $2`,
      [svId, lhpId]
    );
    res.json({ message: 'Đã xóa sinh viên khỏi lớp học phần!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});


module.exports = router;

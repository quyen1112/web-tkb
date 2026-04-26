const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorize } = require('../middleware/auth');
const { listHocKy } = require('../services/hocKyService');

router.use(verifyToken);
router.use(authorize('sinh_vien'));

function parseIntParam(value, paramName) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return { error: `${paramName} phai la so nguyen duong!` };
  }
  return { value: num };
}

async function getSinhVienId(userId) {
  const result = await pool.query(
    'SELECT sinh_vien_id FROM sinhvien WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.sinh_vien_id || null;
}

const LATEST_TKB_FILTER = `
  tkb.tkb_id IN (
    SELECT DISTINCT ON (hoc_ky_id) tkb_id
    FROM thoi_khoa_bieu
    ORDER BY hoc_ky_id, phien_ban DESC, tkb_id DESC
  )
`;

router.get('/hoc-ky', async (req, res) => {
  try {
    const pageLimit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const data = await listHocKy(pool, { limit: pageLimit, offset: pageOffset });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/tkb-ca-nhan', async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (hocKyResult && hocKyResult.error) {
      return res.status(400).json({ error: hocKyResult.error });
    }

    const sinhVienId = await getSinhVienId(req.user.user_id);
    if (!sinhVienId) {
      return res.status(404).json({ error: 'Khong tim thay sinh vien!' });
    }

    let query = `
      SELECT
        ts.tkb_slot_id,
        ts.tkb_slot_id AS buoi_hoc_id,
        ts.tkb_id,
        ts.phan_cong_id,
        ts.phong_hoc_id,
        ts.khung_thoi_gian_id,
        NULL::date AS ngay_hoc,
        ts.hinh_thuc,
        ts.ghi_chu,
        ts.trang_thai,
        lhp.ma_lop_hp,
        lhp.ten_lop_hp,
        mh.ten_mon,
        mh.ma_mon,
        nd.ho_ten AS ten_gv,
        ph.ma_phong,
        ph.ten_phong,
        ktg.tiet_bat_dau,
        ktg.tiet_ket_thuc,
        ktg.gio_bat_dau,
        ktg.gio_ket_thuc,
        ktg.thu_trong_tuan,
        hk.ten_hoc_ky,
        hk.nam_hoc
      FROM sinhvien_lophocphan svlh
      JOIN lop_hoc_phan lhp ON svlh.lop_hoc_phan_id = lhp.lop_hoc_phan_id
      JOIN phan_cong_giang_day pcgd ON lhp.lop_hoc_phan_id = pcgd.lop_hoc_phan_id
      JOIN tkb_slot ts ON pcgd.phan_cong_id = ts.phan_cong_id
      JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
      JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
      JOIN hoc_ky hk ON tkb.hoc_ky_id = hk.hoc_ky_id
      LEFT JOIN giangvien gv ON pcgd.giang_vien_id = gv.giang_vien_id
      LEFT JOIN nguoidung nd ON gv.user_id = nd.user_id
      LEFT JOIN phong_hoc ph ON ts.phong_hoc_id = ph.phong_hoc_id
      LEFT JOIN khung_thoi_gian ktg ON ts.khung_thoi_gian_id = ktg.khung_thoi_gian_id
      WHERE svlh.sinh_vien_id = $1
        AND svlh.trang_thai = 'hoat_dong'
        AND ts.trang_thai != 'huy'
        AND ${LATEST_TKB_FILTER}
    `;
    const params = [sinhVienId];

    if (hocKyResult && hocKyResult.value !== undefined) {
      query += ' AND tkb.hoc_ky_id = $2';
      params.push(hocKyResult.value);
    }

    query += ' ORDER BY hk.nam_hoc DESC, hk.ten_hoc_ky, ktg.thu_trong_tuan, ktg.tiet_bat_dau';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/tkb-lop-hoc-phan', async (req, res) => {
  try {
    const lhpResult = parseIntParam(req.query.lop_hoc_phan_id, 'lop_hoc_phan_id');
    if (!lhpResult || lhpResult.error) {
      return res.status(400).json({ error: lhpResult?.error || 'lop_hoc_phan_id la bat buoc!' });
    }

    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (hocKyResult && hocKyResult.error) {
      return res.status(400).json({ error: hocKyResult.error });
    }

    const sinhVienId = await getSinhVienId(req.user.user_id);
    if (!sinhVienId) {
      return res.status(404).json({ error: 'Khong tim thay sinh vien!' });
    }

    const enrolledCheck = await pool.query(
      `SELECT 1
       FROM sinhvien_lophocphan
       WHERE sinh_vien_id = $1 AND lop_hoc_phan_id = $2 AND trang_thai = 'hoat_dong'`,
      [sinhVienId, lhpResult.value]
    );
    if (enrolledCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Ban khong co quyen xem TKB cua lop hoc phan nay!' });
    }

    let query = `
      SELECT
        ts.tkb_slot_id,
        ts.tkb_slot_id AS buoi_hoc_id,
        ts.tkb_id,
        ts.phan_cong_id,
        ts.phong_hoc_id,
        ts.khung_thoi_gian_id,
        NULL::date AS ngay_hoc,
        ts.hinh_thuc,
        ts.ghi_chu,
        ts.trang_thai,
        lhp.ma_lop_hp,
        lhp.ten_lop_hp,
        mh.ten_mon,
        mh.ma_mon,
        nd.ho_ten AS ten_gv,
        ph.ma_phong,
        ph.ten_phong,
        ktg.tiet_bat_dau,
        ktg.tiet_ket_thuc,
        ktg.gio_bat_dau,
        ktg.gio_ket_thuc,
        ktg.thu_trong_tuan,
        hk.ten_hoc_ky,
        hk.nam_hoc
      FROM tkb_slot ts
      JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
      JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
      JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
      JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
      JOIN hoc_ky hk ON tkb.hoc_ky_id = hk.hoc_ky_id
      LEFT JOIN giangvien gv ON pcgd.giang_vien_id = gv.giang_vien_id
      LEFT JOIN nguoidung nd ON gv.user_id = nd.user_id
      LEFT JOIN phong_hoc ph ON ts.phong_hoc_id = ph.phong_hoc_id
      LEFT JOIN khung_thoi_gian ktg ON ts.khung_thoi_gian_id = ktg.khung_thoi_gian_id
      WHERE lhp.lop_hoc_phan_id = $1
        AND ts.trang_thai != 'huy'
        AND ${LATEST_TKB_FILTER}
    `;
    const params = [lhpResult.value];

    if (hocKyResult && hocKyResult.value !== undefined) {
      query += ' AND tkb.hoc_ky_id = $2';
      params.push(hocKyResult.value);
    }

    query += ' ORDER BY ktg.thu_trong_tuan, ktg.tiet_bat_dau';
    const pageLimit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    query += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const result = await pool.query(query, [...params, pageLimit, pageOffset]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/thong-bao', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tb.*, nd.ho_ten AS nguoi_tao, bh.ngay_hoc, tbnr.da_doc, tbnr.thoi_gian_doc
       FROM thong_bao_nguoi_nhan tbnr
       JOIN thong_bao tb ON tbnr.thong_bao_id = tb.thong_bao_id
       LEFT JOIN nguoidung nd ON tb.nguoi_tao_id = nd.user_id
       LEFT JOIN buoi_hoc bh ON tb.buoi_hoc_id = bh.buoi_hoc_id
       WHERE tbnr.nguoi_dung_id = $1
       ORDER BY tb.ngay_tao DESC`,
      [req.user.user_id]
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/thong-bao/unread-count', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT COUNT(*)::int AS unread_count
       FROM thong_bao_nguoi_nhan
       WHERE nguoi_dung_id = $1 AND COALESCE(da_doc, false) = false`,
      [req.user.user_id]
    );

    res.json({ unread_count: result.rows[0]?.unread_count || 0 });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.put('/thong-bao/:id/doc', async (req, res) => {
  try {
    const tbResult = parseIntParam(req.params.id, 'thong_bao_id');
    if (!tbResult || tbResult.error) {
      return res.status(400).json({ error: tbResult?.error || 'thong_bao_id khong hop le!' });
    }

    const result = await pool.query(
      `UPDATE thong_bao_nguoi_nhan
       SET da_doc = true, thoi_gian_doc = NOW()
       WHERE thong_bao_id = $1 AND nguoi_dung_id = $2
       RETURNING thong_bao_id`,
      [tbResult.value, req.user.user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Thong bao khong ton tai hoac khong thuoc ve ban!' });
    }

    res.json({ message: 'Da danh dau da doc!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorize } = require('../middleware/auth');
const { listHocKy } = require('../services/hocKyService');

router.use(verifyToken);
router.use(authorize('giang_vien'));

function parseIntParam(value, paramName) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return { error: `${paramName} phai la so nguyen duong!` };
  }
  return { value: num };
}

async function getGiangVienId(userId) {
  const result = await pool.query(
    'SELECT giang_vien_id FROM giangvien WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.giang_vien_id || null;
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

router.get('/khung-thoi-gian', async (req, res) => {
  try {
    const pageLimit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset, 10) || 0);
    const result = await pool.query(
      'SELECT * FROM khung_thoi_gian ORDER BY thu_trong_tuan, tiet_bat_dau LIMIT $1 OFFSET $2',
      [pageLimit, pageOffset]
    );

    res.json(result.rows);
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

    const giangVienId = await getGiangVienId(req.user.user_id);
    if (!giangVienId) {
      return res.status(404).json({ error: 'Khong tim thay giang vien!' });
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
        ph.ma_phong,
        ph.ten_phong,
        ktg.tiet_bat_dau,
        ktg.tiet_ket_thuc,
        ktg.gio_bat_dau,
        ktg.gio_ket_thuc,
        ktg.thu_trong_tuan,
        hk.ten_hoc_ky,
        hk.nam_hoc,
        pcgd.vai_tro_phu_trach
      FROM tkb_slot ts
      JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
      JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
      JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
      JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
      JOIN hoc_ky hk ON tkb.hoc_ky_id = hk.hoc_ky_id
      LEFT JOIN phong_hoc ph ON ts.phong_hoc_id = ph.phong_hoc_id
      LEFT JOIN khung_thoi_gian ktg ON ts.khung_thoi_gian_id = ktg.khung_thoi_gian_id
      WHERE pcgd.giang_vien_id = $1
        AND ts.trang_thai != 'huy'
        AND ${LATEST_TKB_FILTER}
    `;
    const params = [giangVienId];

    if (hocKyResult && hocKyResult.value !== undefined) {
      query += ' AND tkb.hoc_ky_id = $2';
      params.push(hocKyResult.value);
    }

    query += ' ORDER BY hk.nam_hoc DESC, hk.ten_hoc_ky, ktg.thu_trong_tuan, ktg.tiet_bat_dau';

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

router.post('/khai-bao-lich-ban', async (req, res) => {
  try {
    const giangVienId = await getGiangVienId(req.user.user_id);
    if (!giangVienId) {
      return res.status(404).json({ error: 'Khong tim thay giang vien!' });
    }

    const { hoc_ky_id, khung_thoi_gian_id, ngay_cu_the, ly_do } = req.body;

    if (!hoc_ky_id || typeof hoc_ky_id !== 'number') {
      return res.status(400).json({ error: 'Thieu hoac sai kieu hoc_ky_id!' });
    }
    if (!khung_thoi_gian_id || typeof khung_thoi_gian_id !== 'number') {
      return res.status(400).json({ error: 'Thieu hoac sai kieu khung_thoi_gian_id!' });
    }
    if (ngay_cu_the && Number.isNaN(Date.parse(ngay_cu_the))) {
      return res.status(400).json({ error: 'ngay_cu_the khong dung dinh dang ngay!' });
    }

    const hkCheck = await pool.query('SELECT 1 FROM hoc_ky WHERE hoc_ky_id = $1', [hoc_ky_id]);
    if (hkCheck.rows.length === 0) {
      return res.status(400).json({ error: `hoc_ky_id ${hoc_ky_id} khong ton tai!` });
    }

    const ktgCheck = await pool.query('SELECT 1 FROM khung_thoi_gian WHERE khung_thoi_gian_id = $1', [khung_thoi_gian_id]);
    if (ktgCheck.rows.length === 0) {
      return res.status(400).json({ error: `khung_thoi_gian_id ${khung_thoi_gian_id} khong ton tai!` });
    }

    if (ngay_cu_the) {
      const result = await pool.query(
        `INSERT INTO lich_ban_ngay (giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ngay_cu_the, ly_do, trang_thai)
         VALUES ($1, $2, $3, $4, $5, 'cho_duyet') RETURNING *`,
        [giangVienId, hoc_ky_id, khung_thoi_gian_id, ngay_cu_the, ly_do]
      );
      return res.json({ message: 'Khai bao lich ban ngay thanh cong! Dang cho phe duyet.', data: result.rows[0] });
    }

    const result = await pool.query(
      `INSERT INTO lich_ban_tuan (giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ly_do, trang_thai)
       VALUES ($1, $2, $3, $4, 'cho_duyet') RETURNING *`,
      [giangVienId, hoc_ky_id, khung_thoi_gian_id, ly_do]
    );
    res.json({ message: 'Khai bao lich ban tuan thanh cong! Dang cho phe duyet.', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/lich-ban', async (req, res) => {
  try {
    const giangVienId = await getGiangVienId(req.user.user_id);
    if (!giangVienId) {
      return res.status(404).json({ error: 'Khong tim thay giang vien!' });
    }

    const [rowsTuan, rowsNgay] = await Promise.all([
      pool.query(
        `SELECT lbt.lich_ban_tuan_id AS id, 'tuan' AS loai_ban,
                lbt.giang_vien_id, lbt.hoc_ky_id, lbt.khung_thoi_gian_id,
                NULL AS ngay_cu_the, lbt.ly_do, lbt.trang_thai,
                ktg.mo_ta AS ca_hoc, hk.ten_hoc_ky, hk.nam_hoc
         FROM lich_ban_tuan lbt
         LEFT JOIN khung_thoi_gian ktg ON lbt.khung_thoi_gian_id = ktg.khung_thoi_gian_id
         LEFT JOIN hoc_ky hk ON lbt.hoc_ky_id = hk.hoc_ky_id
         WHERE lbt.giang_vien_id = $1
         ORDER BY lbt.trang_thai, ktg.thu_trong_tuan, ktg.tiet_bat_dau`,
        [giangVienId]
      ),
      pool.query(
        `SELECT lbn.lich_ban_ngay_id AS id, 'ngay' AS loai_ban,
                lbn.giang_vien_id, lbn.hoc_ky_id, lbn.khung_thoi_gian_id,
                lbn.ngay_cu_the, lbn.ly_do, lbn.trang_thai,
                ktg.mo_ta AS ca_hoc, hk.ten_hoc_ky, hk.nam_hoc
         FROM lich_ban_ngay lbn
         LEFT JOIN khung_thoi_gian ktg ON lbn.khung_thoi_gian_id = ktg.khung_thoi_gian_id
         LEFT JOIN hoc_ky hk ON lbn.hoc_ky_id = hk.hoc_ky_id
         WHERE lbn.giang_vien_id = $1
         ORDER BY lbn.ngay_cu_the DESC, ktg.tiet_bat_dau`,
        [giangVienId]
      ),
    ]);

    res.json([...rowsTuan.rows, ...rowsNgay.rows]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/yeu-cau-dieu-chinh', async (req, res) => {
  try {
    const giangVienId = await getGiangVienId(req.user.user_id);
    if (!giangVienId) {
      return res.status(404).json({ error: 'Khong tim thay giang vien!' });
    }

    const { trang_thai } = req.query;
    const allowedTrangThai = ['cho_duyet', 'da_duyet', 'tu_choi'];
    if (trang_thai && !allowedTrangThai.includes(trang_thai)) {
      return res.status(400).json({ error: 'trang_thai khong hop le!' });
    }

    let query = `
      SELECT
        yc.yeu_cau_id,
        yc.tkb_slot_id,
        yc.tkb_slot_id AS buoi_hoc_id,
        yc.trang_thai,
        yc.ly_do,
        yc.noi_dung_de_xuat,
        yc.ngay_gui,
        yc.ngay_ap_dung,
        yc.ngay_ap_dung AS ngay_hoc,
        lytc.ten_loai AS ten_loai_yeu_cau,
        lhp.ma_lop_hp,
        lhp.ten_lop_hp,
        mh.ten_mon,
        ph.ten_phong,
        ktg.tiet_bat_dau,
        ktg.tiet_ket_thuc,
        ktg.thu_trong_tuan,
        nd_duyet.ho_ten AS nguoi_phan_duyet
      FROM yeu_cau_dieu_chinh yc
      JOIN loai_yeu_cau_catalog lytc ON yc.loai_yeu_cau_id = lytc.loai_yeu_cau_id
      JOIN tkb_slot ts ON yc.tkb_slot_id = ts.tkb_slot_id
      JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
      JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
      JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
      LEFT JOIN phong_hoc ph ON ts.phong_hoc_id = ph.phong_hoc_id
      LEFT JOIN khung_thoi_gian ktg ON ts.khung_thoi_gian_id = ktg.khung_thoi_gian_id
      LEFT JOIN nguoidung nd_duyet ON yc.nguoi_phan_duyet_id = nd_duyet.user_id
      WHERE yc.giang_vien_id = $1
    `;
    const params = [giangVienId];

    if (trang_thai) {
      query += ' AND yc.trang_thai = $2';
      params.push(trang_thai);
    }

    query += ' ORDER BY yc.ngay_gui DESC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.post('/yeu-cau-dieu-chinh', async (req, res) => {
  try {
    const giangVienId = await getGiangVienId(req.user.user_id);
    if (!giangVienId) {
      return res.status(404).json({ error: 'Khong tim thay giang vien!' });
    }

    const { tkb_slot_id, loai_yeu_cau_id, ly_do, noi_dung_de_xuat, ngay_ap_dung = null } = req.body;

    if (!tkb_slot_id || typeof tkb_slot_id !== 'number') {
      return res.status(400).json({ error: 'Thieu hoac sai kieu tkb_slot_id!' });
    }
    if (!loai_yeu_cau_id || typeof loai_yeu_cau_id !== 'number') {
      return res.status(400).json({ error: 'Thieu hoac sai kieu loai_yeu_cau_id!' });
    }

    const loaiCheck = await pool.query(
      'SELECT 1 FROM loai_yeu_cau_catalog WHERE loai_yeu_cau_id = $1',
      [loai_yeu_cau_id]
    );
    if (loaiCheck.rows.length === 0) {
      return res.status(400).json({ error: `loai_yeu_cau_id ${loai_yeu_cau_id} khong ton tai!` });
    }

    const ownerCheck = await pool.query(
      `SELECT 1
       FROM tkb_slot ts
       JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
       WHERE ts.tkb_slot_id = $1
         AND ts.trang_thai != 'huy'
         AND pcgd.giang_vien_id = $2`,
      [tkb_slot_id, giangVienId]
    );
    if (ownerCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Ban khong co quyen gui yeu cau cho slot TKB nay!' });
    }

    const result = await pool.query(
      `INSERT INTO yeu_cau_dieu_chinh (
          tkb_slot_id, giang_vien_id, loai_yeu_cau_id, ly_do, noi_dung_de_xuat, ngay_ap_dung, trang_thai, ngay_gui
       )
       VALUES ($1, $2, $3, $4, $5, $6, 'cho_duyet', NOW())
       RETURNING *`,
      [tkb_slot_id, giangVienId, loai_yeu_cau_id, ly_do, noi_dung_de_xuat, ngay_ap_dung]
    );

    res.json({ message: 'Gui yeu cau dieu chinh thanh cong!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/thong-bao', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT tb.*, nd.ho_ten AS nguoi_tao, bh.ngay_hoc,
              tbnr.da_doc, tbnr.thoi_gian_doc, tbnr.trang_thai_gui
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

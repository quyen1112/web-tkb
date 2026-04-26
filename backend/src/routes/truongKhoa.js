const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorize } = require('../middleware/auth');
const { listHocKy } = require('../services/hocKyService');

router.use(verifyToken);

const authorizeRead = authorize('truong_khoa', 'admin', 'giao_vu');
const authorizeWrite = authorize('truong_khoa', 'admin');

function parseIntParam(value, paramName) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return { error: `${paramName} phai la so nguyen duong!` };
  }
  return { value: num };
}

const LATEST_TKB_FILTER = `
  tkb.tkb_id IN (
    SELECT DISTINCT ON (hoc_ky_id) tkb_id
    FROM thoi_khoa_bieu
    ORDER BY hoc_ky_id, phien_ban DESC, tkb_id DESC
  )
`;

router.get('/hoc-ky', authorizeRead, async (req, res) => {
  try {
    const pageLimit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    const data = await listHocKy(pool, { limit: pageLimit, offset: pageOffset });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/thoi-khoa-bieu', authorizeRead, async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (!hocKyResult || hocKyResult.error) {
      return res.status(400).json({ error: hocKyResult?.error || 'hoc_ky_id la bat buoc!' });
    }

    const pageLimit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 100));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    const includeMeta = ['1', 'true'].includes(String(req.query.include_meta || '').toLowerCase());

    const tkbResult = await pool.query(
      `SELECT tkb_id, hoc_ky_id, trang_thai, ghi_chu, phien_ban
       FROM thoi_khoa_bieu
       WHERE hoc_ky_id = $1
       ORDER BY phien_ban DESC, tkb_id DESC
       LIMIT 1`,
      [hocKyResult.value]
    );

    const currentTKB = tkbResult.rows[0] || null;
    const result = currentTKB
      ? await pool.query(
          `SELECT
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
             nd.email AS email_gv,
             ph.ma_phong,
             ph.ten_phong,
             ktg.tiet_bat_dau,
             ktg.tiet_ket_thuc,
             ktg.gio_bat_dau,
             ktg.gio_ket_thuc,
             ktg.thu_trong_tuan
           FROM tkb_slot ts
           JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
           JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
           JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
           JOIN giangvien gv ON pcgd.giang_vien_id = gv.giang_vien_id
           JOIN nguoidung nd ON gv.user_id = nd.user_id
           LEFT JOIN phong_hoc ph ON ts.phong_hoc_id = ph.phong_hoc_id
           LEFT JOIN khung_thoi_gian ktg ON ts.khung_thoi_gian_id = ktg.khung_thoi_gian_id
           WHERE ts.tkb_id = $1 AND ts.trang_thai != 'huy'
           ORDER BY ktg.thu_trong_tuan, ktg.tiet_bat_dau
           LIMIT $2 OFFSET $3`,
          [currentTKB.tkb_id, pageLimit, pageOffset]
        )
      : { rows: [] };

    if (includeMeta) {
      return res.json({
        tkb: currentTKB,
        slots: result.rows,
        buoi_hoc: result.rows,
      });
    }

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/yeu-cau-dieu-chinh', authorizeRead, async (req, res) => {
  try {
    const { trang_thai } = req.query;
    const allowedTrangThai = ['cho_duyet', 'da_duyet', 'tu_choi'];
    if (trang_thai && !allowedTrangThai.includes(trang_thai)) {
      return res.status(400).json({ error: 'trang_thai khong hop le!' });
    }

    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

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
        nd.ho_ten AS ten_gv,
        nd2.ho_ten AS nguoi_phan_duyet,
        lytc.ten_loai AS loai_yeu_cau,
        lytc.ten_loai AS ten_loai_yeu_cau,
        lhp.ma_lop_hp,
        lhp.ten_lop_hp,
        mh.ten_mon,
        ph.ten_phong,
        ktg.tiet_bat_dau,
        ktg.tiet_ket_thuc,
        ktg.thu_trong_tuan,
        pcgd.phan_cong_id
      FROM yeu_cau_dieu_chinh yc
      JOIN giangvien gv ON yc.giang_vien_id = gv.giang_vien_id
      JOIN nguoidung nd ON gv.user_id = nd.user_id
      JOIN tkb_slot ts ON yc.tkb_slot_id = ts.tkb_slot_id
      JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
      JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
      JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
      JOIN loai_yeu_cau_catalog lytc ON yc.loai_yeu_cau_id = lytc.loai_yeu_cau_id
      LEFT JOIN nguoidung nd2 ON yc.nguoi_phan_duyet_id = nd2.user_id
      LEFT JOIN phong_hoc ph ON ts.phong_hoc_id = ph.phong_hoc_id
      LEFT JOIN khung_thoi_gian ktg ON ts.khung_thoi_gian_id = ktg.khung_thoi_gian_id
    `;
    const params = [];
    const countParams = [];
    let countQuery = 'SELECT COUNT(*) AS total FROM yeu_cau_dieu_chinh yc';

    if (trang_thai) {
      query += ' WHERE yc.trang_thai = $1';
      countQuery += ' WHERE yc.trang_thai = $1';
      params.push(trang_thai);
      countParams.push(trang_thai);
    }

    query += ` ORDER BY yc.ngay_gui DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(query, [...params, limit, offset]),
      pool.query(countQuery, countParams),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    res.json({
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        total_pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.put('/yeu-cau-dieu-chinh/:id/duyet', authorizeWrite, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { hanh_dong, noi_dung_phan_hoi } = req.body;
    const idResult = parseIntParam(req.params.id, 'yeu_cau_id');
    if (!idResult || idResult.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: idResult?.error || 'ID khong hop le!' });
    }

    if (!['dong_y', 'tu_choi'].includes(hanh_dong)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'hanh_dong phai la "dong_y" hoac "tu_choi"!' });
    }

    const ycResult = await client.query(
      'SELECT * FROM yeu_cau_dieu_chinh WHERE yeu_cau_id = $1',
      [idResult.value]
    );
    if (ycResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Khong tim thay yeu cau!' });
    }

    if (ycResult.rows[0].trang_thai !== 'cho_duyet') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Yeu cau dang o trang thai "${ycResult.rows[0].trang_thai}", khong the xu ly lai!` });
    }

    const trangThaiMoi = hanh_dong === 'dong_y' ? 'da_duyet' : 'tu_choi';

    await client.query(
      `UPDATE yeu_cau_dieu_chinh
       SET trang_thai = $1, nguoi_phan_duyet_id = $2
       WHERE yeu_cau_id = $3`,
      [trangThaiMoi, req.user.user_id, idResult.value]
    );

    await client.query(
      `INSERT INTO phan_hoi_yeu_cau (yeu_cau_id, nguoi_phan_hoi_id, hanh_dong_id, noi_dung_phan_hoi, ngay_phan_hoi)
       VALUES ($1, $2,
         (SELECT hanh_dong_id FROM hanh_dong_catalog WHERE ma_hanh_dong = $3),
         $4, NOW())`,
      [idResult.value, req.user.user_id, hanh_dong, noi_dung_phan_hoi]
    );

    if (hanh_dong === 'dong_y' && ycResult.rows[0].noi_dung_de_xuat) {
      await client.query(
        `UPDATE tkb_slot
         SET ghi_chu = CONCAT(COALESCE(ghi_chu, ''), CASE WHEN COALESCE(ghi_chu, '') = '' THEN '' ELSE E'\\n' END, '[DIEU CHINH]: ', $1)
         WHERE tkb_slot_id = $2`,
        [ycResult.rows[0].noi_dung_de_xuat, ycResult.rows[0].tkb_slot_id]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Phe duyet thanh cong!' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  } finally {
    client.release();
  }
});

router.put('/phe-duyet-tkb/:tkb_id', authorizeWrite, async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.tkb_id, 'tkb_id');
    if (!idResult || idResult.error) {
      return res.status(400).json({ error: idResult?.error || 'tkb_id khong hop le!' });
    }

    const check = await pool.query('SELECT trang_thai FROM thoi_khoa_bieu WHERE tkb_id = $1', [idResult.value]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Thoi khoa bieu khong ton tai!' });
    }
    if (check.rows[0].trang_thai !== 'cho_phe_duyet') {
      return res.status(400).json({ error: `TKB dang o trang thai "${check.rows[0].trang_thai}", chi phe duyet khi dang "cho_phe_duyet"!` });
    }

    await pool.query(
      `UPDATE thoi_khoa_bieu
       SET trang_thai = 'da_phe_duyet'
       WHERE tkb_id = $1`,
      [idResult.value]
    );

    res.json({ message: 'Phe duyet TKB thanh cong!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.put('/tu-choi-tkb/:tkb_id', authorizeWrite, async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.tkb_id, 'tkb_id');
    if (!idResult || idResult.error) {
      return res.status(400).json({ error: idResult?.error || 'tkb_id khong hop le!' });
    }

    const check = await pool.query('SELECT trang_thai FROM thoi_khoa_bieu WHERE tkb_id = $1', [idResult.value]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Thoi khoa bieu khong ton tai!' });
    }
    if (check.rows[0].trang_thai !== 'cho_phe_duyet') {
      return res.status(400).json({ error: `TKB dang o trang thai "${check.rows[0].trang_thai}", chi tu choi khi dang "cho_phe_duyet"!` });
    }

    await pool.query(
      `UPDATE thoi_khoa_bieu
       SET trang_thai = 'nhap'
       WHERE tkb_id = $1`,
      [idResult.value]
    );

    res.json({ message: 'Da tu choi TKB. Giao vu co the chinh sua va gui lai.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/thong-bao/unread-count', authorizeRead, async (req, res) => {
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

router.get('/bao-cao', authorizeRead, async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (!hocKyResult || hocKyResult.error) {
      return res.status(400).json({ error: hocKyResult?.error || 'hoc_ky_id la bat buoc!' });
    }

    const [statsResult, lhpResult, giangVienResult, lopHocPhanResult] = await Promise.all([
      pool.query(
        `SELECT
           COUNT(DISTINCT pcgd.giang_vien_id) AS so_gv,
           COUNT(DISTINCT ts.phong_hoc_id) AS so_phong,
           COUNT(ts.tkb_slot_id) AS so_slot
         FROM tkb_slot ts
         JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
         JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
         WHERE tkb.hoc_ky_id = $1
           AND ts.trang_thai != 'huy'
           AND ${LATEST_TKB_FILTER}`,
        [hocKyResult.value]
      ),
      pool.query(
        'SELECT COUNT(*) AS tong_lhp FROM lop_hoc_phan WHERE hoc_ky_id = $1',
        [hocKyResult.value]
      ),
      pool.query(
        `SELECT
           gv.giang_vien_id,
           gv.ma_gv,
           gv.hoc_vi,
           nd.ho_ten AS ten_gv,
           nd.email,
           COUNT(DISTINCT pcgd.lop_hoc_phan_id) AS so_lop_hoc_phan,
           COUNT(DISTINCT ts.tkb_slot_id) FILTER (WHERE ts.trang_thai != 'huy' AND ${LATEST_TKB_FILTER}) AS so_buoi_hoc
         FROM giangvien gv
         JOIN nguoidung nd ON gv.user_id = nd.user_id
         JOIN phan_cong_giang_day pcgd ON gv.giang_vien_id = pcgd.giang_vien_id
         JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
         LEFT JOIN tkb_slot ts ON ts.phan_cong_id = pcgd.phan_cong_id
         LEFT JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
         WHERE lhp.hoc_ky_id = $1
         GROUP BY gv.giang_vien_id, gv.ma_gv, gv.hoc_vi, nd.ho_ten, nd.email
         ORDER BY nd.ho_ten`,
        [hocKyResult.value]
      ),
      pool.query(
        `SELECT
           lhp.lop_hoc_phan_id,
           lhp.ma_lop_hp,
           lhp.ten_lop_hp,
           mh.ma_mon,
           mh.ten_mon,
           STRING_AGG(DISTINCT nd.ho_ten, ', ') FILTER (WHERE nd.ho_ten IS NOT NULL) AS giang_vien,
           COUNT(DISTINCT pcgd.giang_vien_id) AS so_giang_vien,
           COUNT(DISTINCT ts.tkb_slot_id) FILTER (WHERE ts.trang_thai != 'huy' AND ${LATEST_TKB_FILTER}) AS so_buoi_hoc
         FROM lop_hoc_phan lhp
         JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
         LEFT JOIN phan_cong_giang_day pcgd ON lhp.lop_hoc_phan_id = pcgd.lop_hoc_phan_id
         LEFT JOIN giangvien gv ON pcgd.giang_vien_id = gv.giang_vien_id
         LEFT JOIN nguoidung nd ON gv.user_id = nd.user_id
         LEFT JOIN tkb_slot ts ON ts.phan_cong_id = pcgd.phan_cong_id
         LEFT JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
         WHERE lhp.hoc_ky_id = $1
         GROUP BY lhp.lop_hoc_phan_id, lhp.ma_lop_hp, lhp.ten_lop_hp, mh.ma_mon, mh.ten_mon
         ORDER BY lhp.ma_lop_hp`,
        [hocKyResult.value]
      ),
    ]);

    res.json({
      so_giang_vien: parseInt(statsResult.rows[0]?.so_gv || 0, 10),
      so_lop_hoc_phan: parseInt(lhpResult.rows[0]?.tong_lhp || 0, 10),
      so_phong_hoc: parseInt(statsResult.rows[0]?.so_phong || 0, 10),
      so_buoi_hoc: parseInt(statsResult.rows[0]?.so_slot || 0, 10),
      giang_vien: giangVienResult.rows,
      lop_hoc_phan: lopHocPhanResult.rows,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

module.exports = router;

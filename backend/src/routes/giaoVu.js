const express = require('express');
const router = express.Router();
const pool = require('../config/db');
const { verifyToken, authorize } = require('../middleware/auth');
const { listHocKy } = require('../services/hocKyService');

// Áp dụng auth cho tất cả routes
router.use(verifyToken);
router.use(authorize('giao_vu', 'admin'));

// ===== HELPER =====
/**
 * Parse query param thành số nguyên dương.
 * Trả về { value: number } nếu hợp lệ (hoặc undefined nếu param trống/không tồn tại).
 * Trả về { error: string } nếu không hợp lệ.
 */
function parseIntParam(value, paramName) {
  if (value === undefined || value === null || value === '') return undefined;
  const num = Number(value);
  if (!Number.isInteger(num) || num <= 0) {
    return { error: `${paramName} phải là số nguyên dương!` };
  }
  return { value: num };
}

function isSundayDate(value) {
  if (!value) return false;
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCDay() === 0
  );
}

function isMondayDate(value) {
  if (!value) return false;
  const raw = value instanceof Date ? value.toISOString().slice(0, 10) : String(value).slice(0, 10);
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day &&
    date.getUTCDay() === 1
  );
}

function buildMaLopHocPhanPrefix({ nam_hoc, ten_hoc_ky, ma_mon }) {
  const firstYear = String(nam_hoc || '').match(/\d{4}/)?.[0];
  const hocKyNumber = String(ten_hoc_ky || '').match(/\d+/)?.[0];
  const maMon = String(ma_mon || '').trim();

  if (!firstYear) return { error: 'nam_hoc không hợp lệ, không thể sinh mã lớp học phần!' };
  if (!hocKyNumber || Number(hocKyNumber) <= 0) {
    return { error: 'ten_hoc_ky không hợp lệ, không thể sinh mã lớp học phần!' };
  }
  if (!maMon) return { error: 'ma_mon không hợp lệ, không thể sinh mã lớp học phần!' };

  return {
    value: `${firstYear.slice(-2)}${Number(hocKyNumber)}${maMon}`,
  };
}

const TEN_VIET_TAT_MON_HOC = {
  CS101: 'NMLT',
  CS102: 'THVP',
  CS201: 'CTDL',
  CS302: 'Mạng MT',
  AD212: 'Hùng biện',
  IS430: 'Blockchain',
};

function getTenVietTatMonHoc({ ma_mon, ten_mon }) {
  const maMon = String(ma_mon || '').trim();
  if (TEN_VIET_TAT_MON_HOC[maMon]) return TEN_VIET_TAT_MON_HOC[maMon];

  const tenMon = String(ten_mon || '').trim();
  if (!tenMon) return maMon || 'LHP';

  return tenMon
    .split(/\s+/)
    .filter(word => !['và', 'va'].includes(word.toLowerCase()))
    .map(word => word[0])
    .join('')
    .toUpperCase();
}

async function generateMaLopHocPhan(client, { hoc_ky_id, mon_hoc_id, prefix }) {
  const existing = await client.query(
    `SELECT ma_lop_hp
     FROM lop_hoc_phan
     WHERE hoc_ky_id = $1
       AND mon_hoc_id = $2
       AND LEFT(ma_lop_hp, $3) = $4`,
    [hoc_ky_id, mon_hoc_id, prefix.length, prefix]
  );

  const maxIndex = existing.rows.reduce((max, row) => {
    const suffix = String(row.ma_lop_hp || '').slice(prefix.length);
    if (!/^\d{2}$/.test(suffix)) return max;
    return Math.max(max, Number(suffix));
  }, 0);

  const nextIndex = maxIndex + 1;
  if (nextIndex > 99) {
    return { error: 'Đã đạt tối đa 99 lớp học phần cho môn này trong học kỳ!' };
  }

  return { value: `${prefix}${String(nextIndex).padStart(2, '0')}` };
}

const LATEST_TKB_FILTER = `
  tkb.tkb_id IN (
    SELECT DISTINCT ON (hoc_ky_id) tkb_id
    FROM thoi_khoa_bieu
    ORDER BY hoc_ky_id, phien_ban DESC, tkb_id DESC
  )
`;

async function closeLopHocPhanForEndedHocKy(client, hocKyWhereSql, params = []) {
  await client.query(
    `
    WITH ended_hoc_ky AS (
      SELECT hoc_ky_id
      FROM hoc_ky
      WHERE ${hocKyWhereSql}
    )
    UPDATE lop_hoc_phan
    SET trang_thai = 'ket_thuc'
    WHERE hoc_ky_id IN (SELECT hoc_ky_id FROM ended_hoc_ky)
      AND trang_thai != 'ket_thuc'
    `,
    params
  );
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

// ===== QUẢN LÝ HỌC KỲ =====
router.get('/hoc-ky', async (req, res) => {
  try {
    // Task 4 fix: phân trang limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    const data = await listHocKy(pool, { limit: pageLimit, offset: pageOffset });
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/hoc-ky', async (req, res) => {
  const client = await pool.connect();
  try {
    const { ten_hoc_ky, nam_hoc, ngay_bat_dau, ngay_ket_thuc } = req.body;

    // Validation: required
    if (!ten_hoc_ky)     return res.status(400).json({ error: 'ten_hoc_ky là bắt buộc!' });
    if (!nam_hoc)        return res.status(400).json({ error: 'nam_hoc là bắt buộc!' });
    if (!ngay_bat_dau)  return res.status(400).json({ error: 'ngay_bat_dau là bắt buộc!' });
    if (!ngay_ket_thuc) return res.status(400).json({ error: 'ngay_ket_thuc là bắt buộc!' });

    // Bug 4: check trùng UNIQUE (nam_hoc, ten_hoc_ky)
    const dupHK = await client.query(
      'SELECT 1 FROM hoc_ky WHERE nam_hoc = $1 AND ten_hoc_ky = $2',
      [nam_hoc, ten_hoc_ky]
    );
    if (dupHK.rows.length > 0) {
      return res.status(409).json({ error: `Học kỳ "${ten_hoc_ky}" năm "${nam_hoc}" đã tồn tại!` });
    }

    if (ngay_bat_dau > ngay_ket_thuc) {
      return res.status(400).json({ error: 'ngay_bat_dau phải trước hoặc bằng ngay_ket_thuc!' });
    }
    if (!isMondayDate(ngay_bat_dau)) {
      return res.status(400).json({ error: 'ngay_bat_dau phai la Thu 2!' });
    }
    if (!isSundayDate(ngay_ket_thuc)) {
      return res.status(400).json({ error: 'ngay_ket_thuc phai la Chu nhat!' });
    }

    await client.query('BEGIN');
    await client.query("UPDATE hoc_ky SET trang_thai = 'ket_thuc' WHERE trang_thai = 'hoat_dong'");
    await closeLopHocPhanForEndedHocKy(client, "trang_thai = 'ket_thuc'");

    const result = await client.query(
      "INSERT INTO hoc_ky (ten_hoc_ky, nam_hoc, ngay_bat_dau, ngay_ket_thuc, trang_thai) VALUES ($1, $2, $3, $4, 'hoat_dong') RETURNING *",
      [ten_hoc_ky, nam_hoc, ngay_bat_dau, ngay_ket_thuc]
    );

    await client.query('COMMIT');
    res.json({ message: 'Thêm học kỳ thành công!', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});
router.put('/hoc-ky/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const idResult = parseIntParam(req.params.id, 'hoc_ky_id');
    if (!idResult || idResult.error) {
      return res.status(400).json({ error: idResult?.error || 'hoc_ky_id không hợp lệ!' });
    }

    const { ten_hoc_ky, nam_hoc, ngay_bat_dau, ngay_ket_thuc, trang_thai } = req.body;
    const allowedTrangThai = ['hoat_dong', 'ket_thuc'];

    if (!ten_hoc_ky)    return res.status(400).json({ error: 'ten_hoc_ky là bắt buộc!' });
    if (!nam_hoc)       return res.status(400).json({ error: 'nam_hoc là bắt buộc!' });
    if (!ngay_bat_dau)  return res.status(400).json({ error: 'ngay_bat_dau là bắt buộc!' });
    if (!ngay_ket_thuc) return res.status(400).json({ error: 'ngay_ket_thuc là bắt buộc!' });
    if (!trang_thai || !allowedTrangThai.includes(trang_thai)) {
      return res.status(400).json({ error: 'trang_thai phải là "hoat_dong" hoặc "ket_thuc"!' });
    }

    if (ngay_bat_dau > ngay_ket_thuc) {
      return res.status(400).json({ error: 'ngay_bat_dau phải trước hoặc bằng ngay_ket_thuc!' });
    }
    if (!isMondayDate(ngay_bat_dau)) {
      return res.status(400).json({ error: 'ngay_bat_dau phai la Thu 2!' });
    }
    if (!isSundayDate(ngay_ket_thuc)) {
      return res.status(400).json({ error: 'ngay_ket_thuc phai la Chu nhat!' });
    }

    await client.query('BEGIN');

    const existHK = await client.query('SELECT hoc_ky_id FROM hoc_ky WHERE hoc_ky_id = $1', [idResult.value]);
    if (existHK.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Học kỳ không tồn tại!' });
    }

    const dupHK = await client.query(
      'SELECT hoc_ky_id FROM hoc_ky WHERE nam_hoc = $1 AND ten_hoc_ky = $2 AND hoc_ky_id != $3',
      [nam_hoc, ten_hoc_ky, idResult.value]
    );
    if (dupHK.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: `Học kỳ "${ten_hoc_ky}" năm "${nam_hoc}" đã tồn tại!` });
    }

    if (trang_thai === 'hoat_dong') {
      await client.query(
        `UPDATE hoc_ky
         SET trang_thai = 'ket_thuc'
         WHERE hoc_ky_id != $1 AND trang_thai = 'hoat_dong'`,
        [idResult.value]
      );
      await closeLopHocPhanForEndedHocKy(client, "hoc_ky_id != $1 AND trang_thai = 'ket_thuc'", [idResult.value]);
    }

    const result = await client.query(
      `UPDATE hoc_ky
       SET ten_hoc_ky = $1,
           nam_hoc = $2,
           ngay_bat_dau = $3,
           ngay_ket_thuc = $4,
           trang_thai = $5
       WHERE hoc_ky_id = $6
       RETURNING *`,
      [ten_hoc_ky, nam_hoc, ngay_bat_dau, ngay_ket_thuc, trang_thai, idResult.value]
    );

    if (trang_thai === 'ket_thuc') {
      await closeLopHocPhanForEndedHocKy(client, 'hoc_ky_id = $1', [idResult.value]);
    }

    await client.query('COMMIT');
    res.json({ message: 'Cập nhật học kỳ thành công!', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

// ===== QUẢN LÝ PHÒNG HỌC =====
router.get('/phong-hoc', async (req, res) => {
  try {
    // Task 4 fix: phân trang limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    const result = await pool.query(
      'SELECT * FROM phong_hoc ORDER BY ma_phong LIMIT $1 OFFSET $2',
      [pageLimit, pageOffset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/phong-hoc', async (req, res) => {
  try {
    const { ma_phong, ten_phong, suc_chua, loai_phong } = req.body;

    // Validation: required
    if (!ma_phong)    return res.status(400).json({ error: 'ma_phong là bắt buộc!' });
    if (!ten_phong)   return res.status(400).json({ error: 'ten_phong là bắt buộc!' });
    if (!suc_chua)   return res.status(400).json({ error: 'suc_chua là bắt buộc!' });
    if (!loai_phong) return res.status(400).json({ error: 'loai_phong là bắt buộc!' });

    const result = await pool.query(
      `INSERT INTO phong_hoc (ma_phong, ten_phong, suc_chua, loai_phong, trang_thai)
       VALUES ($1, $2, $3, $4, 'hoat_dong') RETURNING *`,
      [ma_phong, ten_phong, suc_chua, loai_phong]
    );
    res.json({ message: 'Thêm phòng học thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

async function getPhongHocAffectedSlots(client, phongHocId) {
  const affected = await client.query(
    `SELECT ts.tkb_slot_id,
            ts.tkb_id,
            ts.khung_thoi_gian_id,
            ts.hinh_thuc,
            lhp.lop_hoc_phan_id,
            lhp.ma_lop_hp,
            lhp.ten_lop_hp,
            mh.ten_mon,
            ktg.thu_trong_tuan,
            ktg.tiet_bat_dau,
            ktg.tiet_ket_thuc,
            COUNT(svlhp.id)::int AS so_sinh_vien,
            GREATEST(COUNT(svlhp.id)::int, lhp.si_so_toi_da)::int AS suc_chua_yeu_cau
     FROM tkb_slot ts
     JOIN thoi_khoa_bieu tkb ON tkb.tkb_id = ts.tkb_id
     JOIN hoc_ky hk ON hk.hoc_ky_id = tkb.hoc_ky_id
     JOIN phan_cong_giang_day pcgd ON pcgd.phan_cong_id = ts.phan_cong_id
     JOIN lop_hoc_phan lhp ON lhp.lop_hoc_phan_id = pcgd.lop_hoc_phan_id
     JOIN mon_hoc mh ON mh.mon_hoc_id = lhp.mon_hoc_id
     JOIN khung_thoi_gian ktg ON ktg.khung_thoi_gian_id = ts.khung_thoi_gian_id
     LEFT JOIN sinhvien_lophocphan svlhp
       ON svlhp.lop_hoc_phan_id = lhp.lop_hoc_phan_id
      AND svlhp.trang_thai = 'hoat_dong'
     WHERE ts.phong_hoc_id = $1
       AND ts.trang_thai = 'hoat_dong'
       AND hk.trang_thai = 'hoat_dong'
       AND ${LATEST_TKB_FILTER}
     GROUP BY ts.tkb_slot_id, ts.tkb_id, ts.khung_thoi_gian_id, ts.hinh_thuc,
              lhp.lop_hoc_phan_id, lhp.ma_lop_hp, lhp.ten_lop_hp, lhp.si_so_toi_da,
              mh.ten_mon, ktg.thu_trong_tuan, ktg.tiet_bat_dau, ktg.tiet_ket_thuc
     ORDER BY ktg.thu_trong_tuan, ktg.tiet_bat_dau, lhp.ma_lop_hp`,
    [phongHocId]
  );

  const rows = [];
  for (const slot of affected.rows) {
    const candidates = await client.query(
      `SELECT ph.phong_hoc_id,
              ph.ma_phong,
              ph.ten_phong,
              ph.suc_chua,
              ph.loai_phong
       FROM phong_hoc ph
       WHERE ph.phong_hoc_id != $1
         AND ph.trang_thai = 'hoat_dong'
         AND ph.suc_chua >= $2
         AND (ph.loai_phong = 'thi' OR ph.loai_phong = $3)
         AND NOT EXISTS (
           SELECT 1
           FROM tkb_slot busy
           WHERE busy.tkb_id = $4
             AND busy.khung_thoi_gian_id = $5
             AND busy.phong_hoc_id = ph.phong_hoc_id
             AND busy.trang_thai = 'hoat_dong'
             AND busy.tkb_slot_id != $6
         )
       ORDER BY ph.suc_chua, ph.ma_phong`,
      [
        phongHocId,
        slot.suc_chua_yeu_cau,
        slot.hinh_thuc || 'ly_thuyet',
        slot.tkb_id,
        slot.khung_thoi_gian_id,
        slot.tkb_slot_id,
      ]
    );

    rows.push({
      ...slot,
      phong_thay_the: candidates.rows,
    });
  }

  return rows;
}

router.get('/phong-hoc/:id/anh-huong', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.id, 'phong_hoc_id');
    if (!idResult || idResult.error) return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });

    const room = await pool.query('SELECT * FROM phong_hoc WHERE phong_hoc_id = $1', [idResult.value]);
    if (room.rows.length === 0) return res.status(404).json({ error: 'Phòng học không tồn tại!' });

    const affected = await getPhongHocAffectedSlots(pool, idResult.value);
    res.json({ phong_hoc: room.rows[0], affected });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/phong-hoc/:id/chuyen-phong-tam-dung', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const idResult = parseIntParam(req.params.id, 'phong_hoc_id');
    if (!idResult || idResult.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });
    }

    const replacements = Array.isArray(req.body?.replacements) ? req.body.replacements : [];
    const room = await client.query('SELECT * FROM phong_hoc WHERE phong_hoc_id = $1', [idResult.value]);
    if (room.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Phòng học không tồn tại!' });
    }

    const affected = await getPhongHocAffectedSlots(client, idResult.value);
    const affectedIds = new Set(affected.map(slot => Number(slot.tkb_slot_id)));

    if (affected.length > 0 && replacements.length !== affected.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cần chọn phòng thay thế cho tất cả lớp học phần bị ảnh hưởng!' });
    }

    const replacementMap = new Map();
    for (const item of replacements) {
      const slotId = Number(item?.tkb_slot_id);
      const newRoomId = Number(item?.phong_hoc_id);
      if (!Number.isInteger(slotId) || !Number.isInteger(newRoomId) || slotId <= 0 || newRoomId <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Danh sách phòng thay thế không hợp lệ!' });
      }
      if (!affectedIds.has(slotId)) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Slot TKB không thuộc phòng học cần tạm dừng!' });
      }
      replacementMap.set(slotId, newRoomId);
    }

    for (const slot of affected) {
      if (!replacementMap.has(Number(slot.tkb_slot_id))) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Cần chọn phòng thay thế cho tất cả lớp học phần bị ảnh hưởng!' });
      }

      const newRoomId = replacementMap.get(Number(slot.tkb_slot_id));
      const isCandidate = slot.phong_thay_the.some(ph => Number(ph.phong_hoc_id) === newRoomId);
      if (!isCandidate) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Phòng thay thế không hợp lệ cho lớp ${slot.ma_lop_hp}!` });
      }
    }

    const pairKeys = new Set();
    for (const slot of affected) {
      const newRoomId = replacementMap.get(Number(slot.tkb_slot_id));
      const key = `${slot.tkb_id}:${slot.khung_thoi_gian_id}:${newRoomId}`;
      if (pairKeys.has(key)) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Có nhiều lớp được chuyển vào cùng một phòng ở cùng khung thời gian!' });
      }
      pairKeys.add(key);
    }

    for (const slot of affected) {
      await client.query(
        `UPDATE tkb_slot
         SET phong_hoc_id = $1
         WHERE tkb_slot_id = $2`,
        [replacementMap.get(Number(slot.tkb_slot_id)), slot.tkb_slot_id]
      );
    }

    const result = await client.query(
      `UPDATE phong_hoc
       SET trang_thai = 'tam_dung'
       WHERE phong_hoc_id = $1
       RETURNING *`,
      [idResult.value]
    );

    await client.query('COMMIT');
    res.json({
      message: affected.length > 0
        ? 'Đã chuyển phòng cho các lớp học phần bị ảnh hưởng và tạm dừng phòng học!'
        : 'Đã tạm dừng phòng học!',
      data: result.rows[0],
      affected_count: affected.length,
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

router.put('/phong-hoc/:id', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.id, 'phong_hoc_id');
    if (!idResult || idResult.error) return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });

    const { ten_phong, suc_chua, loai_phong, trang_thai } = req.body;
    const allowedTrangThai = ['hoat_dong', 'tam_dung', 'sap_chua'];
    if (trang_thai !== undefined && !allowedTrangThai.includes(trang_thai)) {
      return res.status(400).json({ error: 'trang_thai không hợp lệ!' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (ten_phong !== undefined)  { updates.push(`ten_phong = $${idx++}`);  params.push(ten_phong); }
    if (suc_chua !== undefined)   { updates.push(`suc_chua = $${idx++}`);   params.push(suc_chua); }
    if (loai_phong !== undefined) { updates.push(`loai_phong = $${idx++}`); params.push(loai_phong); }
    if (trang_thai !== undefined) { updates.push(`trang_thai = $${idx++}`); params.push(trang_thai); }

    if (updates.length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật!' });

    params.push(idResult.value);
    const result = await pool.query(
      `UPDATE phong_hoc SET ${updates.join(', ')} WHERE phong_hoc_id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Phòng học không tồn tại!' });
    res.json({ message: 'Cập nhật phòng học thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.delete('/phong-hoc/:id', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.id, 'phong_hoc_id');
    if (!idResult || idResult.error) return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });

    const affected = await getPhongHocAffectedSlots(pool, idResult.value);
    if (affected.length > 0) {
      return res.status(409).json({
        error: 'Phòng học đang được sử dụng trong TKB. Cần chuyển phòng cho các lớp học phần bị ảnh hưởng trước khi tạm dừng!',
        requires_reassign: true,
        affected,
      });
    }

    const inUse = await pool.query(
      `SELECT 1 FROM buoi_hoc WHERE phong_hoc_id = $1 AND trang_thai != 'huy' LIMIT 1`,
      [idResult.value]
    );
    if (inUse.rows.length > 0) return res.status(400).json({ error: 'Phòng học đang được sử dụng trong buổi học, không thể xóa!' });

    const result = await pool.query(
      `UPDATE phong_hoc SET trang_thai = 'tam_dung' WHERE phong_hoc_id = $1 AND trang_thai != 'tam_dung' RETURNING phong_hoc_id`,
      [idResult.value]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Phòng học không tồn tại hoặc đã bị tạm dừng!' });
    res.json({ message: 'Đã tạm dừng phòng học!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== QUẢN LÝ KHUNG THỜI GIAN =====
router.get('/khung-thoi-gian', async (req, res) => {
  try {
    // Task 4 fix: phân trang limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    const result = await pool.query(
      'SELECT * FROM khung_thoi_gian ORDER BY thu_trong_tuan, tiet_bat_dau LIMIT $1 OFFSET $2',
      [pageLimit, pageOffset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/khung-thoi-gian', async (req, res) => {
  try {
    const { thu_trong_tuan, tiet_bat_dau, tiet_ket_thuc, gio_bat_dau, gio_ket_thuc, mo_ta } = req.body;

    // Validation: required
    if (!thu_trong_tuan)  return res.status(400).json({ error: 'thu_trong_tuan là bắt buộc!' });
    if (!tiet_bat_dau)    return res.status(400).json({ error: 'tiet_bat_dau là bắt buộc!' });
    if (!tiet_ket_thuc)   return res.status(400).json({ error: 'tiet_ket_thuc là bắt buộc!' });
    if (!gio_bat_dau)     return res.status(400).json({ error: 'gio_bat_dau là bắt buộc!' });
    if (!gio_ket_thuc)    return res.status(400).json({ error: 'gio_ket_thuc là bắt buộc!' });

    const thu = Number(thu_trong_tuan);
    const tietStart = Number(tiet_bat_dau);
    const tietEnd = Number(tiet_ket_thuc);
    if (!Number.isInteger(thu) || thu < 2 || thu > 8) {
      return res.status(400).json({ error: 'thu_trong_tuan phải từ 2 đến 8!' });
    }
    if (!Number.isInteger(tietStart) || tietStart < 1 || tietStart > 11) {
      return res.status(400).json({ error: 'tiet_bat_dau phải từ 1 đến 11!' });
    }
    if (!Number.isInteger(tietEnd) || tietEnd < 1 || tietEnd > 11) {
      return res.status(400).json({ error: 'tiet_ket_thuc phải từ 1 đến 11!' });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(gio_bat_dau).slice(0, 5))) {
      return res.status(400).json({ error: 'gio_bat_dau phải có định dạng HH:mm!' });
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(gio_ket_thuc).slice(0, 5))) {
      return res.status(400).json({ error: 'gio_ket_thuc phải có định dạng HH:mm!' });
    }

    // Validation: logic tiết & giờ
    if (tietStart > tietEnd) {
      return res.status(400).json({ error: 'tiet_bat_dau phải nhỏ hơn hoặc bằng tiet_ket_thuc!' });
    }
    if (gio_bat_dau >= gio_ket_thuc) {
      return res.status(400).json({ error: 'gio_bat_dau phải nhỏ hơn gio_ket_thuc!' });
    }

    const conflict = await pool.query(
      `SELECT 1
       FROM khung_thoi_gian
       WHERE thu_trong_tuan = $1
         AND (
           (tiet_bat_dau <= $3 AND tiet_ket_thuc >= $2)
           OR (gio_bat_dau < $5::time AND gio_ket_thuc > $4::time)
         )
       LIMIT 1`,
      [thu, tietStart, tietEnd, gio_bat_dau, gio_ket_thuc]
    );
    if (conflict.rows.length > 0) {
      return res.status(409).json({ error: 'Khung thời gian bị trùng hoặc chồng lấn với slot đã có trong cùng ngày!' });
    }

    const result = await pool.query(
      `INSERT INTO khung_thoi_gian (thu_trong_tuan, tiet_bat_dau, tiet_ket_thuc, gio_bat_dau, gio_ket_thuc, mo_ta)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [thu, tietStart, tietEnd, gio_bat_dau, gio_ket_thuc, mo_ta]
    );
    res.json({ message: 'Thêm khung thời gian thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== QUẢN LÝ MÔN HỌC =====
router.get('/mon-hoc', async (req, res) => {
  try {
    // Task 4 fix: phân trang limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    const result = await pool.query(
      'SELECT * FROM mon_hoc ORDER BY ten_mon LIMIT $1 OFFSET $2',
      [pageLimit, pageOffset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/mon-hoc', async (req, res) => {
  try {
    const { ma_mon, ten_mon, so_tin_chi, so_tiet } = req.body;

    // Validation: required
    if (!ma_mon)     return res.status(400).json({ error: 'ma_mon là bắt buộc!' });
    if (!ten_mon)    return res.status(400).json({ error: 'ten_mon là bắt buộc!' });
    if (!so_tin_chi) return res.status(400).json({ error: 'so_tin_chi là bắt buộc!' });
    if (!so_tiet)    return res.status(400).json({ error: 'so_tiet là bắt buộc!' });

    const result = await pool.query(
      `INSERT INTO mon_hoc (ma_mon, ten_mon, so_tin_chi, so_tiet)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [ma_mon, ten_mon, so_tin_chi, so_tiet]
    );
    res.json({ message: 'Thêm môn học thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== QUẢN LÝ LỚP HỌC PHẦN =====
router.get('/lop-hoc-phan', async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (hocKyResult && hocKyResult.error) return res.status(400).json({ error: hocKyResult.error });

    // Task 4 fix: phân trang với limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);

    let query = `SELECT DISTINCT ON (lhp.lop_hoc_phan_id)
                        lhp.*, mh.ten_mon, nd.ho_ten as ten_gv
                 FROM lop_hoc_phan lhp
                 JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
                 LEFT JOIN phan_cong_giang_day pcgd ON lhp.lop_hoc_phan_id = pcgd.lop_hoc_phan_id
                 LEFT JOIN giangvien gv ON pcgd.giang_vien_id = gv.giang_vien_id
                 LEFT JOIN nguoidung nd ON gv.user_id = nd.user_id`;
    const params = [];
    if (hocKyResult && hocKyResult.value !== undefined) {
      query += ' WHERE lhp.hoc_ky_id = $1';
      params.push(hocKyResult.value);
    }
    query += ` ORDER BY lhp.lop_hoc_phan_id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await pool.query(query, [...params, pageLimit, pageOffset]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/lop-hoc-phan', async (req, res) => {
  try {
    const { mon_hoc_id, hoc_ky_id, si_so_toi_da } = req.body;

    // Validation: các field bắt buộc
    if (!mon_hoc_id) return res.status(400).json({ error: 'mon_hoc_id là bắt buộc!' });
    if (!hoc_ky_id) return res.status(400).json({ error: 'hoc_ky_id là bắt buộc!' });
    if (!si_so_toi_da) return res.status(400).json({ error: 'si_so_toi_da là bắt buộc!' });

    // Validation FK: kiểm tra mon_hoc_id tồn tại
    const monHocCheck = await pool.query('SELECT ma_mon, ten_mon FROM mon_hoc WHERE mon_hoc_id = $1', [mon_hoc_id]);
    if (monHocCheck.rows.length === 0) {
      return res.status(400).json({ error: `mon_hoc_id ${mon_hoc_id} không tồn tại!` });
    }

    // Validation FK: kiểm tra hoc_ky_id tồn tại
    const hocKyCheck = await pool.query(
      'SELECT ten_hoc_ky, nam_hoc, trang_thai FROM hoc_ky WHERE hoc_ky_id = $1',
      [hoc_ky_id]
    );
    if (hocKyCheck.rows.length === 0) {
      return res.status(400).json({ error: `hoc_ky_id ${hoc_ky_id} không tồn tại!` });
    }
    if (hocKyCheck.rows[0].trang_thai === 'ket_thuc') {
      return res.status(400).json({ error: 'Không thể tạo lớp học phần trong học kỳ đã kết thúc!' });
    }

    const prefixResult = buildMaLopHocPhanPrefix({
      nam_hoc: hocKyCheck.rows[0].nam_hoc,
      ten_hoc_ky: hocKyCheck.rows[0].ten_hoc_ky,
      ma_mon: monHocCheck.rows[0].ma_mon,
    });
    if (prefixResult.error) return res.status(400).json({ error: prefixResult.error });

    const maLopResult = await generateMaLopHocPhan(pool, {
      hoc_ky_id,
      mon_hoc_id,
      prefix: prefixResult.value,
    });
    if (maLopResult.error) return res.status(400).json({ error: maLopResult.error });

    const ma_lop_hp = maLopResult.value;
    const tenVietTat = getTenVietTatMonHoc(monHocCheck.rows[0]);
    const ten_lop_hp = `${tenVietTat} - ${ma_lop_hp.slice(-2)}`;

    // Duplicate check: ma_lop_hp đã tồn tại chưa
    const dupCheck = await pool.query('SELECT 1 FROM lop_hoc_phan WHERE ma_lop_hp = $1', [ma_lop_hp]);
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: `Mã lớp học phần "${ma_lop_hp}" đã tồn tại!` });
    }

    const result = await pool.query(
      `INSERT INTO lop_hoc_phan (mon_hoc_id, hoc_ky_id, ma_lop_hp, ten_lop_hp, si_so_toi_da, trang_thai)
       VALUES ($1, $2, $3, $4, $5, 'hoat_dong') RETURNING *`,
      [mon_hoc_id, hoc_ky_id, ma_lop_hp, ten_lop_hp, si_so_toi_da]
    );
    res.json({ message: 'Thêm lớp học phần thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== QUẢN LÝ GIẢNG VIÊN =====
router.get('/giang-vien', async (req, res) => {
  try {
    // Task 4 fix: phân trang limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    const result = await pool.query(
      `SELECT gv.*, nd.ho_ten, nd.email, nd.trang_thai
       FROM giangvien gv
       JOIN nguoidung nd ON gv.user_id = nd.user_id
       ORDER BY nd.ho_ten LIMIT $1 OFFSET $2`,
      [pageLimit, pageOffset]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.put('/lop-hoc-phan/:id', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.id, 'lop_hoc_phan_id');
    if (!idResult || idResult.error) return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });

    const immutableFields = ['mon_hoc_id', 'hoc_ky_id', 'ma_lop_hp', 'ten_lop_hp'];
    const hasImmutableField = immutableFields.some(field => Object.prototype.hasOwnProperty.call(req.body || {}, field));
    if (hasImmutableField) {
      return res.status(400).json({ error: 'Không được sửa môn học, học kỳ, mã lớp hoặc tên lớp học phần sau khi đã tạo!' });
    }

    const { si_so_toi_da, trang_thai } = req.body;
    const allowedTrangThai = ['hoat_dong', 'tam_dung', 'ket_thuc'];
    if (trang_thai !== undefined && !allowedTrangThai.includes(trang_thai)) {
      return res.status(400).json({ error: 'trang_thai không hợp lệ!' });
    }

    const existing = await pool.query(
      `SELECT lhp.trang_thai, hk.trang_thai AS hoc_ky_trang_thai
       FROM lop_hoc_phan lhp
       JOIN hoc_ky hk ON lhp.hoc_ky_id = hk.hoc_ky_id
       WHERE lhp.lop_hoc_phan_id = $1`,
      [idResult.value]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Lớp học phần không tồn tại!' });
    if (existing.rows[0].trang_thai === 'ket_thuc' || existing.rows[0].hoc_ky_trang_thai === 'ket_thuc') {
      return res.status(400).json({ error: 'Lớp học phần đã kết thúc, không thể cập nhật!' });
    }

    const updates = [];
    const params = [];
    let idx = 1;

    if (si_so_toi_da !== undefined) { updates.push(`si_so_toi_da = $${idx++}`); params.push(si_so_toi_da); }
    if (trang_thai !== undefined)   { updates.push(`trang_thai = $${idx++}`);   params.push(trang_thai); }

    if (updates.length === 0) return res.status(400).json({ error: 'Không có trường nào để cập nhật!' });

    params.push(idResult.value);
    const result = await pool.query(
      `UPDATE lop_hoc_phan SET ${updates.join(', ')} WHERE lop_hoc_phan_id = $${idx} RETURNING *`,
      params
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lớp học phần không tồn tại!' });
    res.json({ message: 'Cập nhật lớp học phần thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.delete('/lop-hoc-phan/:id', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.id, 'lop_hoc_phan_id');
    if (!idResult || idResult.error) return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });

    const inUse = await pool.query(
      `SELECT 1 FROM phan_cong_giang_day WHERE lop_hoc_phan_id = $1 LIMIT 1`,
      [idResult.value]
    );
    if (inUse.rows.length > 0) return res.status(400).json({ error: 'Lớp học phần đã có phân công giảng dạy, không thể xóa!' });

    const result = await pool.query(
      `UPDATE lop_hoc_phan SET trang_thai = 'ket_thuc' WHERE lop_hoc_phan_id = $1 AND trang_thai != 'ket_thuc' RETURNING lop_hoc_phan_id`,
      [idResult.value]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Lớp học phần không tồn tại hoặc đã kết thúc!' });
    res.json({ message: 'Đã kết thúc lớp học phần!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== PHÂN CÔNG GIẢNG DẠY =====
// Note: hoc_ky_id được derive tự động qua lop_hoc_phan
router.post('/phan-cong', async (req, res) => {
  try {
    const { lop_hoc_phan_id, giang_vien_id, vai_tro_phu_trach, ghi_chu } = req.body;

    // Validation: required
    if (!lop_hoc_phan_id) return res.status(400).json({ error: 'lop_hoc_phan_id là bắt buộc!' });
    if (!giang_vien_id) return res.status(400).json({ error: 'giang_vien_id là bắt buộc!' });

    if (vai_tro_phu_trach && vai_tro_phu_trach !== 'chinh') {
      return res.status(400).json({ error: 'vai_tro_phu_trach chỉ được giá trị "chinh"!' });
    }

    // Validation FK: lop_hoc_phan tồn tại và còn hoạt động
    const lhpCheck = await pool.query(
      `SELECT lhp.trang_thai, hk.trang_thai AS hoc_ky_trang_thai
       FROM lop_hoc_phan lhp
       JOIN hoc_ky hk ON lhp.hoc_ky_id = hk.hoc_ky_id
       WHERE lhp.lop_hoc_phan_id = $1`,
      [lop_hoc_phan_id]
    );
    if (lhpCheck.rows.length === 0) {
      return res.status(400).json({ error: `lop_hoc_phan_id ${lop_hoc_phan_id} không tồn tại!` });
    }
    if (lhpCheck.rows[0].trang_thai !== 'hoat_dong' || lhpCheck.rows[0].hoc_ky_trang_thai === 'ket_thuc') {
      return res.status(400).json({ error: 'Không thể phân công giảng dạy cho lớp học phần đã kết thúc!' });
    }

    // Validation FK: giang_vien tồn tại và tài khoản còn hoạt động
    const gvCheck = await pool.query(
      `SELECT nd.trang_thai
       FROM giangvien gv
       JOIN nguoidung nd ON gv.user_id = nd.user_id
       WHERE gv.giang_vien_id = $1`,
      [giang_vien_id]
    );
    if (gvCheck.rows.length === 0) {
      return res.status(400).json({ error: `giang_vien_id ${giang_vien_id} không tồn tại!` });
    }
    if (gvCheck.rows[0].trang_thai !== 'hoat_dong') {
      return res.status(400).json({ error: 'Giảng viên đã bị khóa, không thể phân công!' });
    }

    // Duplicate check: giảng viên đã được phân công cho lớp học phần này chưa
    const dupCheck = await pool.query(
      'SELECT 1 FROM phan_cong_giang_day WHERE lop_hoc_phan_id = $1 AND giang_vien_id = $2',
      [lop_hoc_phan_id, giang_vien_id]
    );
    if (dupCheck.rows.length > 0) {
      return res.status(409).json({ error: 'Giảng viên đã được phân công cho lớp học phần này!' });
    }

    const result = await pool.query(
      `INSERT INTO phan_cong_giang_day (lop_hoc_phan_id, giang_vien_id, vai_tro_phu_trach, ngay_phan_cong, ghi_chu)
       VALUES ($1, $2, $3, NOW(), $4) RETURNING *`,
      [lop_hoc_phan_id, giang_vien_id, vai_tro_phu_trach || 'chinh', ghi_chu]
    );
    res.json({ message: 'Phân công giảng dạy thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.put('/phan-cong/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    const idResult = parseIntParam(req.params.id, 'phan_cong_id');
    if (!idResult || idResult.error) return res.status(400).json({ error: idResult?.error || 'phan_cong_id không hợp lệ!' });

    const { giang_vien_id, ghi_chu } = req.body;
    if (!giang_vien_id) return res.status(400).json({ error: 'giang_vien_id là bắt buộc!' });

    await client.query('BEGIN');

    const currentResult = await client.query(
      `SELECT pcgd.phan_cong_id, pcgd.giang_vien_id AS giang_vien_id_cu,
              lhp.lop_hoc_phan_id, lhp.ma_lop_hp, lhp.ten_lop_hp, lhp.trang_thai,
              hk.trang_thai AS hoc_ky_trang_thai, mh.ten_mon
       FROM phan_cong_giang_day pcgd
       JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
       JOIN hoc_ky hk ON lhp.hoc_ky_id = hk.hoc_ky_id
       JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id
       WHERE pcgd.phan_cong_id = $1`,
      [idResult.value]
    );
    if (currentResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Phân công không tồn tại!' });
    }

    const current = currentResult.rows[0];
    if (current.trang_thai !== 'hoat_dong' || current.hoc_ky_trang_thai === 'ket_thuc') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Không thể đổi giảng viên cho lớp học phần đã kết thúc!' });
    }
    if (Number(current.giang_vien_id_cu) === Number(giang_vien_id)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Giảng viên mới đang là giảng viên phụ trách hiện tại!' });
    }

    const gvCheck = await client.query(
      `SELECT gv.giang_vien_id, nd.user_id, nd.ho_ten, nd.trang_thai
       FROM giangvien gv
       JOIN nguoidung nd ON gv.user_id = nd.user_id
       WHERE gv.giang_vien_id = $1`,
      [giang_vien_id]
    );
    if (gvCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `giang_vien_id ${giang_vien_id} không tồn tại!` });
    }
    if (gvCheck.rows[0].trang_thai !== 'hoat_dong') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Giảng viên đã bị khóa, không thể phân công!' });
    }

    const conflict = await client.query(
      `SELECT 1
       FROM buoi_hoc bh_current
       JOIN buoi_hoc bh_other
         ON bh_other.ngay_hoc = bh_current.ngay_hoc
        AND bh_other.khung_thoi_gian_id = bh_current.khung_thoi_gian_id
        AND bh_other.trang_thai = 'hoat_dong'
       JOIN phan_cong_giang_day pc_other ON bh_other.phan_cong_id = pc_other.phan_cong_id
       WHERE bh_current.phan_cong_id = $1
         AND bh_current.trang_thai = 'hoat_dong'
         AND pc_other.giang_vien_id = $2
         AND pc_other.phan_cong_id != $1
       LIMIT 1`,
      [idResult.value, giang_vien_id]
    );
    if (conflict.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Giảng viên mới bị trùng lịch với lớp học phần này!' });
    }

    const result = await client.query(
      `UPDATE phan_cong_giang_day
       SET giang_vien_id = $1,
           ngay_phan_cong = NOW(),
           ghi_chu = $2
       WHERE phan_cong_id = $3
       RETURNING *`,
      [giang_vien_id, ghi_chu || null, idResult.value]
    );

    const svRecipients = await client.query(
      `SELECT DISTINCT sv.user_id
       FROM sinhvien_lophocphan svlh
       JOIN sinhvien sv ON svlh.sinh_vien_id = sv.sinh_vien_id
       JOIN nguoidung nd ON sv.user_id = nd.user_id
       WHERE svlh.lop_hoc_phan_id = $1
         AND svlh.trang_thai = 'hoat_dong'
         AND nd.trang_thai = 'hoat_dong'`,
      [current.lop_hoc_phan_id]
    );

    await insertNotification(client, {
      tieu_de: `Cập nhật giảng viên lớp ${current.ma_lop_hp} ${Date.now()}`,
      noi_dung: `Lớp học phần ${current.ma_lop_hp} - ${current.ten_mon} đã được phân công giảng viên mới: ${gvCheck.rows[0].ho_ten}.`,
      loai_thong_bao: 'thay_doi_lich',
      nguoi_tao_id: req.user.user_id,
      recipients: [...svRecipients.rows.map((row) => row.user_id), gvCheck.rows[0].user_id],
    });

    await client.query('COMMIT');
    res.json({ message: 'Cập nhật giảng viên phân công thành công!', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

// Fix 1b: lọc hoc_ky_id phải qua lop_hoc_phan vì pcgd không có cột hoc_ky_id
router.get('/phan-cong', async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (hocKyResult && hocKyResult.error) return res.status(400).json({ error: hocKyResult.error });

    // Task 4 fix: phân trang với limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);

    let query = `SELECT pcgd.*, nd.ho_ten as ten_gv, mh.ten_mon, lhp.ma_lop_hp, lhp.ten_lop_hp
                 FROM phan_cong_giang_day pcgd
                 JOIN giangvien gv ON pcgd.giang_vien_id = gv.giang_vien_id
                 JOIN nguoidung nd ON gv.user_id = nd.user_id
                 JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
                 JOIN mon_hoc mh ON lhp.mon_hoc_id = mh.mon_hoc_id`;
    const params = [];
    if (hocKyResult && hocKyResult.value !== undefined) {
      query += ' WHERE lhp.hoc_ky_id = $1';
      params.push(hocKyResult.value);
    }
    query += ` ORDER BY pcgd.phan_cong_id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await pool.query(query, [...params, pageLimit, pageOffset]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== KHAI BÁO RÀNG BUỘC XẾP LỊCH =====
// Task 5 — RÀNG BUỘC CHỈ ĐƯỢC LƯU TRỮ, KHÔNG TỰ ĐỘNG ÁP DỤNG.
// Bảng rang_buoc_xep_lich lưu trữ các ràng buộc (giới hạn sĩ số, ưu tiên phòng,
// trùng lịch, v.v.) như một danh mục tham chiếu. Hiện tại KHÔNG có trigger hay
// stored procedure nào tự động kiểm tra/bác bỏ việc xếp buổi học vi phạm ràng buộc.
// Nếu cần enforcement đầy đủ, cần bổ sung trigger hoặc logic xếp lịch tự động (algorithm).
// Các route CRUD vẫn hoạt động bình thường cho mục đích quản lý ràng buộc.
// ================================================================
router.get('/rang-buoc', async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (hocKyResult && hocKyResult.error) return res.status(400).json({ error: hocKyResult.error });

    // Task 4 fix: phân trang limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);

    let query = 'SELECT * FROM rang_buoc_xep_lich';
    const params = [];
    if (hocKyResult && hocKyResult.value !== undefined) {
      query += ' WHERE hoc_ky_id = $1';
      params.push(hocKyResult.value);
    }
    query += ` ORDER BY rang_buoc_id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const result = await pool.query(query, [...params, pageLimit, pageOffset]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/rang-buoc', async (req, res) => {
  try {
    const { hoc_ky_id, ten_rang_buoc, loai_rang_buoc, muc_uu_tien, mo_ta } = req.body;

    // Validation: required
    if (!hoc_ky_id) return res.status(400).json({ error: 'hoc_ky_id là bắt buộc!' });
    if (!ten_rang_buoc) return res.status(400).json({ error: 'ten_rang_buoc là bắt buộc!' });
    if (!loai_rang_buoc) return res.status(400).json({ error: 'loai_rang_buoc là bắt buộc!' });

    // Validation FK: hoc_ky tồn tại
    const hkCheck = await pool.query('SELECT 1 FROM hoc_ky WHERE hoc_ky_id = $1', [hoc_ky_id]);
    if (hkCheck.rows.length === 0) {
      return res.status(400).json({ error: `hoc_ky_id ${hoc_ky_id} không tồn tại!` });
    }

    const result = await pool.query(
      `INSERT INTO rang_buoc_xep_lich (hoc_ky_id, ten_rang_buoc, loai_rang_buoc, muc_uu_tien, mo_ta, trang_thai)
       VALUES ($1, $2, $3, $4, $5, 'hoat_dong') RETURNING *`,
      [hoc_ky_id, ten_rang_buoc, loai_rang_buoc, muc_uu_tien, mo_ta]
    );
    res.json({ message: 'Thêm ràng buộc thành công!', data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== LỊCH BẬN =====
// Fix 3: bảng lich_ban KHÔNG tồn tại — đúng là lich_ban_tuan và lich_ban_ngay
// GET trả về cả 2 loại, phân biệt qua field loai_ban
router.get('/lich-ban', async (req, res) => {
  try {
    const gvResult = parseIntParam(req.query.giang_vien_id, 'giang_vien_id');
    if (gvResult && gvResult.error) return res.status(400).json({ error: gvResult.error });
    const hkResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (hkResult && hkResult.error) return res.status(400).json({ error: hkResult.error });
    const { loai } = req.query;

    // Task 4 fix: phân trang limit/offset (mặc định 50)
    const pageLimit  = Math.min(200, Math.max(1, parseInt(req.query.limit)  || 50));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);

    // Lịch bận tuần
    let queryTuan = `SELECT lbt.lich_ban_tuan_id as id, 'tuan' as loai_ban,
                    lbt.giang_vien_id, lbt.hoc_ky_id, lbt.khung_thoi_gian_id,
                    NULL as ngay_cu_the, lbt.ly_do, lbt.trang_thai,
                    nd.ho_ten as ten_gv, ktg.mo_ta as ca_hoc
             FROM lich_ban_tuan lbt
             JOIN giangvien gv ON lbt.giang_vien_id = gv.giang_vien_id
             JOIN nguoidung nd ON gv.user_id = nd.user_id
             LEFT JOIN khung_thoi_gian ktg ON lbt.khung_thoi_gian_id = ktg.khung_thoi_gian_id WHERE 1=1`;
    const paramsTuan = [];
    let idx = 1;
    if (gvResult?.value !== undefined) { queryTuan += ` AND lbt.giang_vien_id = $${idx++}`; paramsTuan.push(gvResult.value); }
    if (hkResult?.value !== undefined) { queryTuan += ` AND lbt.hoc_ky_id = $${idx++}`; paramsTuan.push(hkResult.value); }

    // Lịch bận ngày
    let queryNgay = `SELECT lbn.lich_ban_ngay_id as id, 'ngay' as loai_ban,
                    lbn.giang_vien_id, lbn.hoc_ky_id, lbn.khung_thoi_gian_id,
                    lbn.ngay_cu_the, lbn.ly_do, lbn.trang_thai,
                    nd.ho_ten as ten_gv, ktg.mo_ta as ca_hoc
             FROM lich_ban_ngay lbn
             JOIN giangvien gv ON lbn.giang_vien_id = gv.giang_vien_id
             JOIN nguoidung nd ON gv.user_id = nd.user_id
             LEFT JOIN khung_thoi_gian ktg ON lbn.khung_thoi_gian_id = ktg.khung_thoi_gian_id WHERE 1=1`;
    const paramsNgay = [];
    idx = 1;
    if (gvResult?.value !== undefined) { queryNgay += ` AND lbn.giang_vien_id = $${idx++}`; paramsNgay.push(gvResult.value); }
    if (hkResult?.value !== undefined) { queryNgay += ` AND lbn.hoc_ky_id = $${idx++}`; paramsNgay.push(hkResult.value); }

    const [rowsTuan, rowsNgay] = await Promise.all([
      pool.query(
        queryTuan + ` ORDER BY ktg.thu_trong_tuan, ktg.tiet_bat_dau LIMIT $${paramsTuan.length + 1} OFFSET $${paramsTuan.length + 2}`,
        [...paramsTuan, pageLimit, pageOffset]
      ),
      pool.query(
        queryNgay + ` ORDER BY lbn.ngay_cu_the DESC, ktg.tiet_bat_dau LIMIT $${paramsNgay.length + 1} OFFSET $${paramsNgay.length + 2}`,
        [...paramsNgay, pageLimit, pageOffset]
      ),
    ]);

    let result = [];
    if (!loai || loai === 'tuan') result = result.concat(rowsTuan.rows);
    if (!loai || loai === 'ngay') result = result.concat(rowsNgay.rows);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// POST: tự detect loại — có ngay_cu_the → lich_ban_ngay, không có → lich_ban_tuan
router.post('/lich-ban', async (req, res) => {
  try {
    const { giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ngay_cu_the, ly_do, loai } = req.body;
    const isNgay = !!ngay_cu_the || loai === 'ngay';

    // Validation: required
    if (!giang_vien_id) return res.status(400).json({ error: 'giang_vien_id là bắt buộc!' });
    if (!hoc_ky_id) return res.status(400).json({ error: 'hoc_ky_id là bắt buộc!' });
    if (!khung_thoi_gian_id) return res.status(400).json({ error: 'khung_thoi_gian_id là bắt buộc!' });

    // Validation FK: giang_vien tồn tại
    const gvCheck = await pool.query('SELECT 1 FROM giangvien WHERE giang_vien_id = $1', [giang_vien_id]);
    if (gvCheck.rows.length === 0) {
      return res.status(400).json({ error: `giang_vien_id ${giang_vien_id} không tồn tại!` });
    }

    // Validation FK: hoc_ky tồn tại
    const hkCheck = await pool.query('SELECT 1 FROM hoc_ky WHERE hoc_ky_id = $1', [hoc_ky_id]);
    if (hkCheck.rows.length === 0) {
      return res.status(400).json({ error: `hoc_ky_id ${hoc_ky_id} không tồn tại!` });
    }

    // Validation FK: khung_thoi_gian tồn tại
    const ktgCheck = await pool.query('SELECT 1 FROM khung_thoi_gian WHERE khung_thoi_gian_id = $1', [khung_thoi_gian_id]);
    if (ktgCheck.rows.length === 0) {
      return res.status(400).json({ error: `khung_thoi_gian_id ${khung_thoi_gian_id} không tồn tại!` });
    }

    if (isNgay) {
      const result = await pool.query(
        `INSERT INTO lich_ban_ngay (giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ngay_cu_the, ly_do, trang_thai)
         VALUES ($1, $2, $3, $4, $5, 'cho_duyet') RETURNING *`,
        [giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ngay_cu_the, ly_do]
      );
      res.json({ message: 'Khai báo lịch bận ngày thành công! Đang chờ phê duyệt.', data: result.rows[0] });
    } else {
      const result = await pool.query(
        `INSERT INTO lich_ban_tuan (giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ly_do, trang_thai)
         VALUES ($1, $2, $3, $4, 'cho_duyet') RETURNING *`,
        [giang_vien_id, hoc_ky_id, khung_thoi_gian_id, ly_do]
      );
      res.json({ message: 'Khai báo lịch bận tuần thành công! Đang chờ phê duyệt.', data: result.rows[0] });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== PHÊ DUYỆT / TỪ CHỐI LỊCH BẬN =====
// Task 1 fix: phê duyệt hoặc từ chối lịch bận (lich_ban_tuan hoặc lich_ban_ngay)
// Cho phép giao_vu hoặc truong_khoa thực hiện
// Body: { loai: 'tuan'|'ngay', trang_thai: 'dong_y'|'tu_choi' }
router.put('/lich-ban/:id/duyet', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.id, 'lich_ban_id');
    if (!idResult || idResult.error) {
      return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });
    }

    const { loai, trang_thai } = req.body;

    // Validation: xác định loại bảng
    if (!loai || !['tuan', 'ngay'].includes(loai)) {
      return res.status(400).json({ error: 'loai phải là "tuan" hoặc "ngay"!' });
    }

    // Validation: trạng thái chuyển đổi hợp lệ
    if (!trang_thai || !['dong_y', 'tu_choi'].includes(trang_thai)) {
      return res.status(400).json({ error: 'trang_thai phải là "dong_y" hoặc "tu_choi"!' });
    }

    const table = loai === 'tuan' ? 'lich_ban_tuan' : 'lich_ban_ngay';
    const idCol  = loai === 'tuan' ? 'lich_ban_tuan_id' : 'lich_ban_ngay_id';

    // Kiểm tra tồn tại
    const exist = await pool.query(
      `SELECT trang_thai FROM ${table} WHERE ${idCol} = $1`,
      [idResult.value]
    );
    if (exist.rows.length === 0) {
      return res.status(404).json({ error: 'Lịch bận không tồn tại!' });
    }

    // Chỉ phê duyệt/từ chối khi đang ở 'cho_duyet'
    if (exist.rows[0].trang_thai !== 'cho_duyet') {
      return res.status(400).json({
        error: `Lịch bận đang ở trạng thái "${exist.rows[0].trang_thai}", chỉ xử lý khi đang "cho_duyet"!`
      });
    }

    await pool.query(
      `UPDATE ${table} SET trang_thai = $1 WHERE ${idCol} = $2`,
      [trang_thai, idResult.value]
    );

    res.json({ message: trang_thai === 'dong_y' ? 'Đồng ý lịch bận thành công!' : 'Từ chối lịch bận thành công!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== TẠO THỜI KHÓA BIỂU =====
router.post('/tao-tkb', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { hoc_ky_id, ghi_chu } = req.body;

    if (!hoc_ky_id) return res.status(400).json({ error: 'hoc_ky_id là bắt buộc!' });
    const hkId = Number(hoc_ky_id);
    if (!Number.isInteger(hkId) || hkId <= 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'hoc_ky_id phải là số nguyên dương!' });
    }

    // Validation FK: hoc_ky tồn tại
    const hkCheck = await client.query('SELECT 1 FROM hoc_ky WHERE hoc_ky_id = $1', [hkId]);
    if (hkCheck.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `hoc_ky_id ${hoc_ky_id} không tồn tại!` });
    }

    // Chặn tạo trùng TKB cho cùng học kỳ
    const existTKB = await client.query(
      'SELECT 1 FROM thoi_khoa_bieu WHERE hoc_ky_id = $1',
      [hkId]
    );
    if (existTKB.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Đã có TKB cho học kỳ này!' });
    }

    const tkbResult = await client.query(
      `INSERT INTO thoi_khoa_bieu (hoc_ky_id, nguoi_tao_id, phien_ban, trang_thai, ngay_tao, ghi_chu)
       VALUES ($1, $2, 1, 'nhap', NOW(), $3) RETURNING *`,
      [hkId, req.user.user_id, ghi_chu]
    );

    await client.query('COMMIT');
    res.json({ message: 'Tạo TKB thành công!', data: tkbResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

router.post('/tkb-slot', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { tkb_id, phan_cong_id, phong_hoc_id, khung_thoi_gian_id, hinh_thuc, ghi_chu } = req.body;

    if (!tkb_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'tkb_id la bat buoc!' });
    }
    if (!phan_cong_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'phan_cong_id la bat buoc!' });
    }
    if (!khung_thoi_gian_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'khung_thoi_gian_id la bat buoc!' });
    }

    const tkbInfo = await client.query(
      'SELECT tkb_id, hoc_ky_id, trang_thai FROM thoi_khoa_bieu WHERE tkb_id = $1',
      [tkb_id]
    );
    if (tkbInfo.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `tkb_id ${tkb_id} khong ton tai!` });
    }
    if (tkbInfo.rows[0].trang_thai !== 'nhap') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chi co the sua slot khi TKB dang o trang thai "nhap"!' });
    }

    const pcInfo = await client.query(
      `SELECT pcgd.phan_cong_id, pcgd.giang_vien_id, lhp.hoc_ky_id, lhp.lop_hoc_phan_id, lhp.si_so_toi_da
       FROM phan_cong_giang_day pcgd
       JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
       WHERE pcgd.phan_cong_id = $1`,
      [phan_cong_id]
    );
    if (pcInfo.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `phan_cong_id ${phan_cong_id} khong ton tai!` });
    }
    if (pcInfo.rows[0].hoc_ky_id !== tkbInfo.rows[0].hoc_ky_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Phan cong giang day khong thuoc cung hoc ky voi TKB!' });
    }

    const ktgInfo = await client.query(
      'SELECT khung_thoi_gian_id, thu_trong_tuan FROM khung_thoi_gian WHERE khung_thoi_gian_id = $1',
      [khung_thoi_gian_id]
    );
    if (ktgInfo.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `khung_thoi_gian_id ${khung_thoi_gian_id} khong ton tai!` });
    }

    let loaiPhong = null;
    if (phong_hoc_id) {
      const phInfo = await client.query(
        'SELECT phong_hoc_id, trang_thai, loai_phong, suc_chua FROM phong_hoc WHERE phong_hoc_id = $1',
        [phong_hoc_id]
      );
      if (phInfo.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `phong_hoc_id ${phong_hoc_id} khong ton tai!` });
      }
      if (phInfo.rows[0].trang_thai !== 'hoat_dong') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Phong hoc dang o trang thai "${phInfo.rows[0].trang_thai}", khong the su dung!` });
      }
      loaiPhong = phInfo.rows[0].loai_phong;

      const currentSiSo = await client.query(
        `SELECT COUNT(*)::int AS so_sv
         FROM sinhvien_lophocphan
         WHERE lop_hoc_phan_id = $1 AND trang_thai = 'hoat_dong'`,
        [pcInfo.rows[0].lop_hoc_phan_id]
      );
      if (phInfo.rows[0].suc_chua < currentSiSo.rows[0].so_sv) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Phong hoc khong du suc chua cho lop hoc phan nay!' });
      }
    }

    const targetHinhThuc = hinh_thuc || 'ly_thuyet';
    if (loaiPhong && loaiPhong !== 'thi' && loaiPhong !== targetHinhThuc) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Phong hoc loai "${loaiPhong}" khong phu hop voi hinh_thuc "${targetHinhThuc}"!` });
    }

    const duplicateLhp = await client.query(
      `SELECT 1
       FROM tkb_slot
       WHERE tkb_id = $1 AND phan_cong_id = $2 AND trang_thai = 'hoat_dong'`,
      [tkb_id, phan_cong_id]
    );
    if (duplicateLhp.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Lop hoc phan nay da co slot trong TKB hien tai!' });
    }

    if (phong_hoc_id) {
      const conflictPhong = await client.query(
        `SELECT 1
         FROM tkb_slot
         WHERE tkb_id = $1
           AND phong_hoc_id = $2
           AND khung_thoi_gian_id = $3
           AND trang_thai = 'hoat_dong'
         LIMIT 1`,
        [tkb_id, phong_hoc_id, khung_thoi_gian_id]
      );
      if (conflictPhong.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Phong hoc bi trung lich trong TKB hien tai!' });
      }
    }

    const conflictGV = await client.query(
      `SELECT 1
       FROM tkb_slot ts
       JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
       WHERE ts.tkb_id = $1
         AND ts.khung_thoi_gian_id = $2
         AND ts.trang_thai = 'hoat_dong'
         AND pcgd.giang_vien_id = $3
       LIMIT 1`,
      [tkb_id, khung_thoi_gian_id, pcInfo.rows[0].giang_vien_id]
    );
    if (conflictGV.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Giang vien bi trung lich trong TKB hien tai!' });
    }

    const busyWeekly = await client.query(
      `SELECT 1
       FROM lich_ban_tuan
       WHERE giang_vien_id = $1
         AND hoc_ky_id = $2
         AND khung_thoi_gian_id = $3
         AND trang_thai = 'dong_y'
       LIMIT 1`,
      [pcInfo.rows[0].giang_vien_id, tkbInfo.rows[0].hoc_ky_id, khung_thoi_gian_id]
    );
    if (busyWeekly.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Giang vien dang ban theo lich ban tuan o khung gio nay!' });
    }

    const result = await client.query(
      `INSERT INTO tkb_slot (tkb_id, phan_cong_id, phong_hoc_id, khung_thoi_gian_id, hinh_thuc, ghi_chu, trang_thai)
       VALUES ($1, $2, $3, $4, $5, $6, 'hoat_dong')
       RETURNING *`,
      [tkb_id, phan_cong_id, phong_hoc_id || null, khung_thoi_gian_id, targetHinhThuc, ghi_chu || null]
    );

    await client.query('COMMIT');
    res.json({ message: 'Them slot TKB thanh cong!', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  } finally {
    client.release();
  }
});

router.put('/tkb-slot/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const idResult = parseIntParam(req.params.id, 'tkb_slot_id');
    if (!idResult || idResult.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: idResult?.error || 'ID khong hop le!' });
    }

    const exist = await client.query('SELECT * FROM tkb_slot WHERE tkb_slot_id = $1', [idResult.value]);
    if (exist.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Slot TKB khong ton tai!' });
    }

    const current = exist.rows[0];
    const tkbInfo = await client.query('SELECT hoc_ky_id, trang_thai FROM thoi_khoa_bieu WHERE tkb_id = $1', [current.tkb_id]);
    if (tkbInfo.rows[0].trang_thai !== 'nhap') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Chi co the sua slot khi TKB dang o trang thai "nhap"!' });
    }

    const targetPhongId = req.body.phong_hoc_id !== undefined ? req.body.phong_hoc_id : current.phong_hoc_id;
    const targetKtgId = req.body.khung_thoi_gian_id !== undefined ? req.body.khung_thoi_gian_id : current.khung_thoi_gian_id;
    const targetHinhThuc = req.body.hinh_thuc !== undefined ? req.body.hinh_thuc : current.hinh_thuc;
    const targetGhiChu = req.body.ghi_chu !== undefined ? req.body.ghi_chu : current.ghi_chu;

    const pcInfo = await client.query(
      `SELECT pcgd.giang_vien_id, lhp.lop_hoc_phan_id
       FROM phan_cong_giang_day pcgd
       JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
       WHERE pcgd.phan_cong_id = $1`,
      [current.phan_cong_id]
    );

    if (targetKtgId !== current.khung_thoi_gian_id) {
      const ktgCheck = await client.query('SELECT 1 FROM khung_thoi_gian WHERE khung_thoi_gian_id = $1', [targetKtgId]);
      if (ktgCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `khung_thoi_gian_id ${targetKtgId} khong ton tai!` });
      }
    }

    let loaiPhong = null;
    if (targetPhongId) {
      const phInfo = await client.query(
        'SELECT phong_hoc_id, trang_thai, loai_phong, suc_chua FROM phong_hoc WHERE phong_hoc_id = $1',
        [targetPhongId]
      );
      if (phInfo.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `phong_hoc_id ${targetPhongId} khong ton tai!` });
      }
      if (phInfo.rows[0].trang_thai !== 'hoat_dong') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Phong hoc dang o trang thai "${phInfo.rows[0].trang_thai}", khong the su dung!` });
      }
      loaiPhong = phInfo.rows[0].loai_phong;

      const currentSiSo = await client.query(
        `SELECT COUNT(*)::int AS so_sv
         FROM sinhvien_lophocphan
         WHERE lop_hoc_phan_id = $1 AND trang_thai = 'hoat_dong'`,
        [pcInfo.rows[0].lop_hoc_phan_id]
      );
      if (phInfo.rows[0].suc_chua < currentSiSo.rows[0].so_sv) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Phong hoc khong du suc chua cho lop hoc phan nay!' });
      }
    }

    if (loaiPhong && loaiPhong !== 'thi' && loaiPhong !== targetHinhThuc) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: `Phong hoc loai "${loaiPhong}" khong phu hop voi hinh_thuc "${targetHinhThuc}"!` });
    }

    if (targetPhongId) {
      const conflictPhong = await client.query(
        `SELECT 1
         FROM tkb_slot
         WHERE tkb_id = $1
           AND phong_hoc_id = $2
           AND khung_thoi_gian_id = $3
           AND trang_thai = 'hoat_dong'
           AND tkb_slot_id != $4
         LIMIT 1`,
        [current.tkb_id, targetPhongId, targetKtgId, idResult.value]
      );
      if (conflictPhong.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Phong hoc bi trung lich trong TKB hien tai!' });
      }
    }

    const conflictGV = await client.query(
      `SELECT 1
       FROM tkb_slot ts
       JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
       WHERE ts.tkb_id = $1
         AND ts.khung_thoi_gian_id = $2
         AND ts.trang_thai = 'hoat_dong'
         AND pcgd.giang_vien_id = $3
         AND ts.tkb_slot_id != $4
       LIMIT 1`,
      [current.tkb_id, targetKtgId, pcInfo.rows[0].giang_vien_id, idResult.value]
    );
    if (conflictGV.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Giang vien bi trung lich trong TKB hien tai!' });
    }

    const busyWeekly = await client.query(
      `SELECT 1
       FROM lich_ban_tuan
       WHERE giang_vien_id = $1
         AND hoc_ky_id = $2
         AND khung_thoi_gian_id = $3
         AND trang_thai = 'dong_y'
       LIMIT 1`,
      [pcInfo.rows[0].giang_vien_id, tkbInfo.rows[0].hoc_ky_id, targetKtgId]
    );
    if (busyWeekly.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Giang vien dang ban theo lich ban tuan o khung gio nay!' });
    }

    const result = await client.query(
      `UPDATE tkb_slot
       SET phong_hoc_id = $1,
           khung_thoi_gian_id = $2,
           hinh_thuc = $3,
           ghi_chu = $4
       WHERE tkb_slot_id = $5
       RETURNING *`,
      [targetPhongId || null, targetKtgId, targetHinhThuc, targetGhiChu || null, idResult.value]
    );

    await client.query('COMMIT');
    res.json({ message: 'Cap nhat slot TKB thanh cong!', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  } finally {
    client.release();
  }
});

router.delete('/tkb-slot/:id', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.id, 'tkb_slot_id');
    if (!idResult || idResult.error) {
      return res.status(400).json({ error: idResult?.error || 'ID khong hop le!' });
    }

    const exist = await pool.query(
      `SELECT ts.tkb_slot_id, tkb.trang_thai
       FROM tkb_slot ts
       JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
       WHERE ts.tkb_slot_id = $1`,
      [idResult.value]
    );
    if (exist.rows.length === 0) {
      return res.status(404).json({ error: 'Slot TKB khong ton tai!' });
    }
    if (exist.rows[0].trang_thai !== 'nhap') {
      return res.status(400).json({ error: 'Chi co the xoa slot khi TKB dang o trang thai "nhap"!' });
    }

    await pool.query(
      `UPDATE tkb_slot
       SET trang_thai = 'huy'
       WHERE tkb_slot_id = $1`,
      [idResult.value]
    );

    res.json({ message: 'Xoa slot TKB thanh cong!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

// ===== THÊM BUỔI HỌC =====
// Fix 7: buoi_hoc KHÔNG có lop_hoc_phan_id, giang_vien_id, nguoi_tao_id
//        Đúng: tkb_id, phan_cong_id (→ giang_vien_id qua phan_cong_giang_day), phong_hoc_id, khung_thoi_gian_id
router.post('/buoi-hoc', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      tkb_id, phan_cong_id, phong_hoc_id,
      khung_thoi_gian_id, ngay_hoc, hinh_thuc, ghi_chu
    } = req.body;

    // Validation: required
    if (!tkb_id)             { await client.query('ROLLBACK'); return res.status(400).json({ error: 'tkb_id là bắt buộc!' }); }
    if (!phan_cong_id)       { await client.query('ROLLBACK'); return res.status(400).json({ error: 'phan_cong_id là bắt buộc!' }); }
    if (!phong_hoc_id)       { await client.query('ROLLBACK'); return res.status(400).json({ error: 'phong_hoc_id là bắt buộc!' }); }
    if (!khung_thoi_gian_id) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'khung_thoi_gian_id là bắt buộc!' }); }
    if (!ngay_hoc)           { await client.query('ROLLBACK'); return res.status(400).json({ error: 'ngay_hoc là bắt buộc!' }); }

    // Validation FK: phan_cong tồn tại
    const pcCheck = await client.query('SELECT 1 FROM phan_cong_giang_day WHERE phan_cong_id = $1', [phan_cong_id]);
    if (pcCheck.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: `phan_cong_id ${phan_cong_id} không tồn tại!` }); }

    // Validation FK: phong_hoc tồn tại + kiểm tra trạng thái (Bug 6)
    const phCheck = await client.query(
      'SELECT trang_thai, loai_phong FROM phong_hoc WHERE phong_hoc_id = $1',
      [phong_hoc_id]
    );
    if (phCheck.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: `phong_hoc_id ${phong_hoc_id} không tồn tại!` }); }
    if (phCheck.rows[0].trang_thai !== 'hoat_dong') { await client.query('ROLLBACK'); return res.status(400).json({ error: `Phòng học đang ở trạng thái "${phCheck.rows[0].trang_thai}", không thể xếp lịch!` }); }

    // Validation FK: khung_thoi_gian tồn tại
    const ktgCheck = await client.query('SELECT 1 FROM khung_thoi_gian WHERE khung_thoi_gian_id = $1', [khung_thoi_gian_id]);
    if (ktgCheck.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: `khung_thoi_gian_id ${khung_thoi_gian_id} không tồn tại!` }); }

    // Lấy thông tin học kỳ để validate ngày học nằm trong khoảng hợp lệ
    const hkInfo = await client.query(
      `SELECT hk.ngay_bat_dau, hk.ngay_ket_thuc
       FROM hoc_ky hk
       JOIN thoi_khoa_bieu tkb ON tkb.hoc_ky_id = hk.hoc_ky_id
       WHERE tkb.tkb_id = $1`,
      [tkb_id]
    );
    if (hkInfo.rows.length === 0) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'TKB không tồn tại!' }); }
    const { ngay_bat_dau, ngay_ket_thuc } = hkInfo.rows[0];
    if (ngay_bat_dau && ngay_hoc < ngay_bat_dau) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ngày học trước ngày bắt đầu học kỳ!' }); }
    if (ngay_ket_thuc && ngay_hoc > ngay_ket_thuc) { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Ngày học sau ngày kết thúc học kỳ!' }); }

    // Lấy giang_vien_id từ phan_cong_id để kiểm tra trùng lịch
    const pcResult = await client.query(
      'SELECT giang_vien_id FROM phan_cong_giang_day WHERE phan_cong_id = $1',
      [phan_cong_id]
    );
    if (pcResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Phân công không tồn tại!' });
    }
    const giang_vien_id = pcResult.rows[0].giang_vien_id;

    // Bug: validate học kỳ của phan_cong và tkb phải khớp nhau
    const hkMismatch = await client.query(`
      SELECT tkb.hoc_ky_id as hk_tkb, lhp.hoc_ky_id as hk_lhp
      FROM thoi_khoa_bieu tkb, lop_hoc_phan lhp
      WHERE tkb.tkb_id = $1
        AND lhp.lop_hoc_phan_id = (SELECT lop_hoc_phan_id FROM phan_cong_giang_day WHERE phan_cong_id = $2)
    `, [tkb_id, phan_cong_id]);
    if (hkMismatch.rows.length === 0 || hkMismatch.rows[0].hk_tkb !== hkMismatch.rows[0].hk_lhp) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Học kỳ của phân công và TKB không khớp nhau!' });
    }

    // Kiểm tra xung đột phòng học
    const conflictPhong = await client.query(`
      SELECT COUNT(*) as count FROM buoi_hoc bh
      WHERE bh.phong_hoc_id = $1
        AND bh.ngay_hoc = $2
        AND bh.khung_thoi_gian_id = $3
        AND bh.trang_thai != 'huy'
    `, [phong_hoc_id, ngay_hoc, khung_thoi_gian_id]);

    if (parseInt(conflictPhong.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Phòng học bị trùng lịch!' });
    }

    // Kiểm tra giảng viên trùng lịch — qua phan_cong_giang_day (bh không có giang_vien_id)
    const gvCheck = await client.query(`
      SELECT COUNT(*) as count FROM buoi_hoc bh
      WHERE bh.phan_cong_id IN (
        SELECT phan_cong_id FROM phan_cong_giang_day WHERE giang_vien_id = $1
      )
      AND bh.ngay_hoc = $2
      AND bh.khung_thoi_gian_id = $3
      AND bh.trang_thai != 'huy'
    `, [giang_vien_id, ngay_hoc, khung_thoi_gian_id]);

    if (parseInt(gvCheck.rows[0].count) > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Giảng viên bị trùng lịch!' });
    }

    // Bug 5: kiểm tra giới hạn tải giảng viên
    const gvQuota = await client.query(
      'SELECT gioi_han_tai_giang FROM giangvien WHERE giang_vien_id = $1',
      [giang_vien_id]
    );
    if (gvQuota.rows[0].gioi_han_tai_giang > 0) {
      const currentLoad = await client.query(`
        SELECT COUNT(DISTINCT bh.buoi_hoc_id) as so_buoi
        FROM buoi_hoc bh
        JOIN thoi_khoa_bieu tkb ON bh.tkb_id = tkb.tkb_id
        WHERE bh.phan_cong_id IN (
          SELECT phan_cong_id FROM phan_cong_giang_day WHERE giang_vien_id = $1
        )
        AND bh.trang_thai = 'hoat_dong'
        AND tkb.hoc_ky_id = (SELECT hoc_ky_id FROM thoi_khoa_bieu WHERE tkb_id = $2)
      `, [giang_vien_id, tkb_id]);
      if (parseInt(currentLoad.rows[0].so_buoi) >= gvQuota.rows[0].gioi_han_tai_giang) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Giảng viên đã đạt giới hạn tải giảng (${gvQuota.rows[0].gioi_han_tai_giang} buổi)!` });
      }
    }

    const result = await client.query(
      `INSERT INTO buoi_hoc (tkb_id, phan_cong_id, phong_hoc_id, khung_thoi_gian_id, ngay_hoc, hinh_thuc, ghi_chu, trang_thai)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'hoat_dong') RETURNING *`,
      [tkb_id, phan_cong_id, phong_hoc_id, khung_thoi_gian_id, ngay_hoc, hinh_thuc || 'ly_thuyet', ghi_chu]
    );

    await client.query('COMMIT');
    res.json({ message: 'Thêm buổi học thành công!', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

// ===== LẤY TKB THEO HỌC KỲ =====
router.get('/thoi-khoa-bieu', async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (!hocKyResult || hocKyResult.error) {
      return res.status(400).json({ error: hocKyResult?.error || 'hoc_ky_id là bắt buộc!' });
    }

    // Task 4 fix: phân trang limit/offset (mặc định 100)
    const pageLimit  = Math.min(500, Math.max(1, parseInt(req.query.limit)  || 100));
    const pageOffset = Math.max(0, parseInt(req.query.offset) || 0);
    const includeMeta = ['1', 'true'].includes(String(req.query.include_meta || '').toLowerCase());

    const tkbResult = await pool.query(
      `SELECT tkb_id, hoc_ky_id, trang_thai, ghi_chu
       FROM thoi_khoa_bieu
       WHERE hoc_ky_id = $1
       ORDER BY tkb_id DESC
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
             pcgd.phan_cong_id,
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
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== XEM BÁO CÁO SỬ DỤNG PHÒNG =====
// Fix: bh.hoc_ky_id không tồn tại → lọc qua thoi_khoa_bieu
router.get('/bao-cao-phong', async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (!hocKyResult || hocKyResult.error) {
      return res.status(400).json({ error: hocKyResult?.error || 'hoc_ky_id là bắt buộc!' });
    }

    const result = await pool.query(
      `SELECT ph.*,
              COUNT(DISTINCT ts.tkb_slot_id) AS so_buoi,
              COUNT(DISTINCT ktg.thu_trong_tuan) AS so_ngay
       FROM phong_hoc ph
       LEFT JOIN tkb_slot ts ON ph.phong_hoc_id = ts.phong_hoc_id
         AND ts.trang_thai != 'huy'
       LEFT JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
         AND tkb.hoc_ky_id = $1
         AND ${LATEST_TKB_FILTER}
       LEFT JOIN khung_thoi_gian ktg ON ts.khung_thoi_gian_id = ktg.khung_thoi_gian_id
       GROUP BY ph.phong_hoc_id
       ORDER BY ph.ma_phong`,
      [hocKyResult.value]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.get('/bao-cao', async (req, res) => {
  try {
    const hocKyResult = parseIntParam(req.query.hoc_ky_id, 'hoc_ky_id');
    if (!hocKyResult || hocKyResult.error) {
      return res.status(400).json({ error: hocKyResult?.error || 'hoc_ky_id là bắt buộc!' });
    }

    const [statsResult, lhpResult] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT pcgd.giang_vien_id) AS so_gv,
                COUNT(DISTINCT ts.phong_hoc_id) AS so_phong,
                COUNT(ts.tkb_slot_id) AS so_buoi
         FROM tkb_slot ts
         JOIN thoi_khoa_bieu tkb ON ts.tkb_id = tkb.tkb_id
         JOIN phan_cong_giang_day pcgd ON ts.phan_cong_id = pcgd.phan_cong_id
         WHERE tkb.hoc_ky_id = $1
           AND ts.trang_thai != 'huy'
           AND ${LATEST_TKB_FILTER}`,
        [hocKyResult.value]
      ),
      pool.query(
        'SELECT COUNT(*) as tong_lhp FROM lop_hoc_phan WHERE hoc_ky_id = $1',
        [hocKyResult.value]
      ),
    ]);

    res.json({
      so_giang_vien: parseInt(statsResult.rows[0]?.so_gv || 0, 10),
      so_lop_hoc_phan: parseInt(lhpResult.rows[0]?.tong_lhp || 0, 10),
      so_phong_hoc: parseInt(statsResult.rows[0]?.so_phong || 0, 10),
      so_buoi_hoc: parseInt(statsResult.rows[0]?.so_buoi || 0, 10),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== GỬI THÔNG BÁO =====
// Fix 5: nguoidung KHÔNG có vai_tro → lọc vai trò phải qua nguoidung_vai_tro + vai_tro_catalog
router.post('/thong-bao', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { tieu_de, noi_dung, loai_thong_bao, doi_tuong, buoi_hoc_id } = req.body;

    // Validation: required
    if (!tieu_de || typeof tieu_de !== 'string' || !tieu_de.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'tieu_de là bắt buộc!' });
    }
    if (!noi_dung || typeof noi_dung !== 'string' || !noi_dung.trim()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'noi_dung là bắt buộc!' });
    }

    const allowedLoaiTB = ['thong_tin', 'thay_doi_lich', 'thong_bao_khan', 'yeu_cau'];
    if (loai_thong_bao && !allowedLoaiTB.includes(loai_thong_bao)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'loai_thong_bao khong hop le! (thong_tin | thay_doi_lich | thong_bao_khan | yeu_cau)' });
    }

    // Validation: buoi_hoc_id tồn tại nếu được truyền
    if (buoi_hoc_id !== undefined && buoi_hoc_id !== null) {
      const bhCheck = await client.query('SELECT 1 FROM buoi_hoc WHERE buoi_hoc_id = $1', [buoi_hoc_id]);
      if (bhCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `buoi_hoc_id ${buoi_hoc_id} không tồn tại!` });
      }
    }

    // Bug 2: check trùng UNIQUE (nguoi_tao_id, tieu_de) trong thong_bao
    const dupTB = await client.query(
      'SELECT 1 FROM thong_bao WHERE nguoi_tao_id = $1 AND tieu_de = $2',
      [req.user.user_id, tieu_de]
    );
    if (dupTB.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Tiêu đề thông báo đã tồn tại!' });
    }

    const tbResult = await client.query(
      `INSERT INTO thong_bao (tieu_de, noi_dung, loai_thong_bao, buoi_hoc_id, ngay_tao, nguoi_tao_id)
       VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING *`,
      [tieu_de, noi_dung, loai_thong_bao, buoi_hoc_id || null, req.user.user_id]
    );

    // Validate doi_tuong: phải là vai_tro hợp lệ hoặc 'all'
    const allowedDoiTuong = ['all', 'sinh_vien', 'giang_vien', 'giao_vu', 'truong_khoa', 'admin'];
    if (doi_tuong && !allowedDoiTuong.includes(doi_tuong)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'doi_tuong không hợp lệ! (all | sinh_vien | giang_vien | giao_vu | truong_khoa | admin)' });
    }

    let userQuery = 'SELECT user_id FROM nguoidung WHERE trang_thai = $1';
    let params = ['hoat_dong'];

    if (doi_tuong && doi_tuong !== 'all') {
      userQuery = `
        SELECT DISTINCT nd.user_id FROM nguoidung nd
        JOIN nguoidung_vai_tro nvt ON nd.user_id = nvt.user_id
        JOIN vai_tro_catalog vc ON nvt.vai_tro_id = vc.vai_tro_id
        WHERE vc.ten_vai_tro = $1 AND nd.trang_thai = $2`;
      params = [doi_tuong, 'hoat_dong'];
    }

    const users = await client.query(userQuery, params);
    if (users.rows.length > 0) {
      // Batch insert thay vĂ¬ N+1 loop
      const values = users.rows.map((u, i) => `($1, $${i + 2}, 'cho_gui')`).join(', ');
      await client.query(
        `INSERT INTO thong_bao_nguoi_nhan (thong_bao_id, nguoi_dung_id, trang_thai_gui) VALUES ${values}`,
        [tbResult.rows[0].thong_bao_id, ...users.rows.map(u => u.user_id)]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Gửi thông báo thành công!', data: tbResult.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

// ===== XEM DANH SÁCH THÔNG BÁO =====
// Task 2 fix: cho phép admin/giao_vu xem danh sách thông báo đã gửi
// Hỗ trợ lọc theo loai, khoảng ngày, và phân trang (limit/offset)
router.get('/thong-bao', async (req, res) => {
  try {
    const { loai_thong_bao, tu_ngay, den_ngay, limit, offset } = req.query;

    const allowedLoai = ['thong_tin', 'thay_doi_lich', 'thong_bao_khan', 'yeu_cau'];
    if (loai_thong_bao && !allowedLoai.includes(loai_thong_bao)) {
      return res.status(400).json({ error: 'loai_thong_bao không hợp lệ!' });
    }

    // Pagination defaults
    const pageLimit  = Math.min(100, Math.max(1, parseInt(limit)  || 20));
    const pageOffset = Math.max(0,  parseInt(offset) || 0);

    const conditions = ['1=1'];
    const params    = [];
    let   idx       = 1;

    if (loai_thong_bao) {
      conditions.push(`tb.loai_thong_bao = $${idx++}`);
      params.push(loai_thong_bao);
    }
    if (tu_ngay) {
      conditions.push(`tb.ngay_tao >= $${idx++}`);
      params.push(tu_ngay);
    }
    if (den_ngay) {
      conditions.push(`tb.ngay_tao <= $${idx++}`);
      params.push(den_ngay);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    const dataQuery = `
      SELECT tb.thong_bao_id, tb.tieu_de, tb.noi_dung, tb.loai_thong_bao,
             tb.ngay_tao, tb.buoi_hoc_id,
             nd.ho_ten as nguoi_tao,
             (SELECT COUNT(*) FROM thong_bao_nguoi_nhan tbn WHERE tbn.thong_bao_id = tb.thong_bao_id) as so_nguoi_nhan
      FROM thong_bao tb
      LEFT JOIN nguoidung nd ON tb.nguoi_tao_id = nd.user_id
      ${where}
      ORDER BY tb.ngay_tao DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const countQuery = `SELECT COUNT(*) as total FROM thong_bao tb ${where}`;

    const [dataResult, countResult] = await Promise.all([
      pool.query(dataQuery, [...params, pageLimit, pageOffset]),
      pool.query(countQuery, params),
    ]);

    const total = parseInt(countResult.rows[0].total, 10);
    res.json({
      data:       dataResult.rows,
      pagination: {
        limit:  pageLimit,
        offset: pageOffset,
        total,
        total_pages: Math.ceil(total / pageLimit),
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== GỬI TKB ĐỂ PHÊ DUYỆT =====
// Issue 3 fix: cho Giao Vu chuyển TKB từ 'nhap' → 'cho_phe_duyet'
// để Trưởng khoa phê duyệt sau (theo workflow: nhap → cho_phe_duyet → da_phe_duyet)
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
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.put('/gui-phe-duyet-tkb/:tkb_id', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.tkb_id, 'tkb_id');
    if (!idResult || idResult.error) {
      return res.status(400).json({ error: idResult?.error || 'tkb_id không hợp lệ!' });
    }

    // Kiểm tra TKB tồn tại
    const check = await pool.query('SELECT trang_thai, hoc_ky_id FROM thoi_khoa_bieu WHERE tkb_id = $1', [idResult.value]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Thời khóa biểu không tồn tại!' });
    }

    // Chỉ cho phép chuyển khi đang ở 'nhap'
    if (check.rows[0].trang_thai !== 'nhap') {
      return res.status(400).json({
        error: `TKB đang ở trạng thái "${check.rows[0].trang_thai}", chỉ có thể gửi phê duyệt khi đang ở "nhap"!`
      });
    }

    const result = await pool.query(
      `UPDATE thoi_khoa_bieu SET trang_thai = 'cho_phe_duyet' WHERE tkb_id = $1 RETURNING tkb_id, trang_thai`,
      [idResult.value]
    );

    res.json({ message: 'Đã gửi TKB để phê duyệt thành công!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

// ===== CÔNG BỐ TKB =====
router.put('/cong-bo-tkb/:tkb_id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const idResult = parseIntParam(req.params.tkb_id, 'tkb_id');
    if (!idResult || idResult.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: idResult?.error || 'tkb_id không hợp lệ!' });
    }

    // Kiểm tra trạng thái TKB trước khi công bố
    const check = await client.query('SELECT trang_thai, hoc_ky_id FROM thoi_khoa_bieu WHERE tkb_id = $1', [idResult.value]);
    if (check.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Thời khóa biểu không tồn tại!' });
    }
    if (check.rows[0].trang_thai !== 'da_phe_duyet') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'TKB phải được phê duyệt trước khi công bố!' });
    }

    // Cập nhật trạng thái TKB
    const result = await client.query(
      `UPDATE thoi_khoa_bieu SET trang_thai = 'da_cong_bo', ngay_cong_bo = NOW() WHERE tkb_id = $1 RETURNING tkb_id`,
      [idResult.value]
    );

    // Task 3 fix: gửi thông báo cho sinh viên và giảng viên liên quan
    // Lấy hoc_ky_id để xác định các lớp học phần trong TKB này
    const { hoc_ky_id } = check.rows[0];

    // Tạo thông báo chung
    const tbResult = await client.query(
      `INSERT INTO thong_bao (tieu_de, noi_dung, loai_thong_bao, ngay_tao, nguoi_tao_id)
       VALUES ($1, $2, 'thong_tin', NOW(), $3) RETURNING thong_bao_id`,
      [`Thông báo công bố Thời khóa biểu HK ${hoc_ky_id}`,
       `Thời khóa biểu học kỳ đã được công bố. Vui lòng kiểm tra lịch học mới.`,
       req.user.user_id]
    );
    const thong_bao_id = tbResult.rows[0].thong_bao_id;

    // Lấy danh sách sinh viên thuộc các lớp học phần của học kỳ này
    const svRows = await client.query(
      `SELECT DISTINCT sv.user_id
       FROM sinhvien_lophocphan svlhp
       JOIN sinhvien sv ON svlhp.sinh_vien_id = sv.sinh_vien_id
       JOIN lop_hoc_phan lhp ON svlhp.lop_hoc_phan_id = lhp.lop_hoc_phan_id
       WHERE lhp.hoc_ky_id = $1 AND svlhp.trang_thai = 'hoat_dong'`,
      [hoc_ky_id]
    );

    // Lấy danh sách giảng viên được phân công trong học kỳ này
    const gvRows = await client.query(
      `SELECT DISTINCT gv.user_id
       FROM phan_cong_giang_day pcgd
       JOIN lop_hoc_phan lhp ON pcgd.lop_hoc_phan_id = lhp.lop_hoc_phan_id
       JOIN giangvien gv ON pcgd.giang_vien_id = gv.giang_vien_id
       WHERE lhp.hoc_ky_id = $1`,
      [hoc_ky_id]
    );

    // Gộp danh sách người nhận (sinh viên + giảng viên)
    const allUsers = [
      ...svRows.rows.map(r => r.user_id),
      ...gvRows.rows.map(r => r.user_id),
    ];

    if (allUsers.length > 0) {
      const values = allUsers.map((uid, i) => `($1, $${i + 2}, 'cho_gui')`).join(', ');
      await client.query(
        `INSERT INTO thong_bao_nguoi_nhan (thong_bao_id, nguoi_dung_id, trang_thai_gui) VALUES ${values}`,
        [thong_bao_id, ...allUsers]
      );
    }

    await client.query('COMMIT');
    res.json({ message: 'Công bố TKB thành công! Đã gửi thông báo.', so_nguoi_nhan: allUsers.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

// ===== SỬA BUỔI HỌC (cập nhật thay vì tạo mới) =====
// Issue 1 fix: PUT /buoi-hoc/:id — cập nhật buổi học thay vì tạo bản sao
router.put('/buoi-hoc/:id', async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const idResult = parseIntParam(req.params.id, 'buoi_hoc_id');
    if (!idResult || idResult.error) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });
    }

    // Kiểm tra buổi học tồn tại và không bị hủy
    const exist = await client.query('SELECT * FROM buoi_hoc WHERE buoi_hoc_id = $1', [idResult.value]);
    if (exist.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Buổi học không tồn tại!' });
    }
    if (exist.rows[0].trang_thai === 'huy') {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Buổi học đã bị hủy, không thể cập nhật!' });
    }

    const {
      phong_hoc_id, khung_thoi_gian_id, ngay_hoc, hinh_thuc, ghi_chu
      // NOTE: tkb_id, phan_cong_id KHÔNG cho phép sửa để tránh phá vỡ FK và học kỳ
    } = req.body;

    // Validation: phong_hoc_id bắt buộc nếu truyền
    if (phong_hoc_id !== undefined && phong_hoc_id !== null) {
      const phCheck = await client.query(
        'SELECT trang_thai, loai_phong FROM phong_hoc WHERE phong_hoc_id = $1',
        [phong_hoc_id]
      );
      if (phCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `phong_hoc_id ${phong_hoc_id} không tồn tại!` });
      }
      if (phCheck.rows[0].trang_thai !== 'hoat_dong') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Phòng học đang ở trạng thái "${phCheck.rows[0].trang_thai}", không thể sử dụng!` });
      }
    }

    // Validation: khung_thoi_gian_id bắt buộc nếu truyền
    if (khung_thoi_gian_id !== undefined && khung_thoi_gian_id !== null) {
      const ktgCheck = await client.query('SELECT 1 FROM khung_thoi_gian WHERE khung_thoi_gian_id = $1', [khung_thoi_gian_id]);
      if (ktgCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `khung_thoi_gian_id ${khung_thoi_gian_id} không tồn tại!` });
      }
    }

    // Validation: ngay_hoc nằm trong khoảng học kỳ
    const targetNgayHoc = ngay_hoc || exist.rows[0].ngay_hoc;
    const targetPhongId = phong_hoc_id || exist.rows[0].phong_hoc_id;
    const targetKtgId   = khung_thoi_gian_id || exist.rows[0].khung_thoi_gian_id;

    const hkInfo = await client.query(
      `SELECT hk.ngay_bat_dau, hk.ngay_ket_thuc
       FROM hoc_ky hk
       JOIN thoi_khoa_bieu tkb ON tkb.hoc_ky_id = hk.hoc_ky_id
       WHERE tkb.tkb_id = $1`,
      [exist.rows[0].tkb_id]
    );
    if (hkInfo.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'TKB không tồn tại!' });
    }
    const { ngay_bat_dau, ngay_ket_thuc } = hkInfo.rows[0];
    if (ngay_bat_dau && targetNgayHoc < ngay_bat_dau) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ngày học trước ngày bắt đầu học kỳ!' });
    }
    if (ngay_ket_thuc && targetNgayHoc > ngay_ket_thuc) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Ngày học sau ngày kết thúc học kỳ!' });
    }

    // Lấy giang_vien_id từ phan_cong_id để kiểm tra trùng lịch (bỏ qua chính bản thân)
    const pcResult = await client.query(
      'SELECT giang_vien_id FROM phan_cong_giang_day WHERE phan_cong_id = $1',
      [exist.rows[0].phan_cong_id]
    );
    const giang_vien_id = pcResult.rows[0].giang_vien_id;

    // Kiểm tra trùng phòng (bỏ qua bản ghi hiện tại)
    if (targetPhongId && targetKtgId) {
      const conflictPhong = await client.query(`
        SELECT COUNT(*) as count FROM buoi_hoc bh
        WHERE bh.phong_hoc_id = $1
          AND bh.ngay_hoc = $2
          AND bh.khung_thoi_gian_id = $3
          AND bh.trang_thai = 'hoat_dong'
          AND bh.buoi_hoc_id != $4
      `, [targetPhongId, targetNgayHoc, targetKtgId, idResult.value]);

      if (parseInt(conflictPhong.rows[0].count) > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Phòng học bị trùng lịch!' });
      }

      // Kiểm tra trùng giảng viên (bỏ qua bản ghi hiện tại)
      const gvCheck = await client.query(`
        SELECT COUNT(*) as count FROM buoi_hoc bh
        WHERE bh.phan_cong_id IN (
          SELECT phan_cong_id FROM phan_cong_giang_day WHERE giang_vien_id = $1
        )
        AND bh.ngay_hoc = $2
        AND bh.khung_thoi_gian_id = $3
        AND bh.trang_thai = 'hoat_dong'
        AND bh.buoi_hoc_id != $4
      `, [giang_vien_id, targetNgayHoc, targetKtgId, idResult.value]);

      if (parseInt(gvCheck.rows[0].count) > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Giảng viên bị trùng lịch!' });
      }

      // Kiểm tra tải giảng viên (bỏ qua bản ghi hiện tại)
      const gvQuota = await client.query(
        'SELECT gioi_han_tai_giang FROM giangvien WHERE giang_vien_id = $1',
        [giang_vien_id]
      );
      if (gvQuota.rows[0].gioi_han_tai_giang > 0) {
        const currentLoad = await client.query(`
          SELECT COUNT(DISTINCT bh.buoi_hoc_id) as so_buoi
          FROM buoi_hoc bh
          JOIN thoi_khoa_bieu tkb ON bh.tkb_id = tkb.tkb_id
          WHERE bh.phan_cong_id IN (
            SELECT phan_cong_id FROM phan_cong_giang_day WHERE giang_vien_id = $1
          )
          AND bh.trang_thai = 'hoat_dong'
          AND bh.buoi_hoc_id != $2
          AND tkb.hoc_ky_id = (SELECT hoc_ky_id FROM thoi_khoa_bieu WHERE tkb_id = $3)
        `, [giang_vien_id, idResult.value, exist.rows[0].tkb_id]);

        if (parseInt(currentLoad.rows[0].so_buoi) >= gvQuota.rows[0].gioi_han_tai_giang) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: `Giảng viên đã đạt giới hạn tải giảng (${gvQuota.rows[0].gioi_han_tai_giang} buổi)!` });
        }
      }
    }

    // Build update — chỉ cập nhật các trường được truyền
    const updates = [];
    const params = [];
    let paramIdx = 1;

    if (phong_hoc_id !== undefined) {
      updates.push(`phong_hoc_id = $${paramIdx++}`);
      params.push(phong_hoc_id);
    }
    if (khung_thoi_gian_id !== undefined) {
      updates.push(`khung_thoi_gian_id = $${paramIdx++}`);
      params.push(khung_thoi_gian_id);
    }
    if (ngay_hoc !== undefined) {
      updates.push(`ngay_hoc = $${paramIdx++}`);
      params.push(ngay_hoc);
    }
    if (hinh_thuc !== undefined) {
      updates.push(`hinh_thuc = $${paramIdx++}`);
      params.push(hinh_thuc);
    }
    if (ghi_chu !== undefined) {
      updates.push(`ghi_chu = $${paramIdx++}`);
      params.push(ghi_chu);
    }

    if (updates.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Không có trường nào để cập nhật!' });
    }

    params.push(idResult.value);
    const result = await client.query(
      `UPDATE buoi_hoc SET ${updates.join(', ')} WHERE buoi_hoc_id = $${paramIdx} RETURNING *`,
      params
    );

    await client.query('COMMIT');
    res.json({ message: 'Cập nhật buổi học thành công!', data: result.rows[0] });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  } finally {
    client.release();
  }
});

// ===== XÓA BUỔI HỌC =====
router.delete('/buoi-hoc/:id', async (req, res) => {
  try {
    const idResult = parseIntParam(req.params.id, 'buoi_hoc_id');
    if (!idResult || idResult.error) {
      return res.status(400).json({ error: idResult?.error || 'ID không hợp lệ!' });
    }

    // Check tồn tại
    const exist = await pool.query('SELECT trang_thai FROM buoi_hoc WHERE buoi_hoc_id = $1', [idResult.value]);
    if (exist.rows.length === 0) {
      return res.status(404).json({ error: 'Buổi học không tồn tại!' });
    }
    if (exist.rows[0].trang_thai === 'huy') {
      return res.status(400).json({ error: 'Buổi học đã bị hủy trước đó!' });
    }

    await pool.query(
      `UPDATE buoi_hoc SET trang_thai = 'huy' WHERE buoi_hoc_id = $1`,
      [idResult.value]
    );
    res.json({ message: 'Xóa buổi học thành công!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.get('/sinh-vien', async (req, res) => {
  try {
    const {
      q,
      trang_thai = 'hoat_dong',
      lop_hanh_chinh_id,
      limit = 200,
      offset = 0,
    } = req.query;

    const allowedTrangThai = ['hoat_dong', 'khoa', 'all'];
    if (!allowedTrangThai.includes(trang_thai)) {
      return res.status(400).json({ error: 'trang_thai khong hop le!' });
    }

    const pageLimit = Math.min(200, Math.max(1, parseInt(limit, 10) || 200));
    const pageOffset = Math.max(0, parseInt(offset, 10) || 0);
    const params = [];
    const conditions = [
      `EXISTS (
        SELECT 1
        FROM nguoidung_vai_tro nvt
        JOIN vai_tro_catalog vt ON nvt.vai_tro_id = vt.vai_tro_id
        WHERE nvt.user_id = nd.user_id
          AND vt.ten_vai_tro = 'sinh_vien'
      )`,
      'sv.sinh_vien_id IS NOT NULL',
    ];

    if (trang_thai !== 'all') {
      params.push(trang_thai);
      conditions.push(`nd.trang_thai = $${params.length}`);
    }

    if (q && typeof q === 'string' && q.trim()) {
      params.push(`%${q.trim()}%`);
      conditions.push(`(nd.ho_ten ILIKE $${params.length} OR nd.email ILIKE $${params.length} OR sv.ma_sv ILIKE $${params.length})`);
    }

    if (lop_hanh_chinh_id !== undefined && lop_hanh_chinh_id !== '') {
      const lopId = parseInt(lop_hanh_chinh_id, 10);
      if (Number.isNaN(lopId) || lopId <= 0) {
        return res.status(400).json({ error: 'lop_hanh_chinh_id khong hop le!' });
      }
      params.push(lopId);
      conditions.push(`sv.lop_hanh_chinh_id = $${params.length}`);
    }

    const dataResult = await pool.query(
      `SELECT nd.user_id, nd.ho_ten, nd.email, nd.trang_thai,
              sv.sinh_vien_id, sv.ma_sv, sv.lop_hanh_chinh_id
       FROM nguoidung nd
       JOIN sinhvien sv ON nd.user_id = sv.user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY sv.ma_sv ASC, nd.ho_ten ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, pageLimit, pageOffset]
    );

    res.json({ data: dataResult.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Loi server!' });
  }
});

router.get('/sinh-vien-lhp', async (req, res) => {
  try {
    const lhpResult = parseIntParam(req.query.lop_hoc_phan_id, 'lop_hoc_phan_id');
    if (lhpResult && lhpResult.error) return res.status(400).json({ error: lhpResult.error });

    const allowedTrangThai = ['hoat_dong', 'huy', 'all'];
    const trangThai = req.query.trang_thai || 'hoat_dong';
    if (!allowedTrangThai.includes(trangThai)) {
      return res.status(400).json({ error: 'trang_thai khong hop le!' });
    }

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
    if (conditions.length > 0) query += ` WHERE ${conditions.join(' AND ')}`;
    query += ` ORDER BY svlh.id LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;

    const result = await pool.query(query, [...params, pageLimit, pageOffset]);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Lỗi server!' });
  }
});

router.post('/sinh-vien-lhp', async (req, res) => {
  const { sinh_vien_id, lop_hoc_phan_id } = req.body;

  if (!sinh_vien_id || typeof sinh_vien_id !== 'number') {
    return res.status(400).json({ error: 'Thiếu hoặc sai kiểu sinh_vien_id!' });
  }
  if (!lop_hoc_phan_id || typeof lop_hoc_phan_id !== 'number') {
    return res.status(400).json({ error: 'Thiếu hoặc sai kiểu lop_hoc_phan_id!' });
  }

  try {
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

    const { si_so_toi_da, so_luong } = lhpCheck.rows[0];
    if (parseInt(so_luong) >= si_so_toi_da) {
      return res.status(400).json({ error: 'Lớp học phần đã đủ sĩ số!' });
    }

    const existing = await pool.query(
      'SELECT id, trang_thai FROM sinhvien_lophocphan WHERE sinh_vien_id = $1 AND lop_hoc_phan_id = $2',
      [sinh_vien_id, lop_hoc_phan_id]
    );

    let result;
    if (existing.rows.length > 0) {
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

router.delete('/sinh-vien-lhp', async (req, res) => {
  const { sinh_vien_id, lop_hoc_phan_id } = req.query;

  if (!sinh_vien_id || !lop_hoc_phan_id) {
    return res.status(400).json({ error: 'sinh_vien_id và lop_hoc_phan_id là bắt buộc!' });
  }

  const svId  = parseInt(sinh_vien_id, 10);
  const lhpId = parseInt(lop_hoc_phan_id, 10);
  if (isNaN(svId) || isNaN(lhpId) || svId <= 0 || lhpId <= 0) {
    return res.status(400).json({ error: 'ID không hợp lệ!' });
  }

  try {
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

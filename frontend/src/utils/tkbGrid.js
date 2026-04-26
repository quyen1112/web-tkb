/**
 * tkbGrid.js — Hàm build grid cho lưới TKB
 * Design.md mục 5.1: grid[thu_trong_tuan][tiet_bat_dau] = buoi_hoc
 * Dùng chung cho mọi vai trò.
 */
import dayjs from 'dayjs';

/** Danh sách thứ cố định dùng làm grid key
 *  2=T2, 3=T3, 4=T4, 5=T5, 6=T6, 7=T7, 8=CN
 *  Giá trị = dayjs().day() + 1 với CN: 0 → 8
 */
export const THUS = [
  { value: 2, label: 'Thứ 2' },
  { value: 3, label: 'Thứ 3' },
  { value: 4, label: 'Thứ 4' },
  { value: 5, label: 'Thứ 5' },
  { value: 6, label: 'Thứ 6' },
  { value: 7, label: 'Thứ 7' },
  { value: 8, label: 'CN'   },
];

/** 11 tiết học */
export const TIETS = Array.from({ length: 11 }, (_, i) => i + 1);

/** Map thứ → label */
export const THU_LABELS = Object.fromEntries(THUS.map(t => [t.value, t.label]));

/**
 * buildGrid — chuyển buoiHoc[] thành grid 2 chiều
 * @param {Array}  buoiHoc  — mảng buổi học từ API
 * @returns {Object} grid[thu][tiet] = buoiHoc[] (LUÔN luôn là array, không bao giờ là object đơn lẻ)
 *
 * Shape contract:
 *   grid[2..8][1..11] = buoiHoc[]  (luôn là array, có thể rỗng)
 *
 * Logic:
 *   - Ưu tiên thu_trong_tuan từ buoi_hoc
 *   - Fallback: tính từ ngay_hoc (dayjs) nếu không có
 *   - CN = dayjs().day() === 0 → value 8
 */
export function buildGrid(buoiHoc = []) {
  const grid = {};
  THUS.forEach(t => { grid[t.value] = {}; });

  buoiHoc.forEach(bh => {
    const thu = bh.thu_trong_tuan
      ?? (bh.ngay_hoc
        ? (dayjs(bh.ngay_hoc).day() === 0 ? 8 : dayjs(bh.ngay_hoc).day() + 1)
        : 2);

    if (!grid[thu]) grid[thu] = {};
    if (!Array.isArray(grid[thu][bh.tiet_bat_dau])) {
      grid[thu][bh.tiet_bat_dau] = [];
    }
    grid[thu][bh.tiet_bat_dau].push(bh);
  });

  return grid;
}

/**
 * Lấy thứ (2–8) từ một dayjs date.
 * dayjs().day() → 0=CN, 1=T2, 2=T3, ..., 6=T7
 * → map về grid key: 2,3,4,5,6,7,8
 * Dùng cho buildGrid() và colHeader trong TKBGrid.
 */
export function getThuFromDate(date) {
  const day = date.day();
  // 0=CN → 8, 1=T2 → 2, 2=T3 → 3, ..., 6=T7 → 7
  return day === 0 ? 8 : day + 1;
}

/**
 * Lấy label thứ cho một date
 */
export function getThuLabel(date) {
  return THU_LABELS[getThuFromDate(date)] ?? '';
}

/**
 * Tạo danh sách 7 ngày trong tuần từ startOfWeek
 * @param {dayjs} startOfWeek — thứ 2
 * @returns {dayjs[]}
 */
export function getWeekDates(startOfWeek) {
  return Array.from({ length: 7 }, (_, i) =>
    dayjs(startOfWeek).add(i, 'day')
  );
}

/**
 * Lấy ngày đầu tuần hiện tại (thứ 2)
 * @returns {dayjs}
 */
export function getCurrentWeekStart() {
  const today = dayjs();
  const dow = today.day();
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  return today.subtract(daysFromMonday, 'day').startOf('day');
}

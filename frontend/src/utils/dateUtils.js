/**
 * dateUtils.js — dayjs helper functions
 * Design.md mục 11.2 (date handling)
 */
import dayjs from 'dayjs';

const extractDatePart = (value) => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};

/** Format ngày DD/MM/YYYY */
export const fmtDate = (date) => {
  if (!date) return '';
  const datePart = extractDatePart(date);
  const target = datePart || date;
  return dayjs(target).format('DD/MM/YYYY');
};

/** Format giờ HH:mm (09g50 format từ backend) */
export const fmtTime = (time) => {
  if (!time) return '';
  // Backend trả về "09:50:00" hoặc "09g50"
  if (time.includes('g')) return time; // đã format sẵn
  return dayjs(`2000-01-01 ${time}`).format('HH:mm');
};

/** Format ngày + giờ */
export const fmtDateTime = (dt) => {
  if (!dt) return '';
  return dayjs(dt).format('DD/MM/YYYY HH:mm');
};

/** Tính tuần hiện tại (start = thứ 2, end = CN) */
export function getCurrentWeek() {
  const today = dayjs();
  const dow = today.day(); // 0=CN, 1=T2, ..., 6=T7
  const daysFromMonday = dow === 0 ? 6 : dow - 1;
  const start = today.subtract(daysFromMonday, 'day').startOf('day');
  const end = start.add(6, 'day');
  return [start, end];
}

/** Navigate tuần trước / sau */
export function navigateWeek(currentRange, direction) {
  const [start, end] = currentRange;
  const newStart = start.add(direction * 7, 'day');
  const newEnd = newStart.add(6, 'day');
  return [newStart, newEnd];
}

/** Kiểm tra ngày có trong tuần không */
export function isInWeek(date, weekRange) {
  const [start, end] = weekRange;
  const d = dayjs(date);
  return d.isAfter(start.subtract(1, 'day')) && d.isBefore(end.add(1, 'day'));
}

/** Format khoảng ngày hiển thị */
export function fmtWeekRange(weekRange) {
  if (!weekRange) return '';
  const [start, end] = weekRange;
  return `${fmtDate(start)} – ${fmtDate(end)}`;
}

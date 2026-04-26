/**
 * formatters.js — Display formatting helpers
 * Design.md mục 11.2 (formatters)
 */

/** Format tiết: 1 → "Tiết 1", 3-5 → "Tiết 3-5" */
export function fmtTiet(tietBatDau, tietKetThuc) {
  if (!tietKetThuc || tietBatDau === tietKetThuc) return `Tiết ${tietBatDau}`;
  return `Tiết ${tietBatDau}–${tietKetThuc}`;
}

/** Format giờ: "07:00 - 09:30" */
export function fmtGio(gioBatDau, gioKetThuc) {
  if (!gioBatDau && !gioKetThuc) return '';
  return `${gioBatDau ?? ''} – ${gioKetThuc ?? ''}`.trim().replace(/^–|–$/g, '');
}

/** Badge trạng thái TKB (theo design.md mục 5.4) */
export const TKB_STATUS_CONFIG = {
  nhap:          { color: 'default',   label: 'Nhập liệu',       icon: 'edit' },
  cho_phe_duyet: { color: 'warning',   label: 'Chờ phê duyệt',   icon: 'clock-circle' },
  da_phe_duyet:  { color: 'processing', label: 'Đã phê duyệt',   icon: 'check-circle' },
  da_cong_bo:    { color: 'success',   label: 'Đã công bố',      icon: 'rocket' },
};

/** Lấy config trạng thái TKB */
export function getTKBStatusConfig(trangThai) {
  return TKB_STATUS_CONFIG[trangThai] ?? { color: 'default', label: trangThai, icon: 'info' };
}

/** Badge trạng thái đa năng */
export const TRANG_THAI_YC_CONFIG = {
  cho_duyet:  { color: 'warning',   label: 'Chờ duyệt' },
  da_duyet:   { color: 'success',   label: 'Đã duyệt' },
  tu_choi:    { color: 'error',     label: 'Từ chối' },
  huy:        { color: 'default',   label: 'Đã hủy' },
};

/** Label vai trò người dùng */
export const VAI_TRO_LABELS = {
  admin:        'Quản trị viên',
  giao_vu:      'Giáo vụ',
  giang_vien:   'Giảng viên',
  sinh_vien:    'Sinh viên',
  truong_khoa:  'Trưởng khoa',
};

/** Label hình thức học */
export const HINH_THUC_LABELS = {
  ly_thuyet:  { label: 'LT', color: '#fa8c16' },
  thuc_hanh:  { label: 'TH', color: '#52c41a' },
};

/** Format hình thức badge */
export function fmtHinhThuc(hinhThuc) {
  const config = HINH_THUC_LABELS[hinhThuc];
  return config ?? { label: hinhThuc ?? '', color: '#999' };
}

/** Format khoảng thời gian (trong buổi card) */
export function fmtBuoiHocDisplay(bh) {
  return {
    tiet:    fmtTiet(bh.tiet_bat_dau, bh.tiet_ket_thuc),
    gio:     fmtGio(bh.gio_bat_dau, bh.gio_ket_thuc),
    phong:   bh.ten_phong ?? bh.ma_phong ?? '',
    lopHP:   bh.ma_lop_hp ?? '',
    mon:     bh.ten_mon ?? '',
    gv:      bh.ten_gv ?? '',
    hinhThuc: fmtHinhThuc(bh.hinh_thuc),
  };
}

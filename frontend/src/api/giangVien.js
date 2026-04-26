/**
 * Giảng Viên API
 * Design.md mục 6.3
 */
import client from './client';

export const giangVien = {
  /** GET /giang-vien/tkb-ca-nhan?hoc_ky_id= → buoi_hoc[] */
  getTkbCaNhan: (hocKyId) =>
    client.get('/giang-vien/tkb-ca-nhan', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),

  /** POST /giang-vien/khai-bao-lich-ban
   *  Body: { hoc_ky_id, khung_thoi_gian_id, ngay_cu_the?, ly_do }
   */
  khaiBaoLichBan: (data) =>
    client.post('/giang-vien/khai-bao-lich-ban', data).then(r => r.data),

  /** GET /giang-vien/lich-ban → lich_ban[] */
  getLichBan: () =>
    client.get('/giang-vien/lich-ban').then(r => r.data),

  /** POST /giang-vien/yeu-cau-dieu-chinh
   *  Body: { buoi_hoc_id, loai_yeu_cau_id, ly_do?, noi_dung_de_xuat? }
   */
  guiYeuCauDieuChinh: (data) =>
    client.post('/giang-vien/yeu-cau-dieu-chinh', data).then(r => r.data),

  /** GET /giang-vien/thong-bao → thong_bao[] */
  getThongBao: () =>
    client.get('/giang-vien/thong-bao').then(r => r.data),
};
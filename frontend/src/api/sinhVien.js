/**
 * Sinh Viên API
 * Design.md mục 6.2
 */
import client from './client';

export const sinhVien = {
  /** GET /sinh-vien/tkb-ca-nhan?hoc_ky_id=
   *  → buoi_hoc[] (đã join phan_cong, mon_hoc, phong_hoc, khung_thoi_gian)
   */
  getTkbCaNhan: (hocKyId) =>
    client.get('/sinh-vien/tkb-ca-nhan', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),

  /** GET /sinh-vien/thong-bao → thong_bao[] */
  getThongBao: () =>
    client.get('/sinh-vien/thong-bao').then(r => r.data),

  /** PUT /sinh-vien/thong-bao/:id/doc → đánh dấu đã đọc */
  markThongBaoRead: (id) =>
    client.put(`/sinh-vien/thong-bao/${id}/doc`).then(r => r.data),
};
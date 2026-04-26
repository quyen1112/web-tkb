/**
 * Trưởng Khoa API
 * Design.md mục 6.5
 */
import client from './client';

export const truongKhoa = {
  /** GET /truong-khoa/thoi-khoa-bieu?hoc_ky_id= → buoi_hoc[] + trang_thai TKB */
  getThoiKhoaBieu: (hocKyId) =>
    client.get('/truong-khoa/thoi-khoa-bieu', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),

  /** PUT /truong-khoa/phe-duyet-tkb/:tkb_id → cho_phe_duyet → da_phe_duyet */
  pheDuyetTKB: (tkbId) =>
    client.put(`/truong-khoa/phe-duyet-tkb/${tkbId}`).then(r => r.data),

  /** PUT /truong-khoa/tu-choi-tkb/:tkb_id → cho_phe_duyet → nhap (không lưu lý do từ chối) */
  tuChoiTKB: (tkbId) =>
    client.put(`/truong-khoa/tu-choi-tkb/${tkbId}`).then(r => r.data),

  /** GET /truong-khoa/yeu-cau-dieu-chinh?trang_thai=&page=&limit= → { data[], pagination } */
  getYeuCauDieuChinh: (params) =>
    client.get('/truong-khoa/yeu-cau-dieu-chinh', { params }).then(r => r.data),

  /** PUT /truong-khoa/yeu-cau-dieu-chinh/:id/duyet
   *  Body: { hanh_dong: 'dong_y'|'tu_choi', noi_dung_phan_hoi? }
   */
  duyetYeuCauDieuChinh: (id, data) =>
    client.put(`/truong-khoa/yeu-cau-dieu-chinh/${id}/duyet`, data).then(r => r.data),

  /** GET /truong-khoa/bao-cao?hoc_ky_id= → { so_giang_vien, so_lop_hoc_phan, ... } */
  getBaoCao: (hocKyId) =>
    client.get('/truong-khoa/bao-cao', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),
};
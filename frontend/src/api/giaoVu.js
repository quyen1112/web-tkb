/**
 * Giáo Vụ API
 * Design.md mục 6.4
 */
import client from './client';

export const giaoVu = {
  // --- Học kỳ ---
  /** GET /giao-vu/hoc-ky → hoc_ky[] */
  getHocKy: () =>
    client.get('/giao-vu/hoc-ky').then(r => r.data),

  // --- TKB ---
  /** POST /giao-vu/tao-tkb → tạo TKB mới, trạng thái 'nhap' */
  createTKB: (data) =>
    client.post('/giao-vu/tao-tkb', data).then(r => r.data),

  /** GET /giao-vu/thoi-khoa-bieu?hoc_ky_id= → buoi_hoc[] + trang_thai TKB */
  getThoiKhoaBieu: (hocKyId) =>
    client.get('/giao-vu/thoi-khoa-bieu', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),

  // --- Buổi học ---
  /** POST /giao-vu/buoi-hoc → tạo buổi học (DB trigger conflict check) */
  createBuoiHoc: (data) =>
    client.post('/giao-vu/buoi-hoc', data).then(r => r.data),

  /** PUT /giao-vu/buoi-hoc/:id → cập nhật buổi học */
  updateBuoiHoc: (id, data) =>
    client.put(`/giao-vu/buoi-hoc/${id}`, data).then(r => r.data),

  /** DELETE /giao-vu/buoi-hoc/:id → xóa mềm (trang_thai='huy') */
  deleteBuoiHoc: (id) =>
    client.delete(`/giao-vu/buoi-hoc/${id}`).then(r => r.data),

  // --- TKB actions ---
  /** PUT /giao-vu/gui-phe-duyet-tkb/:tkb_id → nhap → cho_phe_duyet */
  guiPheDuyet: (tkbId) =>
    client.put(`/giao-vu/gui-phe-duyet-tkb/${tkbId}`).then(r => r.data),

  /** PUT /giao-vu/cong-bo-tkb/:tkb_id → da_phe_duyet → da_cong_bo */
  congBo: (tkbId) =>
    client.put(`/giao-vu/cong-bo-tkb/${tkbId}`).then(r => r.data),

  // --- Danh mục ---
  /** GET /giao-vu/mon-hoc → mon_hoc[] */
  getMonHoc: () =>
    client.get('/giao-vu/mon-hoc').then(r => r.data),

  /** GET /giao-vu/phong-hoc → phong_hoc[] */
  getPhongHoc: () =>
    client.get('/giao-vu/phong-hoc').then(r => r.data),

  /** GET /giao-vu/khung-thoi-gian → khung_thoi_gian[] (26 rows cố định) */
  getKhungThoiGian: () =>
    client.get('/giao-vu/khung-thoi-gian').then(r => r.data),

  /** GET /giao-vu/lop-hoc-phan?hoc_ky_id= → lop_hoc_phan[] */
  getLopHocPhan: (hocKyId) =>
    client.get('/giao-vu/lop-hoc-phan', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),

  /** GET /giao-vu/phan-cong?hoc_ky_id= → phan_cong[] */
  getPhanCong: (hocKyId) =>
    client.get('/giao-vu/phan-cong', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),

  /** POST /giao-vu/lop-hoc-phan → tạo lớp HP
   *  Giả định: backend chưa có PUT/DELETE (design.md mục 10.3)
   */
  createLopHocPhan: (data) =>
    client.post('/giao-vu/lop-hoc-phan', data).then(r => r.data),

  /** POST /giao-vu/phan-cong → phân công GV cho lớp HP */
  createPhanCong: (data) =>
    client.post('/giao-vu/phan-cong', data).then(r => r.data),

  // --- Lịch bận ---
  /** GET /giao-vu/lich-ban → lich_ban[] */
  getLichBan: () =>
    client.get('/giao-vu/lich-ban').then(r => r.data),

  /** PUT /giao-vu/lich-ban/:id/duyet → duyệt lịch bận GV */
  duyetLichBan: (id) =>
    client.put(`/giao-vu/lich-ban/${id}/duyet`).then(r => r.data),

  // --- Thông báo ---
  /** POST /giao-vu/thong-bao */
  createThongBao: (data) =>
    client.post('/giao-vu/thong-bao', data).then(r => r.data),

  // --- Báo cáo ---
  /** GET /giao-vu/bao-cao-phong?hoc_ky_id= → thống kê sử dụng phòng */
  getBaoCaoPhong: (hocKyId) =>
    client.get('/giao-vu/bao-cao-phong', { params: { hoc_ky_id: hocKyId } })
      .then(r => r.data),
};
/**
 * Admin API
 * Design.md mục 6.6
 */
import client from './client';

export const admin = {
  /** GET /admin/nguoi-dung?vai_tro=&q=&page=&limit= → { data[], pagination } */
  getNguoiDung: (params) =>
    client.get('/admin/nguoi-dung', { params }).then(r => r.data),

  /** POST /admin/nguoi-dung */
  createNguoiDung: (data) =>
    client.post('/admin/nguoi-dung', data).then(r => r.data),

  /** PUT /admin/nguoi-dung/:id/khoa → toggle hoat_dong/khoa */
  toggleKhoa: (id) =>
    client.put(`/admin/nguoi-dung/${id}/khoa`).then(r => r.data),

  /** DELETE /admin/nguoi-dung/:id → soft delete */
  deleteNguoiDung: (id) =>
    client.delete(`/admin/nguoi-dung/${id}`).then(r => r.data),

  /** GET /admin/sinh-vien-lhp?lop_hoc_phan_id= */
  getSinhVienLHP: (params) =>
    client.get('/admin/sinh-vien-lhp', { params }).then(r => r.data),

  /** POST /admin/sinh-vien-lhp */
  addSinhVienLHP: (data) =>
    client.post('/admin/sinh-vien-lhp', data).then(r => r.data),

  /** DELETE /admin/sinh-vien-lhp?sinh_vien_id=&lop_hoc_phan_id= */
  removeSinhVienLHP: (params) =>
    client.delete('/admin/sinh-vien-lhp', { params }).then(r => r.data),

  /** GET /admin/hoc-ky → hoc_ky[] */
  getHocKy: () =>
    client.get('/admin/hoc-ky').then(r => r.data),

  /** POST /admin/hoc-ky */
  createHocKy: (data) =>
    client.post('/admin/hoc-ky', data).then(r => r.data),
};
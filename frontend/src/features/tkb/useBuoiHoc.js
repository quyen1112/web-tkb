/**
 * useBuoiHoc.js — React Query mutations cho buổi học.
 *
 * Cung cấp 4 mutation hooks:
 *   useCreateBuoiHoc      → POST /giao-vu/buoi-hoc
 *   useUpdateBuoiHoc      → PUT  /giao-vu/buoi-hoc/:id
 *   useDeleteBuoiHoc      → DELETE /giao-vu/buoi-hoc/:id
 *   useCreateYeuCauDieuChinh → POST /giang-vien/yeu-cau-dieu-chinh
 *
 * Conflict/error từ backend (DB trigger) được xử lý ở hook level.
 * onSuccess luôn invalidate ['tkb'] để trigger refetch.
 */
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { message } from 'antd';
import { giaoVu } from '../../api/giaoVu';
import { giangVien } from '../../api/giangVien';

// ─── Shared onError handler factory ────────────────────────────────────────
function makeOnError(fallback) {
  return (err) => {
    const msg = err?.response?.data?.error || err?.response?.data?.message || fallback;
    message.error(msg);
  };
}

// ─── useCreateBuoiHoc ──────────────────────────────────────────────────────
/**
 * Tạo buổi học mới.
 * Payload gửi lên backend đã được normalize ở BuoiHocModal.buildPayload().
 */
export function useCreateBuoiHoc({ onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => giaoVu.createBuoiHoc(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tkb'] });
      onSuccess?.(vars);
    },
    onError: makeOnError('Lỗi thêm buổi học'),
  });
}

// ─── useUpdateBuoiHoc ───────────────────────────────────────────────────────
/**
 * Cập nhật thông tin buổi học.
 * id được trích từ item tại site call, truyền qua mutationFn arg.
 */
export function useUpdateBuoiHoc({ onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => giaoVu.updateBuoiHoc(id, data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tkb'] });
      onSuccess?.(vars);
    },
    onError: makeOnError('Lỗi cập nhật buổi học'),
  });
}

// ─── useDeleteBuoiHoc ───────────────────────────────────────────────────────
/**
 * Xóa mềm buổi học (soft delete).
 * Backend set trang_thai = 'huy'.
 */
export function useDeleteBuoiHoc({ onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => giaoVu.deleteBuoiHoc(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['tkb'] });
      onSuccess?.(id);
    },
    onError: makeOnError('Lỗi xóa buổi học'),
  });
}

// ─── useCreateYeuCauDieuChinh ───────────────────────────────────────────────
/**
 * Giảng viên gửi yêu cầu điều chỉnh cho 1 buổi học.
 * Payload: { buoi_hoc_id, loai_yeu_cau_id, ly_do?, noi_dung_de_xuat? }
 */
export function useCreateYeuCauDieuChinh({ onSuccess } = {}) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data) => giangVien.guiYeuCauDieuChinh(data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['tkb'] });
      // Có thể invalidate thêm query yêu cầu điều chỉnh nếu cần
      qc.invalidateQueries({ queryKey: ['yeu-cau-dieu-chinh'] });
      onSuccess?.(vars);
    },
    onError: makeOnError('Lỗi gửi yêu cầu điều chỉnh'),
  });
}
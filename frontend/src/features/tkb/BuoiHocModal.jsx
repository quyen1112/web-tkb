/**
 * BuoiHocModal.jsx — Modal thêm/sửa buổi học dùng chung.
 *
 * Props:
 *   open                 {Boolean}
 *   variant             {"giao_vu_edit"|"giang_vien_request"}
 *   mode                {"create"|"edit"}  (chỉ dùng cho giao_vu_edit)
 *   item                {Object|null}
 *   onClose             {Function}
 *   phanCongOptions     {Array}   [{ value, label }]
 *   phongHocOptions     {Array}   [{ value, label }]
 *   khungThoiGianOptions {Array} [{ value, label }]
 *   onSuccess           {Function}  optional
 *   khungTGId / tietBatDau / tietKetThuc / ngayCell  — cell context
 */
import { useEffect } from 'react';
import {
  Modal, Form, Select, Input, DatePicker, Button, Space, Popconfirm, message,
} from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useCreateBuoiHoc,
  useUpdateBuoiHoc,
  useDeleteBuoiHoc,
  useCreateYeuCauDieuChinh,
} from './useBuoiHoc';

const { TextArea } = Input;

// ─── Field alias helpers ─────────────────────────────────────────────────────
const FIELD_ALIAS = {
  id:          ['id', 'buoi_hoc_id', 'tkb_slot_id'],
  phanCongId:  ['phan_cong_id', 'phanCongId'],
  phongHocId:  ['phong_hoc_id', 'phongHocId'],
  khungTGId:   ['khung_thoi_gian_id', 'khungTGId'],
  ngay:        ['ngay_hoc', 'ngayHoc', 'ngay'],
  hinhThuc:    ['hinh_thuc', 'hinhThuc'],
  ghiChu:      ['ghi_chu', 'ghiChu'],
};

function pick(raw, ...aliases) {
  for (const a of aliases) {
    if (a && raw[a] !== undefined && raw[a] !== null) return raw[a];
  }
  return undefined;
}

function isTruthy(v) {
  return v !== undefined && v !== null && v !== '';
}

/** Normalize item → flat object. Ngày parse thành dayjs. */
function toInteger(value) {
  if (!isTruthy(value)) return undefined;
  const num = Number(value);
  return Number.isInteger(num) ? num : undefined;
}

function normalizeItem(raw = {}) {
  let ngay = pick(raw, ...FIELD_ALIAS.ngay);
  if (ngay && typeof ngay === 'string') ngay = dayjs(ngay);
  return {
    id:         toInteger(pick(raw, ...FIELD_ALIAS.id)),
    phanCongId: toInteger(pick(raw, ...FIELD_ALIAS.phanCongId)),
    phongHocId: toInteger(pick(raw, ...FIELD_ALIAS.phongHocId)),
    khungTGId:  toInteger(pick(raw, ...FIELD_ALIAS.khungTGId)),
    ngay,
    hinhThuc:   pick(raw, ...FIELD_ALIAS.hinhThuc),
    ghiChu:     pick(raw, ...FIELD_ALIAS.ghiChu),
    raw,
  };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function getModalTitle(variant, mode) {
  if (variant === 'giang_vien_request') return 'Gửi yêu cầu điều chỉnh';
  if (variant === 'giao_vu_edit') {
    return mode === 'edit' ? 'Cập nhật buổi học' : 'Thêm buổi học';
  }
  return 'Buổi học';
}

function getSubmitLabel(variant, mode) {
  if (variant === 'giang_vien_request') return 'Gửi yêu cầu';
  if (variant === 'giao_vu_edit') return mode === 'edit' ? 'Cập nhật' : 'Thêm mới';
  return 'Xác nhận';
}

function buildPayload(values, variant, item) {
  const n = normalizeItem(item);

  if (variant === 'giang_vien_request') {
    const slotId = toInteger(n.id);
    return {
      tkb_slot_id:       slotId,
      buoi_hoc_id:       slotId,
      loai_yeu_cau_id:  toInteger(values.loai_yeu_cau_id),
      ly_do:            values.ly_do,
      noi_dung_de_xuat: values.noi_dung_de_xuat,
    };
  }

  // giao_vu_edit
  return {
    phan_cong_id:        toInteger(values.phan_cong_id),
    phong_hoc_id:       toInteger(values.phong_hoc_id),
    khung_thoi_gian_id: toInteger(values.khung_thoi_gian_id),
    ngay_hoc:           values.ngay_hoc ? dayjs(values.ngay_hoc).format('YYYY-MM-DD') : undefined,
    hinh_thuc:          values.hinh_thuc,
    ghi_chu:            values.ghi_chu,
  };
}

function getInitialValues(variant, item, khungTGId) {
  const n = normalizeItem(item);
  if (variant === 'giang_vien_request') return {};
  return {
    phan_cong_id:        n.phanCongId,
    phong_hoc_id:      n.phongHocId,
    khung_thoi_gian_id: n.khungTGId ?? toInteger(khungTGId),
    ngay_hoc:          n.ngay ?? null,
    hinh_thuc:         n.hinhThuc,
    ghi_chu:           n.ghiChu,
  };
}

const LOAI_YEU_CAU_OPTIONS = [
  { value: 1,       label: 'Đổi phòng'     },
  { value: 2, label: 'Đổi giảng viên' },
  { value: 3,         label: 'Đổi giờ'       },
  { value: 4,            label: 'Hủy buổi học'   },
];

// ─── Footer helpers ───────────────────────────────────────────────────────────
function FooterGiaoVu({ isEdit, isSubmitting, deletePending, onCancel, onDelete, onSubmit, submitLabel }) {
  return (
    <Space>
      <Button onClick={onCancel}>Hủy</Button>
      {isEdit && (
        <Popconfirm
          title="Xóa buổi học này?"
          onConfirm={onDelete}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true, loading: deletePending }}
        >
          <Button danger icon={<DeleteOutlined />} loading={deletePending}>
            Xóa
          </Button>
        </Popconfirm>
      )}
      <Button type="primary" loading={isSubmitting} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </Space>
  );
}

function FooterGiangVien({ isSubmitting, onCancel, onSubmit, submitLabel }) {
  return (
    <Space>
      <Button onClick={onCancel}>Hủy</Button>
      <Button type="primary" loading={isSubmitting} onClick={onSubmit}>
        {submitLabel}
      </Button>
    </Space>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BuoiHocModal({
  open,
  variant               = 'giao_vu_edit',
  mode                  = 'create',
  item                  = null,
  onClose,
  phanCongOptions       = [],
  phongHocOptions       = [],
  khungThoiGianOptions  = [],
  onSuccess,
  khungTGId             = null,
}) {
  const [form] = Form.useForm();
  const isEdit      = mode === 'edit';
  const isGiaoVu    = variant === 'giao_vu_edit';
  const isGiangVien = variant === 'giang_vien_request';

  const create  = useCreateBuoiHoc({});
  const update  = useUpdateBuoiHoc({});
  const remove  = useDeleteBuoiHoc({});
  const request = useCreateYeuCauDieuChinh({});

  const isSubmitting = create.isPending || update.isPending || request.isPending;

  // Sync form mỗi khi modal mở hoặc item thay đổi
  useEffect(() => {
    if (!open) { form.resetFields(); return; }
    form.setFieldsValue(getInitialValues(variant, item, khungTGId));
  }, [open, variant, item, khungTGId]);

  function done() {
    message.success('Thao tác thành công');
    form.resetFields();
    onSuccess?.();
    onClose();
  }

  function doneDelete() {
    message.success('Đã xóa buổi học');
    form.resetFields();
    onSuccess?.();
    onClose();
  }

  async function handleSubmit() {
    let values;
    try {
      values = await form.validateFields();
    } catch {
      return;
    }

    const n     = normalizeItem(item);
    const payload = buildPayload(values, variant, item);

    const onError = (err) => message.error(err?.response?.data?.error || 'Thao tác thất bại');

    if (isGiangVien) {
      request.mutate(payload, { onSuccess: done, onError });
      return;
    }

    if (isGiaoVu) {
      if (isEdit) {
        const id = n.id;
        if (!id) { message.error('Không xác định được buổi học cần cập nhật'); return; }
        update.mutate({ id, data: payload }, { onSuccess: done, onError });
      } else {
        create.mutate(payload, { onSuccess: done, onError });
      }
    }
  }

  function handleDelete() {
    const n = normalizeItem(item);
    if (!n.id) { message.error('Không xác định được buổi học cần xóa'); return; }
    remove.mutate(n.id, { onSuccess: doneDelete });
  }

  const submitLabel = getSubmitLabel(variant, mode);
  const title       = getModalTitle(variant, mode);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={
        isGiangVien ? (
          <FooterGiangVien
            isSubmitting={isSubmitting}
            onCancel={onClose}
            onSubmit={handleSubmit}
            submitLabel={submitLabel}
          />
        ) : (
          <FooterGiaoVu
            isEdit={isEdit}
            isSubmitting={isSubmitting}
            deletePending={remove.isPending}
            onCancel={onClose}
            onDelete={handleDelete}
            onSubmit={handleSubmit}
            submitLabel={submitLabel}
          />
        )
      }
      width={600}
      destroyOnClose
      confirmLoading={isSubmitting}
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        disabled={isSubmitting}
      >
        {/* ── Giáo vụ: phân công (chỉ khi create) ── */}
        {isGiaoVu && !isEdit && (
          <Form.Item
            name="phan_cong_id"
            label="Phân công (LHP – GV)"
            rules={[{ required: true, message: 'Chọn lớp học phần' }]}
          >
            <Select
              showSearch
              placeholder="Chọn lớp học phần"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={phanCongOptions}
              notFoundContent={phanCongOptions.length === 0 ? 'Không có dữ liệu' : null}
            />
          </Form.Item>
        )}

        {/* ── Giáo vụ: phòng học ── */}
        {isGiaoVu && (
          <Form.Item
            name="phong_hoc_id"
            label="Phòng học"
            rules={[{ required: true, message: 'Chọn phòng học' }]}
          >
            <Select
              showSearch
              placeholder="Chọn phòng học"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={phongHocOptions}
              notFoundContent={phongHocOptions.length === 0 ? 'Không có dữ liệu' : null}
            />
          </Form.Item>
        )}

        {/* ── Giáo vụ: khung thời gian ── */}
        {isGiaoVu && (
          <Form.Item
            name="khung_thoi_gian_id"
            label="Khung thời gian"
            rules={[{ required: true, message: 'Chọn khung thời gian' }]}
          >
            <Select
              showSearch
              placeholder="Chọn khung thời gian"
              optionFilterProp="children"
              filterOption={(input, option) =>
                (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={khungThoiGianOptions}
              notFoundContent={khungThoiGianOptions.length === 0 ? 'Không có dữ liệu' : null}
            />
          </Form.Item>
        )}

        {/* ── Giáo vụ: ngày học ── */}
        {isGiaoVu && (
          <Form.Item
            name="ngay_hoc"
            label="Ngày học"
            rules={[{ required: true, message: 'Chọn ngày học' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} placeholder="Chọn ngày" />
          </Form.Item>
        )}

        {/* ── Giáo vụ: hình thức ── */}
        {isGiaoVu && (
          <Form.Item name="hinh_thuc" label="Hình thức">
            <Select
              placeholder="Chọn hình thức"
              allowClear
              options={[
                { value: 'ly_thuyet', label: 'Lý thuyết' },
                { value: 'thuc_hanh', label: 'Thực hành' },
              ]}
            />
          </Form.Item>
        )}

        {/* ── Giáo vụ: ghi chú ── */}
        {isGiaoVu && (
          <Form.Item name="ghi_chu" label="Ghi chú">
            <TextArea rows={2} placeholder="Ghi chú (nếu có)" />
          </Form.Item>
        )}

        {/* ═══════════════════════════════════════
           Giảng viên: yêu cầu điều chỉnh
           ═══════════════════════════════════════ */}
        {isGiangVien && (
          <>
            <Form.Item
              name="loai_yeu_cau_id"
              label="Loại yêu cầu"
              rules={[{ required: true, message: 'Chọn loại yêu cầu' }]}
            >
              <Select placeholder="Chọn loại yêu cầu" options={LOAI_YEU_CAU_OPTIONS} />
            </Form.Item>

            <Form.Item
              name="ly_do"
              label="Lý do"
              rules={[{ required: true, message: 'Nhập lý do' }]}
            >
              <TextArea rows={2} placeholder="Mô tả lý do yêu cầu điều chỉnh" />
            </Form.Item>

            <Form.Item
              name="noi_dung_de_xuat"
              label="Nội dung đề xuất"
              rules={[{ required: true, message: 'Nhập nội dung đề xuất' }]}
            >
              <TextArea rows={3} placeholder="Mô tả nội dung thay đổi đề xuất" />
            </Form.Item>
          </>
        )}
      </Form>
    </Modal>
  );
}

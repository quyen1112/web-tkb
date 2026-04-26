import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';

import api from '../../services/api';
import { fmtDate } from '../../utils/dateUtils';
import { THU_LABELS } from '../../utils/tkbGrid';

const TRANG_THAI_COLOR = {
  cho_duyet: 'orange',
  da_duyet: 'green',
  tu_choi: 'red',
};

const TRANG_THAI_LABEL = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
};

const LOAI_YEU_CAU_LIST = [
  { loai_yeu_cau_id: 1, ten_loai: 'Đổi phòng' },
  { loai_yeu_cau_id: 2, ten_loai: 'Đổi giảng viên' },
  { loai_yeu_cau_id: 3, ten_loai: 'Đổi thời gian' },
  { loai_yeu_cau_id: 4, ten_loai: 'Hủy slot học' },
];

function formatSlotLabel(slot) {
  const thuLabel = THU_LABELS[slot.thu_trong_tuan] || `Thứ ${slot.thu_trong_tuan}`;
  const tietLabel = `${slot.tiet_bat_dau}-${slot.tiet_ket_thuc}`;
  const phongLabel = slot.ten_phong || 'Chưa xếp phòng';
  return `${slot.ten_mon} | ${thuLabel} | Tiết ${tietLabel} | ${phongLabel}`;
}

const GiangVienYeuCauPage = () => {
  const [yeuCauList, setYeuCauList] = useState([]);
  const [slotList, setSlotList] = useState([]);
  const [filterTT, setFilterTT] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchYeuCau();
    fetchSlots();
  }, []);

  const slotOptions = useMemo(
    () =>
      slotList.map((slot) => ({
        value: slot.tkb_slot_id ?? slot.buoi_hoc_id,
        label: formatSlotLabel(slot),
      })),
    [slotList]
  );

  const fetchYeuCau = async (trangThai = null) => {
    setLoading(true);
    try {
      const params = trangThai ? { trang_thai: trangThai } : {};
      const res = await api.get('/giang-vien/yeu-cau-dieu-chinh', { params });
      setYeuCauList(Array.isArray(res.data) ? res.data : []);
    } catch {
      message.error('Lỗi tải danh sách yêu cầu!');
    } finally {
      setLoading(false);
    }
  };

  const fetchSlots = async () => {
    try {
      const hkRes = await api.get('/giang-vien/hoc-ky');
      const hocKys = Array.isArray(hkRes.data) ? hkRes.data : [];
      const activeHK = hocKys.find((hk) => hk.trang_thai === 'hoat_dong') || hocKys[0];

      if (!activeHK?.hoc_ky_id) {
        setSlotList([]);
        return;
      }

      const res = await api.get('/giang-vien/tkb-ca-nhan', {
        params: { hoc_ky_id: activeHK.hoc_ky_id },
      });
      setSlotList(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSlotList([]);
    }
  };

  const handleFilterChange = (value) => {
    setFilterTT(value);
    fetchYeuCau(value || null);
  };

  const handleSubmit = async (values) => {
    try {
      await api.post('/giang-vien/yeu-cau-dieu-chinh', {
        tkb_slot_id: values.tkb_slot_id,
        loai_yeu_cau_id: values.loai_yeu_cau_id,
        ly_do: values.ly_do,
        noi_dung_de_xuat: values.noi_dung_de_xuat,
        ngay_ap_dung: values.ngay_ap_dung || null,
      });
      message.success('Gửi yêu cầu thành công. Đang chờ phê duyệt.');
      setShowModal(false);
      form.resetFields();
      fetchYeuCau(filterTT);
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi gửi yêu cầu!');
    }
  };

  const columns = [
    {
      title: 'Slot TKB',
      key: 'slot',
      render: (_, record) => {
        const thuLabel = THU_LABELS[record.thu_trong_tuan] || `Thứ ${record.thu_trong_tuan}`;
        const apDung = record.ngay_ap_dung ? fmtDate(record.ngay_ap_dung) : 'Tất cả các tuần';
        return (
          <div>
            <div>
              <strong>{record.ten_mon}</strong> - {record.ma_lop_hp}
            </div>
            <div style={{ color: '#666', fontSize: 12 }}>
              {thuLabel} | Tiết {record.tiet_bat_dau}-{record.tiet_ket_thuc} | {record.ten_phong || 'Chưa xếp phòng'}
            </div>
            <div style={{ color: '#666', fontSize: 12 }}>Áp dụng: {apDung}</div>
          </div>
        );
      },
    },
    {
      title: 'Loại yêu cầu',
      dataIndex: 'ten_loai_yeu_cau',
      key: 'loai',
      width: 150,
    },
    {
      title: 'Lý do',
      dataIndex: 'ly_do',
      key: 'ly_do',
      ellipsis: true,
    },
    {
      title: 'Ngày gửi',
      dataIndex: 'ngay_gui',
      key: 'ngay_gui',
      width: 120,
      render: (value) => fmtDate(value) || '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 120,
      render: (value) => <Tag color={TRANG_THAI_COLOR[value]}>{TRANG_THAI_LABEL[value] || value}</Tag>,
    },
    {
      title: 'Người duyệt',
      dataIndex: 'nguoi_phan_duyet',
      key: 'nguoi_phan_duyet',
      width: 160,
      render: (value) => value || <span style={{ color: '#aaa' }}>Chưa duyệt</span>,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">YÊU CẦU ĐIỀU CHỈNH LỊCH</h2>

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={filterTT}
            onChange={handleFilterChange}
            allowClear
            placeholder="Lọc trạng thái"
            style={{ width: 160 }}
            options={[
              { value: 'cho_duyet', label: 'Chờ duyệt' },
              { value: 'da_duyet', label: 'Đã duyệt' },
              { value: 'tu_choi', label: 'Từ chối' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchYeuCau(filterTT)} loading={loading}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowModal(true)}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Tạo yêu cầu
          </Button>
        </div>

        <Table
          dataSource={yeuCauList}
          rowKey="yeu_cau_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Chưa có yêu cầu nào' }}
        />
      </Card>

      <Modal
        title="Tạo yêu cầu điều chỉnh lịch"
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          form.resetFields();
        }}
        footer={null}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Chọn slot TKB cần điều chỉnh"
            name="tkb_slot_id"
            rules={[{ required: true, message: 'Chọn slot TKB' }]}
          >
            <Select
              showSearch
              placeholder="Tìm theo môn học, thứ, tiết..."
              optionFilterProp="label"
              options={slotOptions}
              notFoundContent={slotList.length === 0 ? 'Không có slot nào' : 'Không tìm thấy'}
            />
          </Form.Item>

          <Form.Item
            label="Loại yêu cầu"
            name="loai_yeu_cau_id"
            rules={[{ required: true, message: 'Chọn loại yêu cầu' }]}
          >
            <Select
              placeholder="Chọn loại yêu cầu"
              options={LOAI_YEU_CAU_LIST.map((item) => ({
                value: item.loai_yeu_cau_id,
                label: item.ten_loai,
              }))}
            />
          </Form.Item>

          <Form.Item label="Ngày áp dụng cụ thể" name="ngay_ap_dung">
            <Input placeholder="YYYY-MM-DD (bỏ trống nếu áp dụng cho tất cả các tuần)" />
          </Form.Item>

          <Form.Item
            label="Lý do"
            name="ly_do"
            rules={[{ required: true, message: 'Nhập lý do yêu cầu' }]}
          >
            <Input.TextArea rows={3} placeholder="Mô tả lý do cần điều chỉnh..." />
          </Form.Item>

          <Form.Item label="Nội dung đề xuất" name="noi_dung_de_xuat">
            <Input.TextArea rows={2} placeholder="Đề xuất cụ thể (nếu có)" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button
                onClick={() => {
                  setShowModal(false);
                  form.resetFields();
                }}
              >
                Hủy
              </Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
                Gửi yêu cầu
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GiangVienYeuCauPage;

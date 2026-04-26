import { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Space, Table, Tag, message } from 'antd';
import { CheckOutlined, CloseOutlined, ReloadOutlined } from '@ant-design/icons';

import api from '../../services/api';
import { fmtDate } from '../../utils/dateUtils';
import { THU_LABELS } from '../../utils/tkbGrid';

const TRANG_THAI_MAP = {
  cho_duyet: 'Chờ duyệt',
  da_duyet: 'Đã duyệt',
  tu_choi: 'Từ chối',
};

const MAU_MAP = {
  cho_duyet: 'orange',
  da_duyet: 'green',
  tu_choi: 'red',
};

function formatSlot(record) {
  const thuLabel = THU_LABELS[record.thu_trong_tuan] || `Thứ ${record.thu_trong_tuan}`;
  return `${thuLabel} | Tiết ${record.tiet_bat_dau}-${record.tiet_ket_thuc} | ${record.ten_phong || 'Chưa xếp phòng'}`;
}

const TruongKhoaYeuCauPage = () => {
  const [data, setData] = useState([]);
  const [trangThaiFilter, setTrangThaiFilter] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedYc, setSelectedYc] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, [trangThaiFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (trangThaiFilter) {
        params.trang_thai = trangThaiFilter;
      }

      const res = await api.get('/truong-khoa/yeu-cau-dieu-chinh', { params });
      const rows = Array.isArray(res.data) ? res.data : res.data?.data || [];
      setData(rows);
    } catch {
      setData([]);
      message.error('Lỗi tải yêu cầu!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (record) => {
    setSelectedYc(record);
    form.setFieldsValue({ noi_dung_phan_hoi: '' });
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setSelectedYc(null);
    form.resetFields();
  };

  const handleDuyet = async (hanhDong) => {
    try {
      const values = form.getFieldsValue();
      await api.put(`/truong-khoa/yeu-cau-dieu-chinh/${selectedYc.yeu_cau_id}/duyet`, {
        hanh_dong: hanhDong,
        noi_dung_phan_hoi: values.noi_dung_phan_hoi,
      });
      message.success(hanhDong === 'dong_y' ? 'Duyệt thành công!' : 'Từ chối thành công!');
      handleClose();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi xử lý!');
    }
  };

  const columns = [
    { title: 'Mã LHP', dataIndex: 'ma_lop_hp', key: 'ma_lop_hp', width: 120 },
    { title: 'Môn', dataIndex: 'ten_mon', key: 'ten_mon' },
    { title: 'GV yêu cầu', dataIndex: 'ten_gv', key: 'ten_gv', width: 160 },
    { title: 'Loại', dataIndex: 'loai_yeu_cau', key: 'loai', width: 130 },
    {
      title: 'Slot',
      key: 'slot',
      width: 240,
      render: (_, record) => formatSlot(record),
    },
    {
      title: 'Ngày áp dụng',
      dataIndex: 'ngay_ap_dung',
      key: 'ngay_ap_dung',
      width: 130,
      render: (value) => fmtDate(value) || 'Tất cả các tuần',
    },
    { title: 'Lý do', dataIndex: 'ly_do', key: 'ly_do' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 120,
      render: (value) => <Tag color={MAU_MAP[value] || 'default'}>{TRANG_THAI_MAP[value] || value}</Tag>,
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 110,
      render: (_, record) =>
        record.trang_thai === 'cho_duyet' ? (
          <Button size="small" type="primary" onClick={() => handleOpen(record)}>
            Duyệt
          </Button>
        ) : null,
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">YÊU CẦU ĐIỀU CHỈNH LỊCH</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <Select
            value={trangThaiFilter}
            onChange={(value) => setTrangThaiFilter(value || null)}
            allowClear
            placeholder="Lọc trạng thái"
            style={{ width: 160 }}
            options={[
              { value: 'cho_duyet', label: 'Chờ duyệt' },
              { value: 'da_duyet', label: 'Đã duyệt' },
              { value: 'tu_choi', label: 'Từ chối' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Tải lại
          </Button>
        </div>

        <Table
          dataSource={Array.isArray(data) ? data : []}
          rowKey="yeu_cau_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal title="Phê duyệt yêu cầu" open={showModal} onCancel={handleClose} footer={null} width={550}>
        {selectedYc && (
          <>
            <div style={{ marginBottom: 16, padding: 12, background: '#f5f5f5', borderRadius: 6 }}>
              <p>
                <strong>LHP:</strong> {selectedYc.ma_lop_hp} - {selectedYc.ten_mon}
              </p>
              <p>
                <strong>GV:</strong> {selectedYc.ten_gv}
              </p>
              <p>
                <strong>Slot:</strong> {formatSlot(selectedYc)}
              </p>
              <p>
                <strong>Ngày áp dụng:</strong> {fmtDate(selectedYc.ngay_ap_dung) || 'Tất cả các tuần'}
              </p>
              <p>
                <strong>Loại:</strong> {selectedYc.loai_yeu_cau}
              </p>
              <p>
                <strong>Lý do:</strong> {selectedYc.ly_do}
              </p>
              {selectedYc.noi_dung_de_xuat && (
                <p>
                  <strong>Đề xuất:</strong> {selectedYc.noi_dung_de_xuat}
                </p>
              )}
            </div>
            <Form form={form} layout="vertical" onFinish={() => {}}>
              <Form.Item label="Nội dung phản hồi" name="noi_dung_phan_hoi">
                <Input.TextArea rows={3} placeholder="Nhập nội dung phản hồi (nếu có)" />
              </Form.Item>
              <Space>
                <Button
                  type="primary"
                  icon={<CheckOutlined />}
                  style={{ backgroundColor: 'green', borderColor: 'green' }}
                  onClick={() => handleDuyet('dong_y')}
                >
                  Đồng ý
                </Button>
                <Button danger icon={<CloseOutlined />} onClick={() => handleDuyet('tu_choi')}>
                  Từ chối
                </Button>
              </Space>
            </Form>
          </>
        )}
      </Modal>
    </div>
  );
};

export default TruongKhoaYeuCauPage;

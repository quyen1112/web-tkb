import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const toTimeMinutes = (value) => {
  if (!value || typeof value !== 'string') return null;
  const normalized = value.slice(0, 5);
  if (!TIME_PATTERN.test(normalized)) return null;
  const [hours, minutes] = normalized.split(':').map(Number);
  return hours * 60 + minutes;
};

const rangesOverlap = (startA, endA, startB, endB) =>
  Number(startA) <= Number(endB) && Number(endA) >= Number(startB);

const timeRangesOverlap = (startA, endA, startB, endB) =>
  startA < endB && endA > startB;

const GiaoVuKhungTGPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/giao-vu/khung-thoi-gian', { params: { limit: 200 } });
      setData(res.data || []);
    } catch {
      message.error('Lỗi tải dữ liệu!');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      await api.post('/giao-vu/khung-thoi-gian', values);
      message.success('Thêm khung thời gian thành công!');
      setShowModal(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi thêm khung thời gian!');
    }
  };

  const validateTietRange = (_, value) => {
    const tietBatDau = form.getFieldValue('tiet_bat_dau');
    const tietKetThuc = form.getFieldValue('tiet_ket_thuc');
    if (value === undefined || value === null || tietBatDau === undefined || tietKetThuc === undefined) {
      return Promise.resolve();
    }
    if (Number(tietBatDau) > Number(tietKetThuc)) {
      return Promise.reject(new Error('Tiết bắt đầu phải nhỏ hơn hoặc bằng tiết kết thúc'));
    }
    return Promise.resolve();
  };

  const validateTimeFormat = (_, value) => {
    if (!value) return Promise.resolve();
    if (!TIME_PATTERN.test(String(value).trim())) {
      return Promise.reject(new Error('Giờ phải có định dạng HH:mm'));
    }
    return Promise.resolve();
  };

  const validateTimeRange = (_, value) => {
    const gioBatDau = form.getFieldValue('gio_bat_dau');
    const gioKetThuc = form.getFieldValue('gio_ket_thuc');
    if (!value || !gioBatDau || !gioKetThuc) return Promise.resolve();

    const start = toTimeMinutes(String(gioBatDau).trim());
    const end = toTimeMinutes(String(gioKetThuc).trim());
    if (start === null || end === null) return Promise.resolve();
    if (start >= end) {
      return Promise.reject(new Error('Giờ bắt đầu phải nhỏ hơn giờ kết thúc'));
    }
    return Promise.resolve();
  };

  const validateNoOverlap = () => {
    const values = form.getFieldsValue();
    const {
      thu_trong_tuan,
      tiet_bat_dau,
      tiet_ket_thuc,
      gio_bat_dau,
      gio_ket_thuc,
    } = values;

    if (!thu_trong_tuan || !tiet_bat_dau || !tiet_ket_thuc || !gio_bat_dau || !gio_ket_thuc) {
      return Promise.resolve();
    }

    const start = toTimeMinutes(String(gio_bat_dau).trim());
    const end = toTimeMinutes(String(gio_ket_thuc).trim());
    if (start === null || end === null || start >= end || Number(tiet_bat_dau) > Number(tiet_ket_thuc)) {
      return Promise.resolve();
    }

    const conflict = data.find((item) => {
      if (Number(item.thu_trong_tuan) !== Number(thu_trong_tuan)) return false;

      const tietOverlap = rangesOverlap(
        tiet_bat_dau,
        tiet_ket_thuc,
        item.tiet_bat_dau,
        item.tiet_ket_thuc
      );

      const existingStart = toTimeMinutes(String(item.gio_bat_dau || '').trim());
      const existingEnd = toTimeMinutes(String(item.gio_ket_thuc || '').trim());
      const gioOverlap =
        existingStart !== null &&
        existingEnd !== null &&
        timeRangesOverlap(start, end, existingStart, existingEnd);

      return tietOverlap || gioOverlap;
    });

    if (conflict) {
      return Promise.reject(new Error('Khung thời gian bị trùng hoặc chồng lấn với slot đã có trong cùng ngày'));
    }

    return Promise.resolve();
  };

  const thuMap = {
    2: 'Thứ 2',
    3: 'Thứ 3',
    4: 'Thứ 4',
    5: 'Thứ 5',
    6: 'Thứ 6',
    7: 'Thứ 7',
    8: 'Chủ nhật',
  };

  const columns = [
    {
      title: 'Thứ',
      dataIndex: 'thu_trong_tuan',
      key: 'thu_trong_tuan',
      width: 120,
      render: (value) => thuMap[value] || value,
    },
    { title: 'Tiết BD', dataIndex: 'tiet_bat_dau', key: 'tiet_bat_dau', width: 90 },
    { title: 'Tiết KT', dataIndex: 'tiet_ket_thuc', key: 'tiet_ket_thuc', width: 90 },
    { title: 'Giờ BD', dataIndex: 'gio_bat_dau', key: 'gio_bat_dau', width: 90 },
    { title: 'Giờ KT', dataIndex: 'gio_ket_thuc', key: 'gio_ket_thuc', width: 90 },
    { title: 'Mô tả', dataIndex: 'mo_ta', key: 'mo_ta' },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">KHUNG THỜI GIAN</h2>
      <Card>
        <div style={{ display: 'flex', marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowModal(true)}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633', marginLeft: 8 }}
          >
            Thêm khung thời gian
          </Button>
        </div>

        <Table
          dataSource={data}
          rowKey="khung_thoi_gian_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title="Thêm Khung Thời Gian"
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Thứ trong tuần"
            name="thu_trong_tuan"
            rules={[
              { required: true, message: 'Chọn thứ trong tuần' },
              { validator: validateNoOverlap },
            ]}
          >
            <Select placeholder="Chọn thứ">
              {Object.entries(thuMap).map(([value, label]) => (
                <Select.Option key={value} value={parseInt(value, 10)}>
                  {label}
                </Select.Option>
              ))}
            </Select>
          </Form.Item>

          <Space>
            <Form.Item
              label="Tiết bắt đầu"
              name="tiet_bat_dau"
              dependencies={['tiet_ket_thuc', 'thu_trong_tuan', 'gio_bat_dau', 'gio_ket_thuc']}
              rules={[
                { required: true, message: 'Nhập tiết bắt đầu' },
                { validator: validateTietRange },
                { validator: validateNoOverlap },
              ]}
            >
              <InputNumber min={1} max={11} />
            </Form.Item>
            <Form.Item
              label="Tiết kết thúc"
              name="tiet_ket_thuc"
              dependencies={['tiet_bat_dau', 'thu_trong_tuan', 'gio_bat_dau', 'gio_ket_thuc']}
              rules={[
                { required: true, message: 'Nhập tiết kết thúc' },
                { validator: validateTietRange },
                { validator: validateNoOverlap },
              ]}
            >
              <InputNumber min={1} max={11} />
            </Form.Item>
          </Space>

          <Space>
            <Form.Item
              label="Giờ bắt đầu"
              name="gio_bat_dau"
              dependencies={['gio_ket_thuc', 'thu_trong_tuan', 'tiet_bat_dau', 'tiet_ket_thuc']}
              rules={[
                { required: true, message: 'Nhập giờ bắt đầu' },
                { validator: validateTimeFormat },
                { validator: validateTimeRange },
                { validator: validateNoOverlap },
              ]}
            >
              <Input placeholder="VD: 07:00" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item
              label="Giờ kết thúc"
              name="gio_ket_thuc"
              dependencies={['gio_bat_dau', 'thu_trong_tuan', 'tiet_bat_dau', 'tiet_ket_thuc']}
              rules={[
                { required: true, message: 'Nhập giờ kết thúc' },
                { validator: validateTimeFormat },
                { validator: validateTimeRange },
                { validator: validateNoOverlap },
              ]}
            >
              <Input placeholder="VD: 09:30" style={{ width: 120 }} />
            </Form.Item>
          </Space>

          <Form.Item label="Mô tả" name="mo_ta">
            <Input placeholder="VD: Sáng 1 - Thứ 2" />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
              Thêm mới
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GiaoVuKhungTGPage;

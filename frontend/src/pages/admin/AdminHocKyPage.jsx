import React, { useEffect, useState } from 'react';
import { Button, Card, DatePicker, Form, Input, Modal, Popconfirm, Select, Space, Table, Tag, message } from 'antd';
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../../services/api';
import { fmtDate } from '../../utils/dateUtils';

const toDatePickerValue = (value) => {
  if (!value) return null;
  const datePart = typeof value === 'string' ? value.slice(0, 10) : value;
  return dayjs(datePart);
};

const validateSundayEndDate = (_, value) => {
  if (!value) {
    return Promise.resolve();
  }

  if (value.day() !== 0) {
    return Promise.reject(new Error('Ngày kết thúc phải là Chủ nhật'));
  }

  return Promise.resolve();
};

const validateMondayStartDate = (_, value) => {
  if (!value) {
    return Promise.resolve();
  }

  if (value.day() !== 1) {
    return Promise.reject(new Error('Ngày bắt đầu phải là Thứ 2'));
  }

  return Promise.resolve();
};

const AdminHocKyPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/giao-vu/hoc-ky');
      setData(res.data || []);
    } catch {
      message.error('Lỗi tải học kỳ!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setShowModal(true);
    form.resetFields();
  };

  const handleOpenEdit = (record) => {
    setEditingRecord(record);
    setShowModal(true);
    form.setFieldsValue({
      ten_hoc_ky: record.ten_hoc_ky,
      nam_hoc: record.nam_hoc,
      ngay_bat_dau: toDatePickerValue(record.ngay_bat_dau),
      ngay_ket_thuc: toDatePickerValue(record.ngay_ket_thuc),
      trang_thai: record.trang_thai,
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingRecord(null);
    form.resetFields();
  };

  const buildPayload = (values) => {
    const payload = {
      ten_hoc_ky: values.ten_hoc_ky,
      nam_hoc: values.nam_hoc,
      ngay_bat_dau: values.ngay_bat_dau?.format('YYYY-MM-DD'),
      ngay_ket_thuc: values.ngay_ket_thuc?.format('YYYY-MM-DD'),
    };

    if (editingRecord) {
      payload.trang_thai = values.trang_thai;
    }

    return payload;
  };

  const saveHocKy = async (payload) => {
    try {
      setSubmitting(true);
      if (editingRecord) {
        await api.put(`/giao-vu/hoc-ky/${editingRecord.hoc_ky_id}`, payload);
        message.success('Cập nhật học kỳ thành công!');
      } else {
        await api.post('/giao-vu/hoc-ky', payload);
        message.success('Thêm học kỳ thành công!');
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi lưu học kỳ!');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async (values) => {
    const payload = buildPayload(values);
    const isClosingHocKy =
      editingRecord?.trang_thai === 'hoat_dong' &&
      payload.trang_thai === 'ket_thuc';

    if (isClosingHocKy) {
      Modal.confirm({
        title: 'Xác nhận đóng học kỳ',
        content: 'Đóng học kỳ sẽ kết thúc các lớp học phần thuộc học kỳ này. Bạn chắc chắn muốn tiếp tục?',
        okText: 'Đóng học kỳ',
        okType: 'danger',
        cancelText: 'Hủy',
        onOk: () => saveHocKy(payload),
      });
      return;
    }

    await saveHocKy(payload);
  };

  const handleToggleStatus = async (record) => {
    try {
      setSubmitting(true);
      await api.put(`/giao-vu/hoc-ky/${record.hoc_ky_id}`, {
        ten_hoc_ky: record.ten_hoc_ky,
        nam_hoc: record.nam_hoc,
        ngay_bat_dau: record.ngay_bat_dau,
        ngay_ket_thuc: record.ngay_ket_thuc,
        trang_thai: record.trang_thai === 'hoat_dong' ? 'ket_thuc' : 'hoat_dong',
      });
      message.success('Cập nhật trạng thái học kỳ thành công!');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi cập nhật trạng thái học kỳ!');
    } finally {
      setSubmitting(false);
    }
  };

  const columns = [
    { title: 'Học kỳ', dataIndex: 'ten_hoc_ky', key: 'ten_hoc_ky' },
    { title: 'Năm học', dataIndex: 'nam_hoc', key: 'nam_hoc' },
    { title: 'Ngày bắt đầu', dataIndex: 'ngay_bat_dau', key: 'ngay_bat_dau', render: (value) => fmtDate(value) || '—' },
    { title: 'Ngày kết thúc', dataIndex: 'ngay_ket_thuc', key: 'ngay_ket_thuc', render: (value) => fmtDate(value) || '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 120,
      render: (value) => (
        <Tag color={value === 'hoat_dong' ? 'green' : 'default'}>
          {value === 'hoat_dong' ? 'Hoạt động' : 'Kết thúc'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 220,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
            Sửa
          </Button>
          {record.trang_thai === 'hoat_dong' ? (
            <Popconfirm
              title="Xác nhận đóng học kỳ?"
              description="Các lớp học phần thuộc học kỳ này cũng sẽ được kết thúc."
              okText="Đóng học kỳ"
              cancelText="Hủy"
              okButtonProps={{ danger: true, loading: submitting }}
              onConfirm={() => handleToggleStatus(record)}
            >
              <Button size="small" danger loading={submitting}>
                Chuyển kết thúc
              </Button>
            </Popconfirm>
          ) : (
            <Button size="small" onClick={() => handleToggleStatus(record)} loading={submitting}>
              Chuyển hoạt động
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">QUẢN LÝ HỌC KỲ</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Thêm học kỳ
          </Button>
        </div>

        <Table
          dataSource={data}
          rowKey="hoc_ky_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editingRecord ? 'Sửa học kỳ' : 'Thêm học kỳ'}
        open={showModal}
        onCancel={handleCloseModal}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Tên học kỳ" name="ten_hoc_ky" rules={[{ required: true, message: 'Nhập tên học kỳ' }]}>
            <Select
              placeholder="Chọn học kỳ"
              options={[
                { value: 'Học kỳ 1', label: 'Học kỳ 1' },
                { value: 'Học kỳ 2', label: 'Học kỳ 2' },
                { value: 'Học kỳ 3', label: 'Học kỳ 3' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Năm học" name="nam_hoc" rules={[{ required: true, message: 'Nhập năm học' }]}>
            <Input placeholder="VD: 2025-2026" />
          </Form.Item>

          <Form.Item
            label="Ngày bắt đầu"
            name="ngay_bat_dau"
            rules={[
              { required: true, message: 'Chọn ngày bắt đầu' },
              { validator: validateMondayStartDate },
            ]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          <Form.Item
            label="Ngày kết thúc"
            name="ngay_ket_thuc"
            rules={[
              { required: true, message: 'Chọn ngày kết thúc' },
              { validator: validateSundayEndDate },
            ]}
          >
            <DatePicker style={{ width: '100%' }} format="YYYY-MM-DD" />
          </Form.Item>

          {editingRecord && (
            <Form.Item label="Trạng thái" name="trang_thai" rules={[{ required: true }]}>
              <Select
                options={[
                  { value: 'hoat_dong', label: 'Hoạt động' },
                  { value: 'ket_thuc', label: 'Kết thúc' },
                ]}
              />
            </Form.Item>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
              {editingRecord ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminHocKyPage;

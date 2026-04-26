import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Input, Modal, Select, Table, Tag, message } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { fmtDateTime } from '../../utils/dateUtils';

const GiaoVuThongBaoPage = () => {
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
      const res = await api.get('/giao-vu/thong-bao');
      setData(res.data?.data || []);
    } catch (err) {
      setData([]);
      message.error(err.response?.data?.error || 'Lỗi tải danh sách thông báo!');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      await api.post('/giao-vu/thong-bao', values);
      message.success('Gửi thông báo thành công!');
      setShowModal(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi gửi thông báo!');
    }
  };

  const loaiMap = {
    thong_tin: { label: 'Thông tin', color: 'blue' },
    thay_doi_lich: { label: 'Thay đổi lịch', color: 'orange' },
    thong_bao_khan: { label: 'Thông báo khẩn', color: 'red' },
    yeu_cau: { label: 'Yêu cầu', color: 'purple' },
  };

  const columns = [
    { title: 'Tiêu đề', dataIndex: 'tieu_de', key: 'tieu_de' },
    {
      title: 'Loại',
      dataIndex: 'loai_thong_bao',
      key: 'loai_thong_bao',
      width: 160,
      render: (value) => <Tag color={loaiMap[value]?.color || 'default'}>{loaiMap[value]?.label || value}</Tag>,
    },
    { title: 'Ngày gửi', dataIndex: 'ngay_tao', key: 'ngay_tao', width: 180, render: (value) => fmtDateTime(value) || '—' },
    { title: 'Số người nhận', dataIndex: 'so_nguoi_nhan', key: 'so_nguoi_nhan', width: 140 },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">THÔNG BÁO ĐÃ GỬI</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowModal(true)}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Tạo thông báo
          </Button>
        </div>

        <Table
          dataSource={data}
          rowKey="thong_bao_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
          locale={{ emptyText: 'Chưa có thông báo nào' }}
        />
      </Card>

      <Modal
        title="Tạo thông báo"
        open={showModal}
        onCancel={() => {
          setShowModal(false);
          form.resetFields();
        }}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Tiêu đề" name="tieu_de" rules={[{ required: true, message: 'Nhập tiêu đề' }]}>
            <Input placeholder="VD: Thông báo lịch thi HK2" />
          </Form.Item>

          <Form.Item label="Nội dung" name="noi_dung" rules={[{ required: true, message: 'Nhập nội dung' }]}>
            <Input.TextArea rows={4} placeholder="Nhập nội dung thông báo" />
          </Form.Item>

          <Form.Item label="Loại thông báo" name="loai_thong_bao" rules={[{ required: true }]}>
            <Select
              placeholder="Chọn loại"
              options={[
                { value: 'thong_tin', label: 'Thông tin' },
                { value: 'thay_doi_lich', label: 'Thay đổi lịch' },
                { value: 'thong_bao_khan', label: 'Thông báo khẩn' },
                { value: 'yeu_cau', label: 'Yêu cầu' },
              ]}
            />
          </Form.Item>

          <Form.Item label="Gửi cho" name="doi_tuong" rules={[{ required: true }]}>
            <Select
              placeholder="Chọn đối tượng"
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'sinh_vien', label: 'Sinh viên' },
                { value: 'giang_vien', label: 'Giảng viên' },
                { value: 'giao_vu', label: 'Giáo vụ' },
                { value: 'truong_khoa', label: 'Trưởng khoa' },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
              Gửi thông báo
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GiaoVuThongBaoPage;

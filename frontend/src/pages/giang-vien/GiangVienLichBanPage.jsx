import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Select, Input, DatePicker, message, Tag, Tabs } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const GiangVienLichBanPage = () => {
  const [data, setData] = useState([]);
  const [hocKys, setHocKys] = useState([]);
  const [selectedHK, setSelectedHK] = useState(null);
  const [khungTG, setKhungTG] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [loaiBan, setLoaiBan] = useState('tuan');
  const [form] = Form.useForm();

  useEffect(() => {
    fetchHocKy();
    fetchKhungTG();
  }, []);

  useEffect(() => { fetchData(); }, [selectedHK, loaiBan]);

  const fetchHocKy = async () => {
    try {
      const res = await api.get('/giang-vien/hoc-ky');
      setHocKys(res.data || []);
      const active = res.data?.find(hk => hk.trang_thai === 'hoat_dong');
      if (active) setSelectedHK(active.hoc_ky_id);
    } catch { /* ignore */ }
  };

  const fetchKhungTG = async () => {
    try {
      const res = await api.get('/giang-vien/khung-thoi-gian', { params: { limit: 200 } });
      setKhungTG(res.data || []);
    } catch { setKhungTG([]); }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = { loai: loaiBan };
      if (selectedHK) params.hoc_ky_id = selectedHK;
      const res = await api.get('/giang-vien/lich-ban', { params });
      setData(res.data || []);
    } catch { message.error('Lỗi tải lịch bận!'); }
    finally { setLoading(false); }
  };

  const handleSubmit = async (values) => {
    try {
      const payload = {
        hoc_ky_id: values.hoc_ky_id,
        khung_thoi_gian_id: values.khung_thoi_gian_id,
        loai: loaiBan,
        ly_do: values.ly_do,
      };
      if (loaiBan === 'ngay') {
        payload.ngay_cu_the = values.ngay_cu_the?.format('YYYY-MM-DD');
      }
      await api.post('/giang-vien/khai-bao-lich-ban', payload);
      message.success('Khai báo lịch bận thành công!');
      setShowModal(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi khai báo!');
    }
  };

  const thuMap = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'CN' };
  const trangThaiMap = { cho_duyet: 'Chờ duyệt', dong_y: 'Đồng ý', tu_choi: 'Từ chối' };
  const mauMap = { cho_duyet: 'orange', dong_y: 'green', tu_choi: 'red' };

  const columns = [
    {
      title: 'Loại',
      dataIndex: 'loai_ban',
      key: 'loai_ban',
      width: 80,
      render: v => v === 'tuan' ? 'Tuần' : 'Ngày'
    },
    {
      title: 'Thứ',
      dataIndex: 'thu_trong_tuan',
      key: 'thu_trong_tuan',
      width: 80,
      render: v => v ? thuMap[v] || v : '—'
    },
    {
      title: 'Ngày',
      dataIndex: 'ngay_cu_the',
      key: 'ngay_cu_the',
      width: 120,
      render: v => v || '—'
    },
    { title: 'Ca học', dataIndex: 'ca_hoc', key: 'ca_hoc', render: v => v || '—' },
    { title: 'Học kỳ', dataIndex: 'ten_hoc_ky', key: 'ten_hoc_ky', render: v => v || '—' },
    { title: 'Lý do', dataIndex: 'ly_do', key: 'ly_do', render: v => v || '—' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 120,
      render: v => <Tag color={mauMap[v] || 'default'}>{trangThaiMap[v] || v}</Tag>
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">LỊCH BẬN</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={selectedHK}
            onChange={setSelectedHK}
            style={{ width: 200 }}
            allowClear
            placeholder="Lọc theo học kỳ"
            options={hocKys.map(hk => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Tải lại</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowModal(true)}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Khai báo lịch bận
          </Button>
        </div>
        <Table dataSource={data} rowKey="id" columns={columns} loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title="Khai báo lịch bận"
        open={showModal}
        onCancel={() => { setShowModal(false); form.resetFields(); }}
        footer={null}
        width={500}
      >
        <Tabs
          activeKey={loaiBan}
          onChange={setLoaiBan}
          items={[
            {
              key: 'tuan',
              label: 'Lịch bận tuần',
              children: (
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                  <Form.Item label="Học kỳ" name="hoc_ky_id" rules={[{ required: true }]}>
                    <Select placeholder="Chọn học kỳ" options={hocKys.map(hk => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))} />
                  </Form.Item>
                  <Form.Item label="Khung thời gian" name="khung_thoi_gian_id" rules={[{ required: true }]}>
                    <Select showSearch optionFilterProp="children"
                      filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                      options={khungTG.map(kt => ({ value: kt.khung_thoi_gian_id, label: `${kt.mo_ta} | Tiết ${kt.tiet_bat_dau}-${kt.tiet_ket_thuc}` }))}
                      placeholder="Chọn ca bận" />
                  </Form.Item>
                  <Form.Item label="Lý do" name="ly_do">
                    <Input.TextArea rows={3} placeholder="VD: Họp khoa" />
                  </Form.Item>
                  <Form.Item><Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>Gửi khai báo</Button></Form.Item>
                </Form>
              ),
            },
            {
              key: 'ngay',
              label: 'Lịch bận ngày',
              children: (
                <Form form={form} layout="vertical" onFinish={handleSubmit}>
                  <Form.Item label="Học kỳ" name="hoc_ky_id" rules={[{ required: true }]}>
                    <Select placeholder="Chọn học kỳ" options={hocKys.map(hk => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))} />
                  </Form.Item>
                  <Form.Item label="Ngày cụ thể" name="ngay_cu_the" rules={[{ required: true, message: 'Chọn ngày' }]}>
                    <DatePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
                  </Form.Item>
                  <Form.Item label="Khung thời gian" name="khung_thoi_gian_id" rules={[{ required: true }]}>
                    <Select showSearch optionFilterProp="children"
                      filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
                      options={khungTG.map(kt => ({ value: kt.khung_thoi_gian_id, label: `${kt.mo_ta} | Tiết ${kt.tiet_bat_dau}-${kt.tiet_ket_thuc}` }))}
                      placeholder="Chọn ca bận" />
                  </Form.Item>
                  <Form.Item label="Lý do" name="ly_do">
                    <Input.TextArea rows={3} placeholder="VD: Công tác đột xuất" />
                  </Form.Item>
                  <Form.Item><Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>Gửi khai báo</Button></Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Modal>
    </div>
  );
};

export default GiangVienLichBanPage;

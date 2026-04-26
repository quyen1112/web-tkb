import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Tag, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const GiaoVuGiangVienPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/giao-vu/giang-vien');
      setData(res.data || []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    { title: 'Mã GV', dataIndex: 'ma_gv', key: 'ma_gv', width: 100 },
    { title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten' },
    { title: 'Học vị', dataIndex: 'hoc_vi', key: 'hoc_vi', width: 100 },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 120,
      render: (v) => (
        <Tag color={v === 'hoat_dong' ? 'green' : 'red'}>
          {v === 'hoat_dong' ? 'Hoạt động' : 'Khóa'}
        </Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">GIẢNG VIÊN</h2>
      <Card>
        <div style={{ display: 'flex', marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Tải lại</Button>
        </div>
        <Table dataSource={data} rowKey="giang_vien_id" columns={columns} loading={loading} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );
};

export default GiaoVuGiangVienPage;
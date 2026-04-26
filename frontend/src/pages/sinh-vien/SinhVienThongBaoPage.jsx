import React, { useState, useEffect } from 'react';
import { Card, Table, Tag, Button, message } from 'antd';
import { ReloadOutlined, CheckOutlined } from '@ant-design/icons';
import api from '../../services/api';
import { fmtDateTime } from '../../utils/dateUtils';

const SinhVienThongBaoPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/sinh-vien/thong-bao');
      setData(res.data || []);
    } catch { message.error('Lỗi tải thông báo!'); }
    finally { setLoading(false); }
  };

  const handleDaDoc = async (id) => {
    try {
      await api.put(`/sinh-vien/thong-bao/${id}/doc`);
      fetchData();
    } catch { message.error('Lỗi đánh dấu!'); }
  };

  const loaiMap = {
    thong_tin: { label: 'Thông tin', color: 'blue' },
    thay_doi_lich: { label: 'Thay đổi lịch', color: 'orange' },
    thong_bao_khan: { label: 'Khẩn', color: 'red' },
    yeu_cau: { label: 'Yêu cầu', color: 'purple' },
  };

  const columns = [
    {
      title: 'Trạng thái',
      dataIndex: 'da_doc',
      key: 'da_doc',
      width: 110,
      render: v => v
        ? <Tag color="green">Đã đọc</Tag>
        : <Tag color="orange">Chưa đọc</Tag>
    },
    { title: 'Tiêu đề', dataIndex: 'tieu_de', key: 'tieu_de' },
    {
      title: 'Loại',
      dataIndex: 'loai_thong_bao',
      key: 'loai_thong_bao',
      width: 130,
      render: v => {
        const m = loaiMap[v] || { label: v, color: 'default' };
        return <Tag color={m.color}>{m.label}</Tag>;
      }
    },
    { title: 'Nội dung', dataIndex: 'noi_dung', key: 'noi_dung' },
    { title: 'Người tạo', dataIndex: 'nguoi_tao', key: 'nguoi_tao' },
    { title: 'Ngày', dataIndex: 'ngay_tao', key: 'ngay_tao', render: (value) => fmtDateTime(value) || '—' },
    {
      title: 'Hành động',
      key: 'actions',
      width: 140,
      render: (_, record) => !record.da_doc && (
        <Button size="small" icon={<CheckOutlined />} onClick={() => handleDaDoc(record.thong_bao_id)}>Đánh dấu đã đọc</Button>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">THÔNG BÁO</h2>
      <Card>
        <div style={{ display: 'flex', marginBottom: 16 }}>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Tải lại</Button>
        </div>
        <Table dataSource={data} rowKey="thong_bao_id" columns={columns} loading={loading} pagination={{ pageSize: 10 }} />
      </Card>
    </div>
  );
};

export default SinhVienThongBaoPage;

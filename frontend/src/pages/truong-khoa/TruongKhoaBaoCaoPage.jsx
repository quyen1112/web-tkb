import React, { useEffect, useState } from 'react';
import { Card, Col, Row, Select, Statistic, Table, Tabs, message } from 'antd';
import api from '../../services/api';

const TruongKhoaBaoCaoPage = () => {
  const [hocKys, setHocKys] = useState([]);
  const [selectedHK, setSelectedHK] = useState(null);
  const [data, setData] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHocKy();
  }, []);

  useEffect(() => {
    if (selectedHK) {
      fetchData();
    }
  }, [selectedHK]);

  const fetchHocKy = async () => {
    try {
      const res = await api.get('/truong-khoa/hoc-ky');
      const hocKyList = res.data || [];
      setHocKys(hocKyList);
      const active = hocKyList.find((hk) => hk.trang_thai === 'hoat_dong');
      if (active) {
        setSelectedHK(active.hoc_ky_id);
      }
    } catch {
      setHocKys([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/truong-khoa/bao-cao', { params: { hoc_ky_id: selectedHK } });
      setData(res.data || {});
    } catch {
      message.error('Lỗi tải báo cáo!');
    } finally {
      setLoading(false);
    }
  };

  const giangVienColumns = [
    { title: 'Mã GV', dataIndex: 'ma_gv', key: 'ma_gv', width: 120 },
    { title: 'Giảng viên', dataIndex: 'ten_gv', key: 'ten_gv' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    { title: 'Học vị', dataIndex: 'hoc_vi', key: 'hoc_vi', width: 120 },
    { title: 'Số LHP', dataIndex: 'so_lop_hoc_phan', key: 'so_lop_hoc_phan', width: 100 },
    { title: 'Số buổi', dataIndex: 'so_buoi_hoc', key: 'so_buoi_hoc', width: 100 },
  ];

  const lopHocPhanColumns = [
    { title: 'Mã LHP', dataIndex: 'ma_lop_hp', key: 'ma_lop_hp', width: 120 },
    { title: 'Tên LHP', dataIndex: 'ten_lop_hp', key: 'ten_lop_hp' },
    { title: 'Mã môn', dataIndex: 'ma_mon', key: 'ma_mon', width: 120 },
    { title: 'Tên môn', dataIndex: 'ten_mon', key: 'ten_mon' },
    { title: 'Giảng viên', dataIndex: 'giang_vien', key: 'giang_vien' },
    { title: 'Số GV', dataIndex: 'so_giang_vien', key: 'so_giang_vien', width: 90 },
    { title: 'Số buổi', dataIndex: 'so_buoi_hoc', key: 'so_buoi_hoc', width: 100 },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">BÁO CÁO THỐNG KÊ</h2>

      <div style={{ marginBottom: 16 }}>
        <Select
          value={selectedHK}
          onChange={setSelectedHK}
          style={{ width: 240 }}
          placeholder="Chọn học kỳ"
          options={hocKys.map((hk) => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))}
        />
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card loading={loading}><Statistic title="Giảng viên" value={data?.so_giang_vien || 0} /></Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}><Statistic title="Lớp học phần" value={data?.so_lop_hoc_phan || 0} /></Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}><Statistic title="Phòng sử dụng" value={data?.so_phong_hoc || 0} /></Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}><Statistic title="Tổng buổi học" value={data?.so_buoi_hoc || 0} /></Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          items={[
            {
              key: 'giang-vien',
              label: 'CHI TIẾT GIẢNG VIÊN',
              children: (
                <Table
                  dataSource={data?.giang_vien || []}
                  rowKey="giang_vien_id"
                  columns={giangVienColumns}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
            {
              key: 'lop-hoc-phan',
              label: 'CHI TIẾT LỚP HỌC PHẦN',
              children: (
                <Table
                  dataSource={data?.lop_hoc_phan || []}
                  rowKey="lop_hoc_phan_id"
                  columns={lopHocPhanColumns}
                  loading={loading}
                  pagination={{ pageSize: 10 }}
                />
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default TruongKhoaBaoCaoPage;

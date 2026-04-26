import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Select, message } from 'antd';
import api from '../../services/api';

const GiaoVuBaoCaoPage = () => {
  const [hocKys, setHocKys] = useState([]);
  const [selectedHK, setSelectedHK] = useState(null);
  const [baoCao, setBaoCao] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchHocKy();
  }, []);

  useEffect(() => {
    if (selectedHK) {
      fetchBaoCao();
    } else {
      setBaoCao([]);
    }
  }, [selectedHK]);

  const fetchHocKy = async () => {
    try {
      const res = await api.get('/giao-vu/hoc-ky');
      setHocKys(res.data || []);
      const active = res.data?.find(hk => hk.trang_thai === 'hoat_dong');
      if (active) setSelectedHK(active.hoc_ky_id);
    } catch { /* ignore */ }
  };

  const fetchBaoCao = async () => {
    setLoading(true);
    try {
      const res = await api.get('/giao-vu/bao-cao-phong', { params: { hoc_ky_id: selectedHK } });
      setBaoCao(res.data || []);
    } catch { message.error('Lỗi tải báo cáo!'); }
    finally { setLoading(false); }
  };

  const tongSoBuoi = baoCao.reduce((sum, p) => sum + parseInt(p.so_buoi || 0), 0);
  const tongSoNgay = baoCao.reduce((sum, p) => sum + parseInt(p.so_ngay || 0), 0);

  const columns = [
    { title: 'Mã phòng', dataIndex: 'ma_phong', key: 'ma_phong', width: 150 },
    { title: 'Tên phòng', dataIndex: 'ten_phong', key: 'ten_phong' },
    { title: 'Sức chứa', dataIndex: 'suc_chua', key: 'suc_chua', width: 100 },
    { title: 'Loại phòng', dataIndex: 'loai_phong', key: 'loai_phong', width: 120, render: (v) => ({ ly_thuyet: 'Lý thuyết', thuc_hanh: 'Thực hành', thi: 'Thi' })[v] ?? v },
    { title: 'Số buổi sử dụng', dataIndex: 'so_buoi', key: 'so_buoi', width: 140, render: v => v || 0 },
    { title: 'Số ngày sử dụng', dataIndex: 'so_ngay', key: 'so_ngay', width: 140, render: v => v || 0 },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">BÁO CÁO SỬ DỤNG PHÒNG HỌC</h2>

      <div style={{ marginBottom: 16 }}>
        <Select
          value={selectedHK}
          onChange={setSelectedHK}
          style={{ width: 240 }}
          placeholder="Chọn học kỳ"
          options={hocKys.map(hk => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))}
        />
      </div>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card><Statistic title="Tổng phòng" value={baoCao?.length || 0} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Tổng buổi sử dụng" value={tongSoBuoi} /></Card>
        </Col>
        <Col span={8}>
          <Card><Statistic title="Tổng ngày sử dụng" value={tongSoNgay} /></Card>
        </Col>
      </Row>

      <Card title="Chi tiết sử dụng phòng">
        <Table
          dataSource={baoCao}
          rowKey="phong_hoc_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default GiaoVuBaoCaoPage;

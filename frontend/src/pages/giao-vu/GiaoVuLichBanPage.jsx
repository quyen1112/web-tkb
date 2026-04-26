import React, { useEffect, useState } from 'react';
import { Button, Card, Select, Space, Table, Tag, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const GiaoVuLichBanPage = () => {
  const [data, setData] = useState([]);
  const [giangVienList, setGiangVienList] = useState([]);
  const [selectedGV, setSelectedGV] = useState(null);
  const [loai, setLoai] = useState(null);
  const [loading, setLoading] = useState(false);
  const [actionLoadingKey, setActionLoadingKey] = useState(null);

  useEffect(() => {
    fetchGiangVien();
  }, []);

  useEffect(() => {
    fetchData();
  }, [selectedGV, loai]);

  const fetchGiangVien = async () => {
    try {
      const res = await api.get('/giao-vu/giang-vien');
      setGiangVienList(res.data || []);
    } catch {
      setGiangVienList([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const params = {};
      if (selectedGV) params.giang_vien_id = selectedGV;
      if (loai) params.loai = loai;

      const res = await api.get('/giao-vu/lich-ban', { params });
      setData(res.data || []);
    } catch {
      message.error('Lỗi tải lịch bận!');
    } finally {
      setLoading(false);
    }
  };

  const handleDuyetLichBan = async (record, trangThai) => {
    const loadingKey = `${record.id}-${trangThai}`;

    try {
      setActionLoadingKey(loadingKey);
      await api.put(`/giao-vu/lich-ban/${record.id}/duyet`, {
        loai: record.loai_ban,
        trang_thai: trangThai,
      });
      message.success(trangThai === 'dong_y' ? 'Duyệt lịch bận thành công!' : 'Từ chối lịch bận thành công!');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi xử lý lịch bận!');
    } finally {
      setActionLoadingKey(null);
    }
  };

  const thuMap = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'CN' };
  const trangThaiMap = { cho_duyet: 'Chờ duyệt', dong_y: 'Đồng ý', tu_choi: 'Từ chối' };
  const mauMap = { cho_duyet: 'orange', dong_y: 'green', tu_choi: 'red' };

  const columns = [
    { title: 'GV', dataIndex: 'ten_gv', key: 'ten_gv', width: 160 },
    {
      title: 'Loại',
      dataIndex: 'loai_ban',
      key: 'loai_ban',
      width: 80,
      render: (value) => (value === 'tuan' ? 'Tuần' : 'Ngày'),
    },
    {
      title: 'Thứ',
      dataIndex: 'thu_trong_tuan',
      key: 'thu_trong_tuan',
      width: 80,
      render: (value) => (value ? thuMap[value] || value : '-'),
    },
    {
      title: 'Ngày cụ thể',
      dataIndex: 'ngay_cu_the',
      key: 'ngay_cu_the',
      width: 130,
      render: (value) => value || '-',
    },
    { title: 'Ca học', dataIndex: 'ca_hoc', key: 'ca_hoc', render: (value) => value || '-' },
    { title: 'Lý do', dataIndex: 'ly_do', key: 'ly_do', render: (value) => value || '-' },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 120,
      render: (value) => <Tag color={mauMap[value] || 'default'}>{trangThaiMap[value] || value}</Tag>,
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            onClick={() => handleDuyetLichBan(record, 'dong_y')}
            disabled={record.trang_thai !== 'cho_duyet'}
            loading={actionLoadingKey === `${record.id}-dong_y`}
          >
            Duyệt
          </Button>
          <Button
            danger
            size="small"
            onClick={() => handleDuyetLichBan(record, 'tu_choi')}
            disabled={record.trang_thai !== 'cho_duyet'}
            loading={actionLoadingKey === `${record.id}-tu_choi`}
          >
            Từ chối
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">LỊCH BẬN GIẢNG VIÊN</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <Select
            value={selectedGV}
            onChange={(value) => { setSelectedGV(value || null); }}
            allowClear
            placeholder="Tất cả giảng viên"
            style={{ width: 200 }}
            showSearch
            optionFilterProp="children"
            filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
            options={giangVienList.map((gv) => ({ value: gv.giang_vien_id, label: gv.ho_ten }))}
          />
          <Select
            value={loai}
            onChange={(value) => { setLoai(value || null); }}
            allowClear
            placeholder="Tất cả loại"
            style={{ width: 140 }}
            options={[
              { value: 'tuan', label: 'Lịch bận tuần' },
              { value: 'ngay', label: 'Lịch bận ngày' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Tải lại
          </Button>
        </div>

        <Table
          dataSource={data}
          rowKey="id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>
    </div>
  );
};

export default GiaoVuLichBanPage;

import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Select, message, Popconfirm, Space, Tag } from 'antd';
import { PlusOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const TRANG_THAI_COLOR = { hoat_dong: 'green', huy: 'red', cho_duyet: 'orange' };

const GiaoVuSVLHPPage = () => {
  const [data, setData]               = useState([]);
  const [hocKys, setHocKys]           = useState([]);
  const [selectedHK, setSelectedHK]   = useState(null);
  const [selectedLHP, setSelectedLHP] = useState(null);
  const [lopHPList, setLopHPList]     = useState([]);
  const [sinhVienList, setSinhVienList] = useState([]);
  const [loading, setLoading]         = useState(false);
  const [showModal, setShowModal]     = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchHocKy();
    fetchSinhVien();
  }, []);

  useEffect(() => {
    if (selectedHK) fetchLopHP(selectedHK);
    else setLopHPList([]);
  }, [selectedHK]);

  useEffect(() => {
    if (selectedLHP) fetchData();
    else setData([]);
  }, [selectedLHP]);

  const fetchHocKy = async () => {
    try {
      const res = await api.get('/giao-vu/hoc-ky');
      setHocKys(res.data || []);
      const active = res.data?.find(hk => hk.trang_thai === 'hoat_dong');
      if (active) setSelectedHK(active.hoc_ky_id);
    } catch { /* ignore */ }
  };

  const fetchLopHP = async (hocKyId) => {
    try {
      const res = await api.get('/giao-vu/lop-hoc-phan', { params: { hoc_ky_id: hocKyId, limit: 200 } });
      setLopHPList(res.data || []);
    } catch { setLopHPList([]); }
  };

  const fetchSinhVien = async () => {
    try {
      const res = await api.get('/giao-vu/sinh-vien', { params: { trang_thai: 'hoat_dong', limit: 200 } });
      const rows = res.data?.data || [];
      setSinhVienList(rows.map(sv => ({
        value: sv.sinh_vien_id || sv.user_id,
        label: `${sv.ma_sv || ''} - ${sv.ho_ten}`,
        sinh_vien_id: sv.sinh_vien_id,
      })));
    } catch { setSinhVienList([]); }
  };

  const fetchData = async () => {
    if (!selectedLHP) return;
    setLoading(true);
    try {
      const res = await api.get('/giao-vu/sinh-vien-lhp', { params: { lop_hoc_phan_id: selectedLHP } });
      setData(res.data || []);
    } catch {
      message.error('Lỗi tải danh sách sinh viên!');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (values) => {
    try {
      await api.post('/giao-vu/sinh-vien-lhp', {
        sinh_vien_id: values.sinh_vien_id,
        lop_hoc_phan_id: selectedLHP,
      });
      message.success('Xếp sinh viên thành công!');
      setShowModal(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi xếp sinh viên!');
    }
  };

  const handleDelete = async (record) => {
    try {
      await api.delete('/giao-vu/sinh-vien-lhp', {
        params: { sinh_vien_id: record.sinh_vien_id, lop_hoc_phan_id: selectedLHP }
      });
      message.success('Đã xóa sinh viên khỏi lớp học phần!');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi xóa!');
    }
  };

  const selectedLHPInfo = lopHPList.find(l => l.lop_hoc_phan_id === selectedLHP);

  const columns = [
    { title: 'Mã SV', dataIndex: 'ma_sv', key: 'ma_sv', width: 120 },
    { title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten' },
    { title: 'Lớp HC', dataIndex: 'lop_hanh_chinh_id', key: 'lop_hanh_chinh_id', width: 100, render: v => v || '—' },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', key: 'trang_thai', width: 120,
      render: v => <Tag color={TRANG_THAI_COLOR[v] || 'default'}>{v === 'hoat_dong' ? 'Hoạt động' : v}</Tag>
    },
    {
      title: 'Hành động', key: 'actions', width: 100,
      render: (_, record) => (
        <Popconfirm
          title="Xóa sinh viên khỏi lớp học phần?"
          onConfirm={() => handleDelete(record)}
          okText="Xóa" cancelText="Hủy"
        >
          <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">SINH VIÊN - LỚP HỌC PHẦN</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={selectedHK}
            onChange={val => { setSelectedHK(val); setSelectedLHP(null); setData([]); }}
            style={{ width: 200 }}
            placeholder="Chọn học kỳ"
            options={hocKys.map(hk => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))}
          />
          <Select
            value={selectedLHP}
            onChange={setSelectedLHP}
            style={{ width: 260 }}
            placeholder="Chọn lớp học phần"
            disabled={!selectedHK}
            showSearch
            optionFilterProp="children"
            filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
            options={lopHPList.map(l => ({ value: l.lop_hoc_phan_id, label: `${l.ma_lop_hp} - ${l.ten_mon}` }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading} disabled={!selectedLHP}>Tải lại</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setShowModal(true)}
            disabled={!selectedLHP}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Xếp SV vào LHP
          </Button>
        </div>

        {selectedLHPInfo && (
          <div style={{ marginBottom: 12, color: '#555' }}>
            <b>Lớp HP:</b> {selectedLHPInfo.ma_lop_hp} — {selectedLHPInfo.ten_mon} | Sĩ số tối đa: {selectedLHPInfo.si_so_toi_da}
          </div>
        )}

        <Table
          dataSource={data}
          rowKey="id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: selectedLHP ? 'Chưa có sinh viên nào' : 'Chọn lớp học phần để xem danh sách' }}
        />
      </Card>

      <Modal
        title="Xếp Sinh Viên vào Lớp Học Phần"
        open={showModal}
        onCancel={() => { setShowModal(false); form.resetFields(); }}
        footer={null}
        width={480}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Sinh viên" name="sinh_vien_id" rules={[{ required: true, message: 'Chọn sinh viên' }]}>
            <Select
              showSearch
              placeholder="Tìm theo tên hoặc mã SV"
              optionFilterProp="children"
              filterOption={(i, o) => (o?.label ?? '').toLowerCase().includes(i.toLowerCase())}
              options={sinhVienList}
              notFoundContent={sinhVienList.length === 0 ? 'Đang tải...' : 'Không tìm thấy'}
            />
          </Form.Item>
          <div style={{ marginBottom: 16, color: '#555' }}>
            <b>Lớp HP được chọn:</b> {selectedLHPInfo ? `${selectedLHPInfo.ma_lop_hp} - ${selectedLHPInfo.ten_mon}` : '—'}
          </div>
          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={() => { setShowModal(false); form.resetFields(); }}>Hủy</Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
                Xếp SV
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GiaoVuSVLHPPage;

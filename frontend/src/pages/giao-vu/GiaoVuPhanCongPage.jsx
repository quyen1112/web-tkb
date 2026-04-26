import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Modal, Form, Select, Input, message, Space } from 'antd';
import { EditOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const GiaoVuPhanCongPage = () => {
  const [data, setData] = useState([]);
  const [hocKys, setHocKys] = useState([]);
  const [selectedHK, setSelectedHK] = useState(null);
  const [lopHPList, setLopHPList] = useState([]);
  const [giangVienList, setGiangVienList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchHocKy();
    fetchGiangVien();
  }, []);

  useEffect(() => {
    if (selectedHK) {
      fetchData();
      fetchLopHP(selectedHK);
    }
  }, [selectedHK]);

  const fetchHocKy = async () => {
    try {
      const res = await api.get('/giao-vu/hoc-ky');
      setHocKys(res.data || []);
      const active = res.data?.find((hk) => hk.trang_thai === 'hoat_dong');
      if (active) setSelectedHK(active.hoc_ky_id);
    } catch {
      // ignore
    }
  };

  const fetchLopHP = async (hocKyId) => {
    try {
      const res = await api.get('/giao-vu/lop-hoc-phan', { params: { hoc_ky_id: hocKyId } });
      setLopHPList((res.data || []).filter((lhp) => lhp.trang_thai === 'hoat_dong'));
    } catch {
      setLopHPList([]);
    }
  };

  const fetchGiangVien = async () => {
    try {
      const res = await api.get('/giao-vu/giang-vien');
      setGiangVienList((res.data || []).filter((gv) => gv.trang_thai === 'hoat_dong'));
    } catch {
      setGiangVienList([]);
    }
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/giao-vu/phan-cong', { params: { hoc_ky_id: selectedHK } });
      setData(res.data || []);
    } catch {
      message.error('Lỗi tải phân công!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedRecord(null);
    form.resetFields();
    setShowModal(true);
    fetchLopHP(selectedHK);
  };

  const handleOpenEdit = (record) => {
    setModalMode('edit');
    setSelectedRecord(record);
    form.setFieldsValue({
      lop_hoc_phan_id: record.lop_hoc_phan_id,
      giang_vien_id: record.giang_vien_id,
      vai_tro_phu_trach: record.vai_tro_phu_trach || 'chinh',
      ghi_chu: record.ghi_chu,
    });
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRecord(null);
    setModalMode('create');
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      if (modalMode === 'edit' && selectedRecord) {
        await api.put(`/giao-vu/phan-cong/${selectedRecord.phan_cong_id}`, {
          giang_vien_id: values.giang_vien_id,
          ghi_chu: values.ghi_chu,
        });
        message.success('Cập nhật giảng viên phân công thành công!');
      } else {
        await api.post('/giao-vu/phan-cong', values);
        message.success('Phân công thành công!');
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi phân công!');
    }
  };

  const columns = [
    { title: 'Mã LHP', dataIndex: 'ma_lop_hp', key: 'ma_lop_hp', width: 130 },
    { title: 'Tên LHP', dataIndex: 'ten_lop_hp', key: 'ten_lop_hp' },
    { title: 'Môn học', dataIndex: 'ten_mon', key: 'ten_mon' },
    { title: 'Giảng viên', dataIndex: 'ten_gv', key: 'ten_gv' },
    { title: 'Vai trò', dataIndex: 'vai_tro_phu_trach', key: 'vai_tro_phu_trach', width: 110, render: (v) => v === 'chinh' ? 'Chính' : v },
    {
      title: 'Hành động',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
            Đổi GV
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">PHÂN CÔNG GIẢNG DẠY</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={selectedHK}
            onChange={setSelectedHK}
            style={{ width: 200 }}
            placeholder="Chọn học kỳ"
            options={hocKys.map((hk) => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Tải lại</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Phân công mới
          </Button>
        </div>
        <Table dataSource={data} rowKey="phan_cong_id" columns={columns} loading={loading} pagination={{ pageSize: 10 }} />
      </Card>

      <Modal
        title={modalMode === 'edit' ? 'Đổi giảng viên phụ trách' : 'Phân công giảng dạy'}
        open={showModal}
        onCancel={handleCloseModal}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Lớp học phần" name="lop_hoc_phan_id" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="children"
              disabled={modalMode === 'edit'}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={lopHPList.map((lhp) => ({ value: lhp.lop_hoc_phan_id, label: `${lhp.ma_lop_hp} - ${lhp.ten_mon}` }))}
              placeholder="Chọn lớp học phần"
            />
          </Form.Item>
          <Form.Item label="Giảng viên" name="giang_vien_id" rules={[{ required: true }]}>
            <Select
              showSearch
              optionFilterProp="children"
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={giangVienList.map((gv) => ({ value: gv.giang_vien_id, label: `${gv.ho_ten} (${gv.hoc_vi || ''})` }))}
              placeholder="Chọn giảng viên"
            />
          </Form.Item>
          <Form.Item label="Vai trò" name="vai_tro_phu_trach" initialValue="chinh">
            <Select disabled={modalMode === 'edit'} options={[{ value: 'chinh', label: 'Chính' }]} />
          </Form.Item>
          <Form.Item label="Ghi chú" name="ghi_chu">
            <Input.TextArea rows={2} placeholder="Ghi chú (nếu có)" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
              {modalMode === 'edit' ? 'Cập nhật' : 'Phân công'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GiaoVuPhanCongPage;

import React, { useState, useEffect } from 'react';
import { Alert, Card, Table, Button, Modal, Form, Input, Select, message, Popconfirm, Space } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const GiaoVuPhongHocPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showImpactModal, setShowImpactModal] = useState(false);
  const [impactLoading, setImpactLoading] = useState(false);
  const [impactData, setImpactData] = useState(null);
  const [replacementMap, setReplacementMap] = useState({});
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/giao-vu/phong-hoc');
      setData(res.data || []);
    } catch {
      message.error('Lỗi tải dữ liệu!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (record = null) => {
    setEditing(record);
    if (record) {
      form.setFieldsValue({
        ma_phong: record.ma_phong,
        ten_phong: record.ten_phong,
        suc_chua: record.suc_chua,
        loai_phong: record.loai_phong,
      });
    } else {
      form.resetFields();
    }
    setShowModal(true);
  };

  const handleClose = () => {
    setShowModal(false);
    setEditing(null);
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      if (editing) {
        await api.put(`/giao-vu/phong-hoc/${editing.phong_hoc_id}`, {
          ten_phong:  values.ten_phong,
          suc_chua:   values.suc_chua,
          loai_phong: values.loai_phong,
        });
        message.success('Cập nhật phòng học thành công!');
      } else {
        await api.post('/giao-vu/phong-hoc', values);
        message.success('Thêm phòng học thành công!');
      }
      handleClose();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi lưu phòng học!');
    }
  };

  const handleDeleteLegacy = async (id) => {
    try {
      await api.delete(`/giao-vu/phong-hoc/${id}`);
      message.success('Đã tạm dừng phòng học!');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi xóa phòng học!');
    }
  };

  const handleDelete = async (id) => {
    setImpactLoading(true);
    try {
      const impactRes = await api.get(`/giao-vu/phong-hoc/${id}/anh-huong`);
      const affected = impactRes.data?.affected || [];

      if (affected.length > 0) {
        setImpactData(impactRes.data);
        setReplacementMap({});
        setShowImpactModal(true);
        return;
      }

      await api.post(`/giao-vu/phong-hoc/${id}/chuyen-phong-tam-dung`, { replacements: [] });
      message.success('Da tam dung phong hoc!');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Loi tam dung phong hoc!');
    } finally {
      setImpactLoading(false);
    }
  };

  const handleConfirmPause = async () => {
    const affected = impactData?.affected || [];
    const roomId = impactData?.phong_hoc?.phong_hoc_id;
    const replacements = affected.map(item => ({
      tkb_slot_id: item.tkb_slot_id,
      phong_hoc_id: replacementMap[item.tkb_slot_id],
    }));

    if (!roomId) return;
    if (replacements.some(item => !item.phong_hoc_id)) {
      message.error('Vui long chon phong thay the cho tat ca lop hoc phan bi anh huong!');
      return;
    }

    setImpactLoading(true);
    try {
      const res = await api.post(`/giao-vu/phong-hoc/${roomId}/chuyen-phong-tam-dung`, { replacements });
      message.success(res.data?.message || 'Da chuyen phong va tam dung phong hoc!');
      setShowImpactModal(false);
      setImpactData(null);
      setReplacementMap({});
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Loi chuyen phong!');
    } finally {
      setImpactLoading(false);
    }
  };

  const handleReactivate = async (record) => {
    try {
      await api.put(`/giao-vu/phong-hoc/${record.phong_hoc_id}`, { trang_thai: 'hoat_dong' });
      message.success('Da mo lai phong hoc!');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Loi mo lai phong hoc!');
    }
  };

  const columns = [
    { title: 'Mã phòng', dataIndex: 'ma_phong', key: 'ma_phong', width: 140 },
    { title: 'Tên phòng', dataIndex: 'ten_phong', key: 'ten_phong' },
    { title: 'Sức chứa', dataIndex: 'suc_chua', key: 'suc_chua', width: 100 },
    {
      title: 'Loại phòng',
      dataIndex: 'loai_phong',
      key: 'loai_phong',
      width: 120,
      render: (v) => {
        const map = { ly_thuyet: 'Lý thuyết', thuc_hanh: 'Thực hành', thi: 'Thi' };
        return map[v] || v;
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 110,
      render: (v) => {
        const map = { hoat_dong: 'Hoạt động', tam_dung: 'Tạm dừng', sap_chua: 'Sắp sửa' };
        return map[v] || v;
      }
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 150,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpen(record)}>Sửa</Button>
          {record.trang_thai === 'tam_dung' ? (
            <Popconfirm title="Mo lai phong nay?" onConfirm={() => handleReactivate(record)}>
              <Button size="small">Mo lai</Button>
            </Popconfirm>
          ) : (
            <Popconfirm title="Tam dung phong nay?" onConfirm={() => handleDelete(record.phong_hoc_id)}>
              <Button size="small" danger icon={<DeleteOutlined />} loading={impactLoading}>Tam dung</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  const impactColumns = [
    { title: 'Ma LHP', dataIndex: 'ma_lop_hp', key: 'ma_lop_hp', width: 120 },
    { title: 'Ten LHP', dataIndex: 'ten_lop_hp', key: 'ten_lop_hp', width: 140 },
    { title: 'Mon hoc', dataIndex: 'ten_mon', key: 'ten_mon' },
    {
      title: 'Thoi gian',
      key: 'thoi_gian',
      width: 130,
      render: (_, record) => `Thu ${record.thu_trong_tuan}, tiet ${record.tiet_bat_dau}-${record.tiet_ket_thuc}`,
    },
    {
      title: 'Suc chua can',
      dataIndex: 'suc_chua_yeu_cau',
      key: 'suc_chua_yeu_cau',
      width: 110,
    },
    {
      title: 'Phong thay the',
      key: 'phong_thay_the',
      width: 260,
      render: (_, record) => {
        const selectedSameTimeRooms = new Set(
          (impactData?.affected || [])
            .filter(item =>
              item.tkb_slot_id !== record.tkb_slot_id &&
              item.tkb_id === record.tkb_id &&
              item.khung_thoi_gian_id === record.khung_thoi_gian_id
            )
            .map(item => replacementMap[item.tkb_slot_id])
            .filter(Boolean)
        );

        return (
          <Select
            style={{ width: '100%' }}
            placeholder={record.phong_thay_the?.length ? 'Chon phong moi' : 'Khong co phong phu hop'}
            disabled={!record.phong_thay_the?.length}
            value={replacementMap[record.tkb_slot_id]}
            onChange={(value) => setReplacementMap(prev => ({ ...prev, [record.tkb_slot_id]: value }))}
            options={(record.phong_thay_the || []).map(ph => ({
              value: ph.phong_hoc_id,
              label: `${ph.ma_phong} - ${ph.ten_phong} (${ph.suc_chua} cho)`,
              disabled: selectedSameTimeRooms.has(ph.phong_hoc_id),
            }))}
          />
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">PHÒNG HỌC</h2>

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Tải lại</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpen(null)}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Thêm Phòng Học
          </Button>
        </div>

        <Table
          dataSource={data}
          rowKey="phong_hoc_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa Phòng Học' : 'Thêm Phòng Học'}
        open={showModal}
        onCancel={handleClose}
        footer={null}
        width={500}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item
            label="Mã phòng"
            name="ma_phong"
            rules={[{ required: true, message: 'Nhập mã phòng' }]}
          >
            <Input placeholder="VD: A101" disabled={!!editing} />
          </Form.Item>

          <Form.Item
            label="Tên phòng"
            name="ten_phong"
            rules={[{ required: true, message: 'Nhập tên phòng' }]}
          >
            <Input placeholder="VD: Phòng A101" />
          </Form.Item>

          <Form.Item
            label="Sức chứa"
            name="suc_chua"
            rules={[{ required: true, message: 'Nhập sức chứa' }]}
          >
            <Input type="number" placeholder="VD: 50" min={1} />
          </Form.Item>

          <Form.Item
            label="Loại phòng"
            name="loai_phong"
            rules={[{ required: true, message: 'Chọn loại phòng' }]}
          >
            <Select
              placeholder="Chọn loại phòng"
              options={[
                { value: 'ly_thuyet', label: 'Lý thuyết' },
                { value: 'thuc_hanh', label: 'Thực hành' },
                { value: 'thi', label: 'Thi' },
              ]}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
              {editing ? 'Cập nhật' : 'Thêm mới'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Lop hoc phan bi anh huong"
        open={showImpactModal}
        onCancel={() => {
          setShowImpactModal(false);
          setImpactData(null);
          setReplacementMap({});
        }}
        onOk={handleConfirmPause}
        okText="Chuyen phong va tam dung"
        cancelText="Huy"
        confirmLoading={impactLoading}
        width={1000}
        okButtonProps={{
          disabled: (impactData?.affected || []).some(item => !replacementMap[item.tkb_slot_id] || !item.phong_thay_the?.length),
        }}
      >
        <Alert
          type="warning"
          showIcon
          message={`${impactData?.phong_hoc?.ma_phong || ''} dang co ${(impactData?.affected || []).length} lop hoc phan su dung`}
          description="Chon phong thay the du suc chua va khong trung lich cho tung lop hoc phan truoc khi tam dung phong."
          style={{ marginBottom: 16 }}
        />
        <Table
          dataSource={impactData?.affected || []}
          rowKey="tkb_slot_id"
          columns={impactColumns}
          pagination={false}
          size="small"
        />
      </Modal>
    </div>
  );
};

export default GiaoVuPhongHocPage;

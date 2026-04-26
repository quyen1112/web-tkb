import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Modal, Form, Input, Select,
  message, Popconfirm, Space, Tag, InputNumber
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const TRANG_THAI_COLOR = {
  hoat_dong: 'green',
  tam_dung: 'orange',
  ket_thuc: 'red',
};

const isEndedLHP = (record) => record?.trang_thai === 'ket_thuc';

const TEN_VIET_TAT_MON_HOC = {
  CS101: 'NMLT',
  CS102: 'THVP',
  CS201: 'CTDL',
  CS302: 'Mạng MT',
  AD212: 'Hùng biện',
  IS430: 'Blockchain',
};

const getTenVietTatMonHoc = (monHoc) => {
  const maMon = String(monHoc?.ma_mon || '').trim();
  if (TEN_VIET_TAT_MON_HOC[maMon]) return TEN_VIET_TAT_MON_HOC[maMon];

  const tenMon = String(monHoc?.ten_mon || '').trim();
  if (!tenMon) return maMon || 'LHP';

  return tenMon
    .split(/\s+/)
    .filter(word => !['và', 'va'].includes(word.toLowerCase()))
    .map(word => word[0])
    .join('')
    .toUpperCase();
};

const buildLopHPPreview = ({ hocKyId, monHocId, hocKys, monHocList, lopHocPhanList }) => {
  const hocKy = hocKys.find(hk => hk.hoc_ky_id === hocKyId);
  const monHoc = monHocList.find(mh => mh.mon_hoc_id === monHocId);
  const firstYear = String(hocKy?.nam_hoc || '').match(/\d{4}/)?.[0];
  const hocKyNumber = String(hocKy?.ten_hoc_ky || '').match(/\d+/)?.[0];
  const maMon = String(monHoc?.ma_mon || '').trim();

  if (!firstYear || !hocKyNumber || !maMon) {
    return { ma_lop_hp: '', ten_lop_hp: '' };
  }

  const prefix = `${firstYear.slice(-2)}${Number(hocKyNumber)}${maMon}`;
  const maxIndex = lopHocPhanList
    .filter(lhp => lhp.hoc_ky_id === hocKyId && lhp.mon_hoc_id === monHocId)
    .reduce((max, lhp) => {
      const maLop = String(lhp.ma_lop_hp || '');
      if (!maLop.startsWith(prefix)) return max;
      const suffix = maLop.slice(prefix.length);
      if (!/^\d{2}$/.test(suffix)) return max;
      return Math.max(max, Number(suffix));
    }, 0);

  const suffix = String(maxIndex + 1).padStart(2, '0');

  return {
    ma_lop_hp: `${prefix}${suffix}`,
    ten_lop_hp: `${getTenVietTatMonHoc(monHoc)} - ${suffix}`,
  };
};

const GiaoVuLHPPage = () => {
  const [data, setData]           = useState([]);
  const [allData, setAllData]     = useState([]);
  const [hocKys, setHocKys]       = useState([]);
  const [monHocList, setMonHocList] = useState([]);
  const [selectedHK, setSelectedHK] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]     = useState(null);
  const [form] = Form.useForm();
  const watchedHocKyId = Form.useWatch('hoc_ky_id', form);
  const watchedMonHocId = Form.useWatch('mon_hoc_id', form);

  useEffect(() => {
    fetchHocKy();
    fetchMonHoc();
  }, []);

  useEffect(() => {
    if (selectedHK) fetchData();
  }, [selectedHK]);

  useEffect(() => {
    if (!showModal || editing) return;

    const preview = buildLopHPPreview({
      hocKyId: watchedHocKyId,
      monHocId: watchedMonHocId,
      hocKys,
      monHocList,
      lopHocPhanList: allData,
    });
    form.setFieldsValue(preview);
  }, [showModal, editing, watchedHocKyId, watchedMonHocId, hocKys, monHocList, allData, form]);

  const fetchHocKy = async () => {
    try {
      const res = await api.get('/giao-vu/hoc-ky');
      setHocKys(res.data || []);
      const active = res.data?.find(hk => hk.trang_thai === 'hoat_dong');
      if (active) setSelectedHK(active.hoc_ky_id);
    } catch { /* ignore */ }
  };

  const fetchMonHoc = async () => {
    try {
      const res = await api.get('/giao-vu/mon-hoc');
      setMonHocList(res.data || []);
    } catch { setMonHocList([]); }
  };

  const fetchData = async () => {
    if (!selectedHK) return;
    setLoading(true);
    try {
      const res = await api.get('/giao-vu/lop-hoc-phan', {
        params: { hoc_ky_id: selectedHK, limit: 200 }
      });
      setAllData(res.data || []);
      setData((res.data || []).filter(record => !isEndedLHP(record)));
    } catch {
      message.error('Lỗi tải danh sách lớp học phần!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpen = (record = null) => {
    if (isEndedLHP(record)) {
      message.info('Lop hoc phan da ket thuc, khong the cap nhat.');
      fetchData();
      return;
    }

    setEditing(record);
    if (record) {
      form.setFieldsValue({
        mon_hoc_id:   record.mon_hoc_id,
        hoc_ky_id:    record.hoc_ky_id,
        ma_lop_hp:    record.ma_lop_hp,
        ten_lop_hp:   record.ten_lop_hp,
        si_so_toi_da: record.si_so_toi_da,
      });
    } else {
      form.resetFields();
      form.setFieldsValue({ hoc_ky_id: selectedHK });
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
        if (isEndedLHP(editing)) {
          message.info('Lop hoc phan da ket thuc, khong the cap nhat.');
          handleClose();
          fetchData();
          return;
        }
        await api.put(`/giao-vu/lop-hoc-phan/${editing.lop_hoc_phan_id}`, values);
        message.success('Cập nhật lớp học phần thành công!');
      } else {
        await api.post('/giao-vu/lop-hoc-phan', values);
        message.success('Thêm lớp học phần thành công!');
      }
      handleClose();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi lưu lớp học phần!');
    }
  };

  const handleDelete = async (record) => {
    try {
      const res = await api.delete(`/giao-vu/lop-hoc-phan/${record.lop_hoc_phan_id}`);
      message.info(res.data?.message || 'Lop hoc phan da ket thuc va duoc an khoi danh sach.');
      fetchData();
      return;
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi xóa lớp học phần!');
    }
  };

  const columns = [
    { title: 'Mã LHP', dataIndex: 'ma_lop_hp', key: 'ma_lop_hp', width: 140 },
    { title: 'Tên LHP', dataIndex: 'ten_lop_hp', key: 'ten_lop_hp' },
    { title: 'Môn học', dataIndex: 'ten_mon', key: 'ten_mon' },
    { title: 'Sĩ số TĐ', dataIndex: 'si_so_toi_da', key: 'si_so_toi_da', width: 100 },
    { title: 'GV phụ trách', dataIndex: 'ten_gv', key: 'ten_gv', render: v => v || <span style={{ color: '#aaa' }}>Chưa phân công</span> },
    {
      title: 'Trạng thái', dataIndex: 'trang_thai', key: 'trang_thai', width: 120,
      render: v => <Tag color={TRANG_THAI_COLOR[v] || 'default'}>{v === 'hoat_dong' ? 'Hoạt động' : v === 'tam_dung' ? 'Tạm dừng' : 'Kết thúc'}</Tag>
    },
    {
      title: 'Hành động', key: 'actions', width: 160,
      render: (_, record) => isEndedLHP(record) ? (
        <Tag color="red">Ket thuc</Tag>
      ) : (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpen(record)}>Sửa</Button>
          <Popconfirm
            title="Xóa lớp học phần này?"
            description="Hành động này không thể hoàn tác."
            onConfirm={() => handleDelete(record)}
            okText="Xóa" cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />}>Xóa</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">QUẢN LÝ LỚP HỌC PHẦN</h2>

      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <Select
            value={selectedHK}
            onChange={setSelectedHK}
            style={{ width: 220 }}
            placeholder="Chọn học kỳ"
            options={hocKys.map(hk => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>Tải lại</Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpen(null)}
            disabled={!selectedHK}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Thêm LHP
          </Button>
        </div>

        <Table
          dataSource={data}
          rowKey="lop_hoc_phan_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 15, showSizeChanger: true, showTotal: total => `Tổng ${total} lớp` }}
          locale={{ emptyText: selectedHK ? 'Chưa có lớp học phần nào' : 'Vui lòng chọn học kỳ' }}
        />
      </Card>

      <Modal
        title={editing ? 'Sửa Lớp Học Phần' : 'Thêm Lớp Học Phần'}
        open={showModal}
        onCancel={handleClose}
        footer={null}
        width={520}
        destroyOnClose
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Học kỳ" name="hoc_ky_id" rules={[{ required: true, message: 'Chọn học kỳ' }]}>
            <Select
              placeholder="Chọn học kỳ"
              disabled
              options={hocKys.map(hk => ({ value: hk.hoc_ky_id, label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}` }))}
            />
          </Form.Item>

          <Form.Item label="Môn học" name="mon_hoc_id" rules={[{ required: true, message: 'Chọn môn học' }]}>
            <Select
              showSearch
              placeholder="Chọn môn học"
              optionFilterProp="children"
              disabled={!!editing}
              filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={monHocList.map(mh => ({ value: mh.mon_hoc_id, label: `${mh.ma_mon} - ${mh.ten_mon}` }))}
            />
          </Form.Item>

          <Form.Item label="Mã lớp HP" name="ma_lop_hp" rules={[{ required: true, message: 'Nhập mã lớp học phần' }]}>
            <Input disabled />
          </Form.Item>

          <Form.Item label="Tên lớp HP" name="ten_lop_hp">
            <Input disabled />
          </Form.Item>

          <Form.Item label="Sĩ số tối đa" name="si_so_toi_da" rules={[{ required: true, message: 'Nhập sĩ số tối đa' }]}>
            <InputNumber min={1} max={200} style={{ width: '100%' }} placeholder="VD: 40" />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
            <Space>
              <Button onClick={handleClose}>Hủy</Button>
              <Button type="primary" htmlType="submit" style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
                {editing ? 'Cập nhật' : 'Thêm mới'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GiaoVuLHPPage;

import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, InputNumber, Modal, Select, Space, Table, Tag, message } from 'antd';
import { EditOutlined, LockOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import api from '../../services/api';

const VAI_TRO_OPTIONS = [
  { value: 'admin', label: 'Admin' },
  { value: 'giao_vu', label: 'Giáo vụ' },
  { value: 'giang_vien', label: 'Giảng viên' },
  { value: 'sinh_vien', label: 'Sinh viên' },
  { value: 'truong_khoa', label: 'Trưởng khoa' },
];

const vaiTroMap = {
  admin: 'Admin',
  giao_vu: 'Giáo vụ',
  giang_vien: 'Giảng viên',
  sinh_vien: 'Sinh viên',
  truong_khoa: 'Trưởng khoa',
};

const mauVaiTro = {
  admin: 'red',
  giao_vu: 'blue',
  giang_vien: 'green',
  sinh_vien: 'cyan',
  truong_khoa: 'purple',
};

const getPrimaryRole = (vaiTro) => (Array.isArray(vaiTro) ? vaiTro[0] : vaiTro || null);

const AdminNguoiDungPage = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [selectedRoleFilter, setSelectedRoleFilter] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [form] = Form.useForm();

  const watchedRole = Form.useWatch('vai_tro', form);
  const activeRole = useMemo(
    () => (modalMode === 'edit' ? getPrimaryRole(selectedRecord?.vai_tro) : watchedRole),
    [modalMode, selectedRecord, watchedRole],
  );

  useEffect(() => {
    fetchData();
  }, [selectedRoleFilter]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/nguoi-dung', {
        params: selectedRoleFilter ? { vai_tro: selectedRoleFilter } : {},
      });
      setData(res.data?.data || []);
    } catch {
      setData([]);
      message.error('Lỗi tải người dùng!');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreate = () => {
    setModalMode('create');
    setSelectedRecord(null);
    setShowModal(true);
    form.resetFields();
    form.setFieldsValue({ vai_tro: 'giao_vu' });
  };

  const handleOpenEdit = (record) => {
    setModalMode('edit');
    setSelectedRecord(record);
    setShowModal(true);
    form.setFieldsValue({
      ho_ten: record.ho_ten,
      email: record.email,
      vai_tro: getPrimaryRole(record.vai_tro),
      trang_thai: record.trang_thai,
      ma_gv: record.ma_gv,
      hoc_vi: record.hoc_vi,
      ma_sv: record.ma_sv,
      lop_hanh_chinh_id: record.lop_hanh_chinh_id,
    });
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRecord(null);
    setModalMode('create');
    form.resetFields();
  };

  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      if (modalMode === 'edit' && selectedRecord) {
        if (selectedRecord.trang_thai === 'hoat_dong' && values.trang_thai === 'khoa') {
          message.info('Vui lòng xác nhận khóa bằng nút Khóa/Mở để xem các lớp học phần bị ảnh hưởng.');
          await handleKhoa(selectedRecord);
          return;
        }

        await api.put(`/admin/nguoi-dung/${selectedRecord.user_id}`, {
          ho_ten: values.ho_ten,
          email: values.email,
          trang_thai: values.trang_thai,
          ma_gv: values.ma_gv,
          hoc_vi: values.hoc_vi,
          ma_sv: values.ma_sv,
          lop_hanh_chinh_id: values.lop_hanh_chinh_id,
        });
        message.success('Cập nhật người dùng thành công!');
      } else {
        await api.post('/admin/nguoi-dung', values);
        message.success('Thêm người dùng thành công!');
      }
      handleCloseModal();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi lưu người dùng!');
    } finally {
      setSubmitting(false);
    }
  };

  const renderImpactContent = (preview) => {
    const role = preview?.primaryRole;
    const classes = preview?.lop_hoc_phan || [];

    if (role !== 'sinh_vien' && role !== 'giang_vien') {
      return <p>Bạn có chắc chắn muốn cập nhật trạng thái người dùng này?</p>;
    }

    return (
      <div>
        <p>
          {role === 'sinh_vien'
            ? 'Sinh viên sẽ bị đưa ra khỏi các lớp học phần đang học bên dưới.'
            : 'Giáo vụ và sinh viên trong các lớp bên dưới sẽ nhận thông báo để phân công lại giảng viên.'}
        </p>
        <Table
          size="small"
          rowKey={(row) => row.lop_hoc_phan_id}
          dataSource={classes}
          pagination={false}
          columns={[
            { title: 'Mã LHP', dataIndex: 'ma_lop_hp', key: 'ma_lop_hp', width: 120 },
            { title: 'Môn học', dataIndex: 'ten_mon', key: 'ten_mon' },
            ...(role === 'sinh_vien'
              ? [{ title: 'Giảng viên', dataIndex: 'ten_gv', key: 'ten_gv' }]
              : []),
          ]}
          locale={{ emptyText: 'Không có lớp học phần đang hoạt động bị ảnh hưởng.' }}
        />
      </div>
    );
  };

  const handleKhoa = async (record) => {
    try {
      if (record.trang_thai === 'khoa') {
        Modal.confirm({
          title: 'Mở khóa tài khoản?',
          content: 'Tài khoản sẽ được chuyển về trạng thái hoạt động. Dữ liệu lớp học phần không được khôi phục tự động.',
          okText: 'Mở khóa',
          cancelText: 'Hủy',
          onOk: async () => {
            try {
              await api.put(`/admin/nguoi-dung/${record.user_id}/khoa`, { confirm: true });
              message.success('Cập nhật trạng thái thành công!');
              fetchData();
            } catch (err) {
              message.error(err.response?.data?.error || 'Lỗi cập nhật!');
              throw err;
            }
          },
        });
        return;
      }

      const previewRes = await api.get(`/admin/nguoi-dung/${record.user_id}/khoa-preview`);
      const preview = previewRes.data;

      Modal.confirm({
        title: `Xác nhận khóa tài khoản ${record.ho_ten}?`,
        content: renderImpactContent(preview),
        okText: 'Xác nhận khóa',
        cancelText: 'Hủy',
        width: 760,
        okButtonProps: { danger: true },
        onOk: async () => {
          try {
            await api.put(`/admin/nguoi-dung/${record.user_id}/khoa`, { confirm: true });
            message.success('Khóa tài khoản thành công!');
            handleCloseModal();
            fetchData();
          } catch (err) {
            message.error(err.response?.data?.error || 'Lỗi cập nhật!');
            throw err;
          }
        },
      });
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi cập nhật!');
    }
  };

  const columns = [
    { title: 'Họ tên', dataIndex: 'ho_ten', key: 'ho_ten' },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Vai trò',
      dataIndex: 'vai_tro',
      key: 'vai_tro',
      width: 180,
      render: (value) =>
        Array.isArray(value) && value.length > 0
          ? value.map((role) => (
              <Tag key={role} color={mauVaiTro[role] || 'default'}>
                {vaiTroMap[role] || role}
              </Tag>
            ))
          : '-',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'trang_thai',
      key: 'trang_thai',
      width: 110,
      render: (value) => (
        <Tag color={value === 'hoat_dong' ? 'green' : 'red'}>
          {value === 'hoat_dong' ? 'Hoạt động' : 'Khóa'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 180,
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleOpenEdit(record)}>
            Sửa
          </Button>
          <Button size="small" icon={<LockOutlined />} onClick={() => handleKhoa(record)}>
            Khóa/Mở
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <h2 className="page-title">QUẢN LÝ NGƯỜI DÙNG</h2>
      <Card>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <Select
            value={selectedRoleFilter}
            onChange={(value) => setSelectedRoleFilter(value || null)}
            allowClear
            style={{ width: 180 }}
            placeholder="Lọc theo vai trò"
            options={VAI_TRO_OPTIONS}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            Tải lại
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleOpenCreate}
            style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}
          >
            Thêm người dùng
          </Button>
        </div>

        <Table
          dataSource={data}
          rowKey="user_id"
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 10 }}
        />
      </Card>

      <Modal
        title={modalMode === 'edit' ? 'Sửa người dùng' : 'Thêm người dùng'}
        open={showModal}
        onCancel={handleCloseModal}
        footer={null}
        width={520}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit}>
          <Form.Item label="Họ tên" name="ho_ten" rules={[{ required: true }]}>
            <Input placeholder="Họ và tên" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không hợp lệ!' },
              { pattern: /@cntt\.edu\.vn$/, message: 'Email phải có đuôi @cntt.edu.vn!' },
            ]}
          >
            <Input placeholder="vidu@cntt.edu.vn" />
          </Form.Item>

          {modalMode === 'create' && (
            <>
              <Form.Item label="Mật khẩu" name="mat_khau" rules={[{ required: true, min: 6 }]}>
                <Input.Password placeholder="Mật khẩu" />
              </Form.Item>

              <Form.Item label="Vai trò" name="vai_tro" rules={[{ required: true }]}>
                <Select placeholder="Chọn vai trò" options={VAI_TRO_OPTIONS} />
              </Form.Item>
            </>
          )}

          {modalMode === 'edit' && (
            <>
              <Form.Item label="Vai trò">
                <Input value={vaiTroMap[activeRole] || activeRole || ''} disabled />
              </Form.Item>
              <Form.Item label="Trạng thái" name="trang_thai" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'hoat_dong', label: 'Hoạt động' },
                    { value: 'khoa', label: 'Khóa' },
                  ]}
                />
              </Form.Item>
            </>
          )}

          {activeRole === 'giang_vien' && (
            <>
              <Form.Item label="Mã GV" name="ma_gv" rules={[{ required: true }]}>
                <Input placeholder="Mã giảng viên" />
              </Form.Item>
              <Form.Item label="Học vị" name="hoc_vi">
                <Input placeholder="Học vị" />
              </Form.Item>
            </>
          )}

          {activeRole === 'sinh_vien' && (
            <>
              <Form.Item label="Mã SV" name="ma_sv" rules={[{ required: true }]}>
                <Input placeholder="Mã sinh viên" />
              </Form.Item>
              <Form.Item label="Lớp hành chính ID" name="lop_hanh_chinh_id" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} placeholder="Nhập lop_hanh_chinh_id" />
              </Form.Item>
            </>
          )}

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting} style={{ backgroundColor: '#C63633', borderColor: '#C63633' }}>
              {modalMode === 'edit' ? 'Cập nhật' : 'Thêm'}
            </Button>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminNguoiDungPage;

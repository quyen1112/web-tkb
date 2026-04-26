import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Card,
  DatePicker,
  Form,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Table,
  Tabs,
  Tag,
  message,
} from 'antd';
import {
  ClockCircleOutlined,
  EditOutlined,
  LeftOutlined,
  PlusOutlined,
  ReloadOutlined,
  RightOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import api from '../../services/api';
import TKBStatusBadge from '../../components/common/TKBStatusBadge';
import TKBGrid from '../../features/tkb/TKBGrid';
import { useTKB } from '../../features/tkb/useTKB';
import { THU_LABELS } from '../../utils/tkbGrid';

const { RangePicker } = DatePicker;
const LOCKED_STATUSES = ['da_phe_duyet', 'da_cong_bo'];

const normalizeTkbResponse = (payload, hocKyId) => {
  if (Array.isArray(payload)) {
    return {
      tkb: payload[0]
        ? {
            tkb_id: payload[0].tkb_id,
            hoc_ky_id: hocKyId,
            trang_thai: payload[0].tkb_trang_thai || null,
            ghi_chu: null,
          }
        : null,
      slots: payload,
    };
  }

  return {
    tkb: payload?.tkb || null,
    slots: payload?.slots || payload?.buoi_hoc || [],
  };
};

const formatThu = (thu) => THU_LABELS[thu] || `Thứ ${thu}`;

const GVTKBPage = () => {
  const [selectedHK, setSelectedHK] = useState(null);
  const [weekRange, setWeekRange] = useState(null);
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('tuan');
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const hocKyQuery = useQuery({
    queryKey: ['giao-vu', 'hoc-ky'],
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const response = await api.get('/giao-vu/hoc-ky');
      return response.data || [];
    },
  });

  const phongHocQuery = useQuery({
    queryKey: ['giao-vu', 'phong-hoc'],
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const response = await api.get('/giao-vu/phong-hoc');
      return response.data || [];
    },
  });

  const khungTGQuery = useQuery({
    queryKey: ['giao-vu', 'khung-thoi-gian'],
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const response = await api.get('/giao-vu/khung-thoi-gian');
      return response.data || [];
    },
  });

  const phanCongQuery = useQuery({
    queryKey: ['giao-vu', 'phan-cong', selectedHK],
    enabled: showModal && !selectedSlot && !!selectedHK,
    retry: 1,
    queryFn: async () => {
      const response = await api.get('/giao-vu/phan-cong', {
        params: { hoc_ky_id: selectedHK },
      });
      return response.data || [];
    },
  });

  const tkbQuery = useTKB('giao_vu', selectedHK, { includeMeta: true });

  useEffect(() => {
    const hocKys = hocKyQuery.data || [];
    if (!selectedHK && hocKys.length > 0) {
      const activeHK = hocKys.find((hk) => hk.trang_thai === 'hoat_dong') || hocKys[0];
      setSelectedHK(activeHK?.hoc_ky_id || null);
    }
  }, [hocKyQuery.data, selectedHK]);

  useEffect(() => {
    if (!weekRange) {
      const dow = dayjs().day();
      const startOfWeek = dayjs().subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day');
      setWeekRange([startOfWeek, startOfWeek.add(6, 'day')]);
    }
  }, [weekRange]);

  useEffect(() => {
    if (hocKyQuery.error) message.error('Lỗi tải học kỳ.');
  }, [hocKyQuery.error]);

  useEffect(() => {
    if (phongHocQuery.error) message.error('Lỗi tải phòng học.');
  }, [phongHocQuery.error]);

  useEffect(() => {
    if (khungTGQuery.error) message.error('Lỗi tải khung thời gian.');
  }, [khungTGQuery.error]);

  useEffect(() => {
    if (phanCongQuery.error && showModal && !selectedSlot) {
      message.error('Lỗi tải phân công.');
    }
  }, [phanCongQuery.error, selectedSlot, showModal]);

  useEffect(() => {
    if (tkbQuery.error && selectedHK) {
      message.error('Lỗi tải thời khóa biểu.');
    }
  }, [selectedHK, tkbQuery.error]);

  const normalizedTKB = useMemo(
    () => normalizeTkbResponse(tkbQuery.data, selectedHK),
    [selectedHK, tkbQuery.data]
  );

  const tkbId = normalizedTKB.tkb?.tkb_id ?? null;
  const tkbStatus = normalizedTKB.tkb?.trang_thai ?? null;
  const tkbData = normalizedTKB.slots || [];
  const isTkbLocked = LOCKED_STATUSES.includes(tkbStatus);
  const hocKyList = Array.isArray(hocKyQuery.data) ? hocKyQuery.data : [];
  const selectedHocKy = hocKyList.find((hk) => hk.hoc_ky_id === selectedHK) || null;

  const navigateWeek = (direction) => {
    if (!weekRange) return;
    const [start] = weekRange;
    const newStart = start.add(direction * 7, 'day');
    setWeekRange([newStart, newStart.add(6, 'day')]);
  };

  const goToCurrentWeek = () => {
    const dow = dayjs().day();
    const startOfWeek = dayjs().subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day');
    setWeekRange([startOfWeek, startOfWeek.add(6, 'day')]);
  };

  const handleOpenModal = (slot = null) => {
    if (isTkbLocked) {
      message.warning('TKB đã phê duyệt hoặc đã công bố, không thể thêm/sửa slot.');
      return;
    }

    setSelectedSlot(slot);
    setShowModal(true);

    if (slot) {
      form.setFieldsValue({
        phong_hoc_id: slot.phong_hoc_id,
        khung_thoi_gian_id: slot.khung_thoi_gian_id,
        hinh_thuc: slot.hinh_thuc,
        ghi_chu: slot.ghi_chu,
      });
      return;
    }

    form.resetFields();
  };

  const handleGridAddCell = ({ thu, tiet }) => {
    if (!tkbId) {
      message.error('Học kỳ này chưa có TKB.');
      return;
    }

    handleOpenModal(null);
    const preselected = (khungTGQuery.data || []).find(
      (item) => item.thu_trong_tuan === thu && item.tiet_bat_dau === tiet
    );
    if (preselected) {
      form.setFieldsValue({ khung_thoi_gian_id: preselected.khung_thoi_gian_id });
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedSlot(null);
    form.resetFields();
  };

  const handleCreateTKB = async () => {
    if (!selectedHK) {
      message.error('Chọn học kỳ trước.');
      return;
    }

    try {
      setWorkflowLoading(true);
      await api.post('/giao-vu/tao-tkb', { hoc_ky_id: selectedHK });
      message.success('Tạo TKB thành công.');
      await queryClient.invalidateQueries({ queryKey: ['tkb'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await tkbQuery.refetch();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi tạo TKB.');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleGuiPheDuyet = async () => {
    if (!tkbId) return;

    try {
      setWorkflowLoading(true);
      await api.put(`/giao-vu/gui-phe-duyet-tkb/${tkbId}`);
      message.success('Đã gửi phê duyệt TKB.');
      await queryClient.invalidateQueries({ queryKey: ['tkb'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await tkbQuery.refetch();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi gửi phê duyệt TKB.');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const handleCongBo = async () => {
    if (!tkbId) return;

    try {
      setWorkflowLoading(true);
      await api.put(`/giao-vu/cong-bo-tkb/${tkbId}`);
      message.success('Đã công bố TKB.');
      await queryClient.invalidateQueries({ queryKey: ['tkb'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await tkbQuery.refetch();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi công bố TKB.');
    } finally {
      setWorkflowLoading(false);
    }
  };

  const addSlot = async (values) => {
    if (!tkbId) {
      message.error('Học kỳ này chưa có TKB.');
      return;
    }

    try {
      await api.post('/giao-vu/tkb-slot', { ...values, tkb_id: tkbId });
      message.success('Thêm slot TKB thành công.');
      handleCloseModal();
      await queryClient.invalidateQueries({ queryKey: ['tkb'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await tkbQuery.refetch();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi thêm slot TKB.');
    }
  };

  const editSlot = async (values) => {
    if (!selectedSlot?.tkb_slot_id) {
      message.error('Không xác định được slot cần sửa.');
      return;
    }

    try {
      await api.put(`/giao-vu/tkb-slot/${selectedSlot.tkb_slot_id}`, values);
      message.success('Cập nhật slot TKB thành công.');
      handleCloseModal();
      await queryClient.invalidateQueries({ queryKey: ['tkb'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await tkbQuery.refetch();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi cập nhật slot TKB.');
    }
  };

  const handleDelete = async (tkbSlotId) => {
    try {
      await api.delete(`/giao-vu/tkb-slot/${tkbSlotId}`);
      message.success('Xóa slot TKB thành công.');
      await queryClient.invalidateQueries({ queryKey: ['tkb'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await tkbQuery.refetch();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi xóa slot TKB.');
    }
  };

  const columns = [
    { title: 'Mã LHP', dataIndex: 'ma_lop_hp', key: 'ma_lop_hp' },
    { title: 'Môn học', dataIndex: 'ten_mon', key: 'ten_mon' },
    { title: 'Giảng viên', dataIndex: 'ten_gv', key: 'ten_gv' },
    { title: 'Phòng', dataIndex: 'ten_phong', key: 'ten_phong' },
    { title: 'Thứ', dataIndex: 'thu_trong_tuan', key: 'thu_trong_tuan', render: (value) => formatThu(value) },
    { title: 'Tiết', key: 'tiet', render: (_, record) => `${record.tiet_bat_dau}-${record.tiet_ket_thuc}` },
    { title: 'Giờ', key: 'gio', render: (_, record) => `${record.gio_bat_dau} - ${record.gio_ket_thuc}` },
    {
      title: 'Hành động',
      key: 'actions',
      render: (_, record) =>
        isTkbLocked ? (
          <Button danger size="small" disabled>
            Xóa
          </Button>
        ) : (
          <Popconfirm title="Xóa slot TKB này?" onConfirm={() => handleDelete(record.tkb_slot_id)}>
            <Button danger size="small">
              Xóa
            </Button>
          </Popconfirm>
        ),
    },
  ];

  const gridData = tkbData.map((slot) => ({
    ...slot,
    id: slot.tkb_slot_id,
    phong_hoc: slot.ten_phong,
    giang_vien: slot.ten_gv,
    lop_hoc_phan: slot.ma_lop_hp,
    ma_mon: slot.ma_mon,
    thu: slot.thu_trong_tuan,
    tiet_bat_dau: slot.tiet_bat_dau,
  }));

  return (
    <div className="tkb-page">
      <h2 className="page-title">THỜI KHÓA BIỂU</h2>

      <Card>
        <div className="tkb-toolbar">
          <Space size={8}>
            <strong>Học kỳ:</strong>
            <Select
              value={selectedHK}
              onChange={(value) => {
                setSelectedHK(value);
                setSelectedSlot(null);
                setShowModal(false);
                form.resetFields();
              }}
              style={{ width: 220 }}
              placeholder="Chọn học kỳ"
              loading={hocKyQuery.isLoading}
              options={(hocKyQuery.data || []).map((hk) => ({
                value: hk.hoc_ky_id,
                label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}`,
              }))}
            />
          </Space>

          <Button icon={<ReloadOutlined />} onClick={() => tkbQuery.refetch()} loading={tkbQuery.isFetching}>
            Tải lại
          </Button>

          {!tkbId && (
            <Button type="primary" icon={<EditOutlined />} onClick={handleCreateTKB} loading={workflowLoading}>
              Tạo TKB
            </Button>
          )}

          {tkbId && tkbStatus === 'nhap' && (
            <Button icon={<ClockCircleOutlined />} onClick={handleGuiPheDuyet} loading={workflowLoading}>
              Gửi phê duyệt
            </Button>
          )}

          {tkbId && tkbStatus === 'da_phe_duyet' && (
            <Button type="primary" icon={<RocketOutlined />} onClick={handleCongBo} loading={workflowLoading}>
              Công bố
            </Button>
          )}

          <Button type="primary" icon={<PlusOutlined />} onClick={() => handleOpenModal(null)} disabled={!tkbId || isTkbLocked}>
            Thêm Slot
          </Button>

          {tkbId ? <TKBStatusBadge status={tkbStatus} /> : <Tag>Chưa có TKB</Tag>}
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={[
            {
              key: 'tuan',
              label: 'TKB TUẦN',
              children: (
                <>
                  <div className="tkb-filter-bar">
                    <Button type="primary" className="tkb-filter-nav" icon={<LeftOutlined />} onClick={() => navigateWeek(-1)} />
                    <RangePicker
                      value={weekRange}
                      onChange={(dates) => {
                        if (dates) setWeekRange(dates);
                      }}
                      format="DD/MM/YYYY"
                    />
                    <Button className="tkb-filter-current" onClick={goToCurrentWeek}>
                      Hiện tại
                    </Button>
                    <Button type="primary" className="tkb-filter-nav" icon={<RightOutlined />} onClick={() => navigateWeek(1)} />
                  </div>

                  <Spin spinning={tkbQuery.isLoading || tkbQuery.isFetching || workflowLoading}>
                    <TKBGrid
                      buoiHoc={gridData}
                      mode="edit"
                      weekRange={weekRange}
                      semesterRange={selectedHocKy ? { start: selectedHocKy.ngay_bat_dau, end: selectedHocKy.ngay_ket_thuc } : null}
                      onCellClick={!isTkbLocked ? handleOpenModal : undefined}
                      onAddCell={tkbId && !isTkbLocked ? handleGridAddCell : undefined}
                      tkbStatus={tkbStatus || 'nhap'}
                    />
                  </Spin>
                </>
              ),
            },
            {
              key: 'thutiet',
              label: 'TKB THỨ - TIẾT',
              children: (
                <Spin spinning={tkbQuery.isLoading || tkbQuery.isFetching}>
                  <Table dataSource={tkbData} rowKey="tkb_slot_id" columns={columns} pagination={{ pageSize: 10 }} />
                </Spin>
              ),
            },
          ]}
        />
      </Card>

      <Modal
        title={selectedSlot ? 'Chi tiết slot TKB' : 'Thêm Slot TKB'}
        open={showModal}
        onCancel={handleCloseModal}
        footer={null}
        width={600}
      >
        <Spin spinning={phanCongQuery.isLoading}>
          <Form form={form} layout="vertical" onFinish={selectedSlot ? editSlot : addSlot}>
            {!selectedSlot && (
              <Form.Item
                label="Phân công (LHP - GV)"
                name="phan_cong_id"
                rules={[{ required: true, message: 'Chọn lớp học phần' }]}
              >
                <Select
                  showSearch
                  placeholder="Chọn lớp học phần"
                  optionFilterProp="children"
                  filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                  options={(phanCongQuery.data || []).map((pc) => ({
                    value: pc.phan_cong_id,
                    label: `${pc.ma_lop_hp} - ${pc.ten_mon} (${pc.ten_gv})`,
                  }))}
                  notFoundContent={!selectedHK ? 'Chọn học kỳ trước' : 'Không có dữ liệu'}
                />
              </Form.Item>
            )}

            <Form.Item label="Phòng học" name="phong_hoc_id" rules={[{ required: true, message: 'Chọn phòng học' }]}>
              <Select
                showSearch
                placeholder="Chọn phòng học"
                optionFilterProp="children"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={(phongHocQuery.data || []).map((ph) => ({
                  value: ph.phong_hoc_id,
                  label: `${ph.ma_phong} - ${ph.ten_phong} (${ph.loai_phong}, ${ph.suc_chua} chỗ)`,
                }))}
              />
            </Form.Item>

            <Form.Item
              label="Khung thời gian"
              name="khung_thoi_gian_id"
              rules={[{ required: true, message: 'Chọn khung thời gian' }]}
            >
              <Select
                showSearch
                placeholder="Chọn khung thời gian"
                optionFilterProp="children"
                filterOption={(input, option) => (option?.label ?? '').toLowerCase().includes(input.toLowerCase())}
                options={(khungTGQuery.data || []).map((kt) => ({
                  value: kt.khung_thoi_gian_id,
                  label: `${formatThu(kt.thu_trong_tuan)} | Tiết ${kt.tiet_bat_dau}-${kt.tiet_ket_thuc} (${kt.gio_bat_dau} - ${kt.gio_ket_thuc})`,
                }))}
              />
            </Form.Item>

            <Form.Item label="Hình thức" name="hinh_thuc">
              <Select
                placeholder="Chọn hình thức"
                options={[
                  { value: 'ly_thuyet', label: 'Lý thuyết' },
                  { value: 'thuc_hanh', label: 'Thực hành' },
                ]}
              />
            </Form.Item>

            <Form.Item label="Ghi chú" name="ghi_chu">
              <Input.TextArea rows={2} placeholder="Ghi chú (nếu có)" />
            </Form.Item>

            <Form.Item>
              <Button type="primary" htmlType="submit">
                {selectedSlot ? 'Cập nhật' : 'Thêm mới'}
              </Button>
            </Form.Item>
          </Form>
        </Spin>
      </Modal>
    </div>
  );
};

export default GVTKBPage;

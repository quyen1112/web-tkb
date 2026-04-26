import { Card, Col, Row, Statistic, Table } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { fmtDate, fmtTime, getCurrentWeek } from '../utils/dateUtils';
import { THU_LABELS } from '../utils/tkbGrid';

const canLoadDashboardData = (role) => ['admin', 'giao_vu', 'truong_khoa'].includes(role);
const canLoadBaoCao = (role) => ['admin', 'giao_vu', 'truong_khoa'].includes(role);
const getHocKyEndpoint = (role) => (role === 'truong_khoa' ? '/truong-khoa/hoc-ky' : '/giao-vu/hoc-ky');

const getDateForThuInCurrentWeek = (thuTrongTuan) => {
  const thu = Number(thuTrongTuan);
  if (!thu || thu < 2 || thu > 8) {
    return null;
  }

  const [monday] = getCurrentWeek();
  return monday.add(thu === 8 ? 6 : thu - 2, 'day');
};

const renderSlotSchedule = (_, record) => {
  const thuLabel = THU_LABELS[record.thu_trong_tuan] || `Thứ ${record.thu_trong_tuan || '-'}`;
  const date = getDateForThuInCurrentWeek(record.thu_trong_tuan);
  const dateText = date ? fmtDate(date) : '-';
  const start = fmtTime(record.gio_bat_dau) || '--:--';
  const end = fmtTime(record.gio_ket_thuc) || '--:--';

  return `${thuLabel}, ${dateText}, ${start} - ${end}`;
};

const recentTKBColumns = [
  { title: 'Môn học', dataIndex: 'ten_mon' },
  { title: 'Lớp HP', dataIndex: 'ma_lop_hp' },
  { title: 'Giảng viên', dataIndex: 'ten_gv' },
  { title: 'Phòng', dataIndex: 'ten_phong', render: (value) => value || 'Chưa xếp' },
  { title: 'Lịch học', key: 'lich_hoc', render: renderSlotSchedule },
];

const DashboardPage = () => {
  const { user } = useAuth();

  const hocKyQuery = useQuery({
    queryKey: ['dashboard', 'hoc-ky'],
    enabled: canLoadDashboardData(user?.vai_tro),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const response = await api.get(getHocKyEndpoint(user?.vai_tro));
      return response.data || [];
    },
  });

  const currentHK = (hocKyQuery.data || []).find((hk) => hk.trang_thai === 'hoat_dong') || null;

  const reportQuery = useQuery({
    queryKey: ['dashboard', 'bao-cao', user?.vai_tro, currentHK?.hoc_ky_id],
    enabled: !!currentHK?.hoc_ky_id && canLoadBaoCao(user?.vai_tro),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const reportEndpoint = user?.vai_tro === 'giao_vu' ? '/giao-vu/bao-cao' : '/truong-khoa/bao-cao';
      const response = await api.get(reportEndpoint, {
        params: { hoc_ky_id: currentHK.hoc_ky_id },
      });
      return response.data || {};
    },
  });

  const recentTKBQuery = useQuery({
    queryKey: ['dashboard', 'recent-tkb', user?.vai_tro, currentHK?.hoc_ky_id],
    enabled: !!currentHK?.hoc_ky_id && canLoadDashboardData(user?.vai_tro),
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const endpoint = canLoadBaoCao(user?.vai_tro)
        ? '/truong-khoa/thoi-khoa-bieu'
        : '/giao-vu/thoi-khoa-bieu';

      const response = await api.get(endpoint, {
        params: { hoc_ky_id: currentHK.hoc_ky_id, limit: 5 },
      });

      const payload = response.data;
      if (Array.isArray(payload)) {
        return payload.slice(0, 5);
      }

      return (payload?.slots || payload?.buoi_hoc || []).slice(0, 5);
    },
  });

  const stats = {
    hocKy: currentHK,
    ...(reportQuery.data || {}),
  };

  const recentTKBs = recentTKBQuery.data || [];
  const isLoading = hocKyQuery.isLoading || reportQuery.isLoading || recentTKBQuery.isLoading;
  const dashboardError = hocKyQuery.error || reportQuery.error || recentTKBQuery.error;

  const renderStats = (items) => (
    <Row gutter={[16, 16]}>
      {items.map((item) => (
        <Col key={item.title} xs={24} sm={12} md={6}>
          <Card>
            <Statistic title={item.title} value={item.value || 0} loading={isLoading} />
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderRecentTKB = () => (
    <Card title="Thời Khóa Biểu Gần Đây" style={{ marginTop: 24 }}>
      <Table
        dataSource={recentTKBs}
        rowKey={(record) => record.tkb_slot_id ?? record.buoi_hoc_id}
        loading={recentTKBQuery.isLoading}
        pagination={false}
        columns={recentTKBColumns}
      />
    </Card>
  );

  const renderRoleDashboard = () => {
    switch (user?.vai_tro) {
      case 'admin':
      case 'truong_khoa':
        return (
          <>
            {renderStats([
              { title: 'Số Giảng viên', value: stats.so_giang_vien },
              { title: 'Số Lớp HP', value: stats.so_lop_hoc_phan },
              { title: 'Số Phòng học', value: stats.so_phong_hoc },
              { title: 'Số Slot TKB', value: stats.so_buoi_hoc },
            ])}
            {renderRecentTKB()}
          </>
        );

      case 'giao_vu':
        return (
          <>
            {renderStats([
              { title: 'Số Slot TKB', value: stats.so_buoi_hoc },
              { title: 'Số Lớp HP', value: stats.so_lop_hoc_phan },
              { title: 'Số Giảng viên', value: stats.so_giang_vien },
              { title: 'Số Phòng học', value: stats.so_phong_hoc },
            ])}
            {renderRecentTKB()}
          </>
        );

      case 'giang_vien':
        return (
          <Card title={`Xin chào, ${user.ho_ten}!`}>
            <p>
              Bạn đang đăng nhập với vai trò <strong>Giảng viên</strong>.
            </p>
            <p>Vui lòng chọn menu bên trái để xem lịch giảng dạy và khai báo lịch bận.</p>
          </Card>
        );

      case 'sinh_vien':
        return (
          <Card title={`Xin chào, ${user.ho_ten}!`}>
            <p>
              Bạn đang đăng nhập với vai trò <strong>Sinh viên</strong>.
            </p>
            <p>Vui lòng chọn menu bên trái để xem lịch học của bạn.</p>
          </Card>
        );

      default:
        return (
          <Card title={`Xin chào, ${user?.ho_ten || ''}!`}>
            <p>Chào mừng bạn đến với Hệ thống Quản lý Thời Khóa Biểu.</p>
          </Card>
        );
    }
  };

  return (
    <div className="page-content">
      <h2 className="page-title">TRANG TỔNG QUAN</h2>

      {canLoadDashboardData(user?.vai_tro) && dashboardError && (
        <Card style={{ marginBottom: 24 }}>Không thể tải dữ liệu dashboard lúc này.</Card>
      )}

      {stats.hocKy && (
        <Card style={{ marginBottom: 24 }}>
          <strong>Học kỳ hiện tại:</strong> {stats.hocKy.ten_hoc_ky} - {stats.hocKy.nam_hoc}
          <span style={{ marginLeft: 20 }}>
            ({fmtDate(stats.hocKy.ngay_bat_dau)} - {fmtDate(stats.hocKy.ngay_ket_thuc)})
          </span>
        </Card>
      )}

      {renderRoleDashboard()}
    </div>
  );
};

export default DashboardPage;

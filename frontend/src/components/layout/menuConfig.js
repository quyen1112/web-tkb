import {
  AppstoreOutlined,
  CalendarOutlined,
  BellOutlined,
  TeamOutlined,
  TableOutlined,
  ApartmentOutlined,
  HomeOutlined,
  ClockCircleOutlined,
  FileTextOutlined,
  UserOutlined,
  BookOutlined,
  ScheduleOutlined,
  BarChartOutlined,
} from '@ant-design/icons';

export const MENU_BY_ROLE = {
  admin: [
    {
      section: 'HỆ THỐNG',
      items: [
        { key: 'dashboard', label: 'Trang tổng quan', to: '/dashboard', icon: AppstoreOutlined },
      ],
    },
    {
      section: 'QUẢN TRỊ',
      items: [
        { key: 'admin-users', label: 'Người dùng', to: '/admin/nguoi-dung', icon: TeamOutlined },
        { key: 'admin-svlhp', label: 'Sinh viên - LHP', to: '/admin/sinh-vien-lhp', icon: ApartmentOutlined },
        { key: 'admin-hoc-ky', label: 'Học kỳ', to: '/admin/hoc-ky', icon: CalendarOutlined },
      ],
    },
  ],
  giao_vu: [
    {
      section: 'HỆ THỐNG',
      items: [
        { key: 'dashboard', label: 'Trang tổng quan', to: '/dashboard', icon: AppstoreOutlined },
      ],
    },
    {
      section: 'QUẢN LÝ ĐÀO TẠO',
      items: [
        { key: 'gv-tkb', label: 'Thời khóa biểu', to: '/giao-vu/tkb', icon: TableOutlined },
        { key: 'gv-lhp', label: 'Lớp học phần', to: '/giao-vu/lop-hoc-phan', icon: BookOutlined },
        { key: 'gv-phan-cong', label: 'Phân công GD', to: '/giao-vu/phan-cong', icon: ApartmentOutlined },
        { key: 'gv-giang-vien', label: 'Giảng viên', to: '/giao-vu/giang-vien', icon: TeamOutlined },
        { key: 'gv-sv-lhp', label: 'SV - LHP', to: '/giao-vu/sinh-vien-lhp', icon: UserOutlined },
        { key: 'gv-phong-hoc', label: 'Phòng học', to: '/giao-vu/phong-hoc', icon: HomeOutlined },
        { key: 'gv-khung-tg', label: 'Khung thời gian', to: '/giao-vu/khung-thoi-gian', icon: ClockCircleOutlined },
        { key: 'gv-lich-ban', label: 'Lịch bận GV', to: '/giao-vu/lich-ban', icon: ScheduleOutlined },
        { key: 'gv-thong-bao', label: 'Thông báo', to: '/giao-vu/thong-bao', icon: BellOutlined },
        { key: 'gv-bao-cao', label: 'Báo cáo', to: '/giao-vu/bao-cao', icon: BarChartOutlined },
      ],
    },
  ],
  truong_khoa: [
    {
      section: 'HỆ THỐNG',
      items: [
        { key: 'dashboard', label: 'Trang tổng quan', to: '/dashboard', icon: AppstoreOutlined },
      ],
    },
    {
      section: 'ĐIỀU HÀNH',
      items: [
        { key: 'tk-tkb', label: 'Thời khóa biểu', to: '/truong-khoa/tkb', icon: TableOutlined },
        { key: 'tk-yeu-cau', label: 'Yêu cầu điều chỉnh', to: '/truong-khoa/yeu-cau', icon: FileTextOutlined },
        { key: 'tk-bao-cao', label: 'Báo cáo', to: '/truong-khoa/bao-cao', icon: BarChartOutlined },
      ],
    },
  ],
  giang_vien: [
    {
      section: 'TRANG CÁ NHÂN',
      items: [
        { key: 'dashboard', label: 'Trang tổng quan', to: '/dashboard', icon: AppstoreOutlined },
        { key: 'gv-tkb-ca-nhan', label: 'Thời khóa biểu', to: '/giang-vien/tkb-ca-nhan', icon: TableOutlined },
        { key: 'gv-lich-ban', label: 'Lịch bận', to: '/giang-vien/lich-ban', icon: ScheduleOutlined },
        { key: 'gv-yeu-cau', label: 'Yêu cầu điều chỉnh', to: '/giang-vien/yeu-cau', icon: FileTextOutlined },
        { key: 'gv-thong-bao', label: 'Thông báo', to: '/giang-vien/thong-bao', icon: BellOutlined },
      ],
    },
  ],
  sinh_vien: [
    {
      section: 'TRANG CÁ NHÂN',
      items: [
        { key: 'dashboard', label: 'Trang tổng quan', to: '/dashboard', icon: AppstoreOutlined },
        { key: 'sv-tkb-ca-nhan', label: 'Lịch học', to: '/sinh-vien/tkb-ca-nhan', icon: CalendarOutlined },
        { key: 'sv-thong-bao', label: 'Thông báo', to: '/sinh-vien/thong-bao', icon: BellOutlined },
      ],
    },
  ],
};

export const ROLE_LABELS = {
  admin: 'Quản trị viên',
  giao_vu: 'Giáo vụ',
  truong_khoa: 'Trưởng khoa',
  giang_vien: 'Giảng viên',
  sinh_vien: 'Sinh viên',
};

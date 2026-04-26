/**
 * App.jsx — Router + ProtectedRoute
 * Design.md mục 8: Auth Flow + mục 4: Routes
 *
 * Cấu trúc:
 *  /login                    → LoginPage (public)
 *  /                         → redirect → /dashboard hoặc /login
 *  /dashboard                → DashboardPage (protected, all roles)
 *  /giao-vu/*               → GiaoVuLayout + routes
 *  /giang-vien/*            → GiangVienLayout + routes
 *  /sinh-vien/*             → SinhVienLayout + routes
 *  /truong-khoa/*           → TruongKhoaLayout + routes
 *  /admin/*                 → AdminLayout + routes
 */
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import AppLayout from './components/layout/AppLayout';

// ── Pages ────────────────────────────────────────────────────────────────────
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';

// Giáo vụ
import GVTKBPage from './pages/giao-vu/GVTKBPage';
import GiaoVuLHPPage from './pages/giao-vu/GiaoVuLHPPage';
import GiaoVuPhongHocPage from './pages/giao-vu/GiaoVuPhongHocPage';
import GiaoVuPhanCongPage from './pages/giao-vu/GiaoVuPhanCongPage';
import GiaoVuGiangVienPage from './pages/giao-vu/GiaoVuGiangVienPage';
import GiaoVuSVLHPPage from './pages/giao-vu/GiaoVuSVLHPPage';
import GiaoVuKhungTGPage from './pages/giao-vu/GiaoVuKhungTGPage';
import GiaoVuLichBanPage from './pages/giao-vu/GiaoVuLichBanPage';
import GiaoVuThongBaoPage from './pages/giao-vu/GiaoVuThongBaoPage';
import GiaoVuBaoCaoPage from './pages/giao-vu/GiaoVuBaoCaoPage';

// Giảng viên
import GiangVienTKBPage from './pages/giang-vien/GiangVienTKBPage';
import GiangVienLichBanPage from './pages/giang-vien/GiangVienLichBanPage';
import GiangVienYeuCauPage from './pages/giang-vien/GiangVienYeuCauPage';
import GiangVienThongBaoPage from './pages/giang-vien/GiangVienThongBaoPage';

// Sinh viên
import SinhVienTKBPage from './pages/sinh-vien/SinhVienTKBPage';
import SinhVienThongBaoPage from './pages/sinh-vien/SinhVienThongBaoPage';

// Trưởng khoa
import TruongKhoaTKBPage from './pages/truong-khoa/TruongKhoaTKBPage';
import TruongKhoaYeuCauPage from './pages/truong-khoa/TruongKhoaYeuCauPage';
import TruongKhoaBaoCaoPage from './pages/truong-khoa/TruongKhoaBaoCaoPage';

// Admin
import AdminNguoiDungPage from './pages/admin/AdminNguoiDungPage';
import AdminSVLHPPage from './pages/admin/AdminSVLHPPage';
import AdminHocKyPage from './pages/admin/AdminHocKyPage';

// ── Protected Route ──────────────────────────────────────────────────────────
/**
 * ProtectedRoute — kiểm tra auth + vai trò trước khi render children
 * Design.md mục 8: redirect /login khi chưa đăng nhập
 */
const ProtectedRoute = ({ children, allowedRoles }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
        Đang tải...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.vai_tro)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#C63633' }}>
        <h3>Bạn không có quyền truy cập trang này!</h3>
        <p>Vui lòng đăng nhập với tài khoản phù hợp.</p>
      </div>
    );
  }

  return children;
};

// ── Role → default path mapping ──────────────────────────────────────────────
const ROLE_DEFAULT_PATH = {
  admin:        '/admin',
  giao_vu:      '/giao-vu',
  giang_vien:   '/giang-vien',
  sinh_vien:    '/sinh-vien',
  truong_khoa:  '/truong-khoa',
};

/** Root redirect: có user → path theo vai_tro; không → /login */
const RootRedirect = () => {
  const { user } = useAuth();
  const path = user ? (ROLE_DEFAULT_PATH[user.vai_tro] ?? '/dashboard') : '/login';
  return <Navigate to={path} replace />;
};

// ── App ──────────────────────────────────────────────────────────────────────
const App = () => {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Dashboard chung — mọi vai trò */}
      <Route element={
        <ProtectedRoute>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route path="/dashboard" element={<DashboardPage />} />
      </Route>

      {/* Giáo vụ */}
      <Route path="/giao-vu" element={
        <ProtectedRoute allowedRoles={['giao_vu', 'admin']}>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="tkb"               element={<GVTKBPage />} />
        <Route path="lop-hoc-phan"      element={<GiaoVuLHPPage />} />
        <Route path="phan-cong"         element={<GiaoVuPhanCongPage />} />
        <Route path="giang-vien"        element={<GiaoVuGiangVienPage />} />
        <Route path="sinh-vien-lhp"     element={<GiaoVuSVLHPPage />} />
        <Route path="phong-hoc"         element={<GiaoVuPhongHocPage />} />
        <Route path="khung-thoi-gian"   element={<GiaoVuKhungTGPage />} />
        <Route path="lich-ban"          element={<GiaoVuLichBanPage />} />
        <Route path="thong-bao"         element={<GiaoVuThongBaoPage />} />
        <Route path="bao-cao"           element={<GiaoVuBaoCaoPage />} />
      </Route>

      {/* Giảng viên */}
      <Route path="/giang-vien" element={
        <ProtectedRoute allowedRoles={['giang_vien']}>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="tkb-ca-nhan"      element={<GiangVienTKBPage />} />
        <Route path="lich-ban"         element={<GiangVienLichBanPage />} />
        <Route path="yeu-cau"          element={<GiangVienYeuCauPage />} />
        <Route path="thong-bao"        element={<GiangVienThongBaoPage />} />
      </Route>

      {/* Sinh viên */}
      <Route path="/sinh-vien" element={
        <ProtectedRoute allowedRoles={['sinh_vien']}>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="tkb-ca-nhan"      element={<SinhVienTKBPage />} />
        <Route path="thong-bao"        element={<SinhVienThongBaoPage />} />
      </Route>

      {/* Trưởng khoa */}
      <Route path="/truong-khoa" element={
        <ProtectedRoute allowedRoles={['truong_khoa', 'admin']}>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="tkb"             element={<TruongKhoaTKBPage />} />
        <Route path="yeu-cau"         element={<TruongKhoaYeuCauPage />} />
        <Route path="bao-cao"         element={<TruongKhoaBaoCaoPage />} />
      </Route>

      {/* Admin */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AppLayout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="nguoi-dung"      element={<AdminNguoiDungPage />} />
        <Route path="sinh-vien-lhp"   element={<AdminSVLHPPage />} />
        <Route path="hoc-ky"          element={<AdminHocKyPage />} />
      </Route>

      {/* 404 */}
      <Route path="*" element={
        <ProtectedRoute>
          <div style={{ padding: 60, textAlign: 'center' }}>
            <h2 style={{ color: '#C63633' }}>404 – Trang không tìm thấy</h2>
            <p>Trang bạn đang truy cập không tồn tại.</p>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
};

export default App;

/**
 * GiaoVuLayout.jsx
 * Sidebar 220px, header sticky #C63633, active menu highlight
 */
import React from 'react';
import { Layout, Menu, Button } from 'antd';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: 'dashboard',          label: 'Trang tổng quan',    path: '/dashboard' },
  { key: 'tkb',                label: 'Thời Khóa Biểu',      path: '/giao-vu/tkb' },
  { key: 'lop-hoc-phan',       label: 'Lớp Học Phần',       path: '/giao-vu/lop-hoc-phan' },
  { key: 'phan-cong',          label: 'Phân Công GD',        path: '/giao-vu/phan-cong' },
  { key: 'giang-vien',         label: 'Giảng Viên',          path: '/giao-vu/giang-vien' },
  { key: 'sinh-vien-lhp',      label: 'SV - LHP',            path: '/giao-vu/sinh-vien-lhp' },
  { key: 'phong-hoc',          label: 'Phòng Học',            path: '/giao-vu/phong-hoc' },
  { key: 'khung-thoi-gian',    label: 'Khung Thời Gian',     path: '/giao-vu/khung-thoi-gian' },
  { key: 'lich-ban',           label: 'Lịch Bận GV',         path: '/giao-vu/lich-ban' },
  { key: 'thong-bao',          label: 'Thông Báo',            path: '/giao-vu/thong-bao' },
  { key: 'bao-cao',            label: 'Báo Cáo',              path: '/giao-vu/bao-cao' },
];

const GiaoVuLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const selectedKey = menuItems.find(item =>
    location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  )?.key ?? 'dashboard';

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="layout-header">
        <div className="logo">
          <span className="logo-icon">đŸ“</span>
          <span>TRƯỜNG ĐẠI HỌC - KHOA CÔNG NGHỆ THÔNG TIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'white' }}>{user?.ho_ten}</span>
          <Button type="text" onClick={handleLogout} style={{ color: 'white' }}>
            Đăng xuất
          </Button>
        </div>
      </Header>

      <Layout>
        <Sider width={220} className="layout-sider">
          <Menu
            mode="inline"
            selectedKeys={[selectedKey]}
            style={{ height: '100%', borderRight: 0 }}
            items={menuItems.map(item => ({
              key: item.key,
              label: <Link to={item.path}>{item.label}</Link>,
            }))}
          />
        </Sider>

        <Layout style={{ padding: '0 24px 24px' }}>
          <Content style={{ background: '#f0f2f5', minHeight: 280 }}>
            <Outlet />
          </Content>
        </Layout>
      </Layout>
    </Layout>
  );
};

export default GiaoVuLayout;


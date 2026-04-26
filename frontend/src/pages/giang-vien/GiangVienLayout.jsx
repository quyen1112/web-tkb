/**
 * GiangVienLayout.jsx
 * Sidebar 220px, header sticky #C63633, active menu highlight
 */
import React, { useEffect, useState } from 'react';
import { Layout, Menu, Button, Badge } from 'antd';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../services/api';

const { Header, Sider, Content } = Layout;

const menuItems = [
  { key: 'dashboard',       label: 'Trang tổng quan',    path: '/dashboard' },
  { key: 'tkb-ca-nhan',     label: 'Thời Khóa Biểu',      path: '/giang-vien/tkb-ca-nhan' },
  { key: 'lich-ban',        label: 'Lịch Bận',             path: '/giang-vien/lich-ban' },
  { key: 'yeu-cau',         label: 'Yêu Cầu Điều Chỉnh',  path: '/giang-vien/yeu-cau' },
  { key: 'thong-bao',       label: 'Thông Báo',            path: '/giang-vien/thong-bao' },
];

const GiangVienLayout = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [unreadCount, setUnreadCount] = useState(0);

  const selectedKey = menuItems.find(item =>
    location.pathname === item.path || location.pathname.startsWith(item.path + '/')
  )?.key ?? 'dashboard';

  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        const res = await api.get('/giang-vien/thong-bao/unread-count');
        setUnreadCount(res.data?.unread_count || 0);
      } catch {
        setUnreadCount(0);
      }
    };

    fetchUnreadCount();
    const intervalId = window.setInterval(fetchUnreadCount, 15000);
    window.addEventListener('focus', fetchUnreadCount);
    window.addEventListener('giang-vien-thong-bao-updated', fetchUnreadCount);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', fetchUnreadCount);
      window.removeEventListener('giang-vien-thong-bao-updated', fetchUnreadCount);
    };
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Header className="layout-header">
        <div className="logo">
          <span className="logo-icon">📚</span>
          <span>TRƯỜNG ĐẠI HỌC - KHOA CÔNG NGHỆ THÔNG TIN</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: 'white' }}>{user?.ho_ten}</span>
          <Badge count={unreadCount}>
            <Button type="text" style={{ color: 'white' }}>🔔</Button>
          </Badge>
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
              label: (
                <Link to={item.path}>
                  {item.key === 'thong-bao' ? <Badge count={unreadCount}>{item.label}</Badge> : item.label}
                </Link>
              ),
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

export default GiangVienLayout;

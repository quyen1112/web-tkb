import React from 'react';
import { BellFilled, LogoutOutlined, MenuOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const Topbar = ({ onToggleSidebar }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="portal-topbar">
      <div className="portal-topbar-left">
        <button type="button" className="portal-topbar-toggle" onClick={onToggleSidebar} aria-label="Mở menu">
          <MenuOutlined />
        </button>
        <div className="portal-topbar-title">TRƯỜNG ĐẠI HỌC THĂNG LONG</div>
      </div>

      <div className="portal-topbar-actions">
        <span className="portal-topbar-lang">VN</span>
        <button type="button" className="portal-topbar-icon-btn" aria-label="Thông báo">
          <BellFilled />
        </button>
        <div className="portal-topbar-user">
          <span className="portal-topbar-user-avatar">
            <UserOutlined />
          </span>
          <span className="portal-topbar-user-name">{user?.ho_ten || 'Người dùng'}</span>
        </div>
        <button type="button" className="portal-topbar-logout" onClick={handleLogout}>
          <LogoutOutlined />
          <span>Đăng xuất</span>
        </button>
      </div>
    </header>
  );
};

export default Topbar;

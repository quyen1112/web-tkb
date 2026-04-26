import React from 'react';
import { UserOutlined } from '@ant-design/icons';
import { useAuth } from '../../context/AuthContext';
import { ROLE_LABELS } from './menuConfig';

const UserPanel = () => {
  const { user } = useAuth();

  const readableRole = ROLE_LABELS[user?.vai_tro] || user?.vai_tro || 'Người dùng';
  const identifier = user?.ma_nguoi_dung || user?.ma_sv || user?.ma_gv || user?.email || '';

  return (
    <div className="portal-user-panel">
      <div className="portal-user-avatar">
        <UserOutlined />
      </div>
      <div className="portal-user-meta">
        <div className="portal-user-name">{user?.ho_ten || 'Người dùng'}</div>
        <div className="portal-user-id">{identifier}</div>
        <div className="portal-user-role">{readableRole}</div>
      </div>
    </div>
  );
};

export default UserPanel;

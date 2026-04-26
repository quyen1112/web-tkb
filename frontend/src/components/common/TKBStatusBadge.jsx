/**
 * TKBStatusBadge.jsx — Badge trạng thái TKB có icon
 * Design.md mục 5.4: badge trạng thái TKB với icon Ant Design
 *
 * Nguồn config: TKB_STATUS_CONFIG từ formatters.js
 */
import React from 'react';
import { Tag } from 'antd';
import {
  EditOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  RocketOutlined,
} from '@ant-design/icons';
import { TKB_STATUS_CONFIG } from '../../utils/formatters';

const ICON_MAP = {
  edit:          <EditOutlined />,
  'clock-circle': <ClockCircleOutlined />,
  'check-circle': <CheckCircleOutlined />,
  rocket:        <RocketOutlined />,
};

/**
 * TKBStatusBadge — hiển thị badge trạng thái TKB với icon
 *
 * @param {string} status — trạng thái: nhap | cho_phe_duyet | da_phe_duyet | da_cong_bo
 */
const TKBStatusBadge = ({ status }) => {
  const cfg = TKB_STATUS_CONFIG[status] ?? {
    color: 'default',
    label: status,
    icon: null,
  };

  return (
    <Tag color={cfg.color} icon={ICON_MAP[cfg.icon] ?? null}>
      {cfg.label}
    </Tag>
  );
};

export default TKBStatusBadge;
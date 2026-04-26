/**
 * StatusBadge.jsx — Badge trạng thái đa năng (không phải TKB)
 *
 * Nguồn config: TRANG_THAI_YC_CONFIG từ formatters.js
 * Cho TKB status → dùng TKBStatusBadge.jsx thay vì component này.
 */
import React from 'react';
import { Tag } from 'antd';
import { TRANG_THAI_YC_CONFIG } from '../../utils/formatters';

/**
 * StatusBadge — badge trạng thái yêu cầu / chung
 *
 * @param {string} status  — trạng thái (key trong TRANG_THAI_YC_CONFIG)
 */
const StatusBadge = ({ status }) => {
  const cfg = TRANG_THAI_YC_CONFIG[status] ?? { color: 'default', label: status };
  return <Tag color={cfg.color}>{cfg.label}</Tag>;
};

export default StatusBadge;
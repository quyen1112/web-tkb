/**
 * PageHeader.jsx — Tiêu đề trang chuẩn
 * Design.md mục 11.2: shared component
 */
import React from 'react';

const PageHeader = ({ title, extra }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottom: '2px solid #C63633',
  }}>
    <h2 style={{
      margin: 0,
      fontSize: 20,
      fontWeight: 600,
      color: '#C63633',
    }}>
      {title}
    </h2>
    {extra && <div>{extra}</div>}
  </div>
);

export default PageHeader;

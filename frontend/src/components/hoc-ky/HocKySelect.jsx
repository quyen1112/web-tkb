/**
 * HocKySelect.jsx — Select học kỳ chuẩn
 * Tự động chọn học kỳ có trang_thai='hoat_dong' làm default
 * Design.md mục 11.2
 *
 * Thay đổi v2:
 *   - Thêm error state + retry khi fetch thất bại
 *   - Fix auto-select: chỉ chạy khi chưa có value hợp lệ
 */
import React, { useEffect, useState, useCallback } from 'react';
import { Select, Spin, Button, Space } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { giaoVu } from '../../api/giaoVu';

const HocKySelect = ({
  value,
  onChange,
  width        = 220,
  placeholder = 'Chọn học kỳ',
  style,
  ...rest
}) => {
  const [hocKys,  setHocKys]  = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(null);

  const fetchHocKy = useCallback(() => {
    setLoading(true);
    setError(null);
    giaoVu
      .getHocKy()
      .then(data => {
        setHocKys(data || []);
        if (!value) {
          const active = (data || []).find(hk => hk.trang_thai === 'hoat_dong');
          if (active) {
            onChange?.(active.hoc_ky_id);
          } else if ((data || []).length > 0) {
            // Fallback: chọn item đầu tiên nếu không có hoat_dong
            onChange?.(data[0].hoc_ky_id);
          }
        }
      })
      .catch(err => {
        setError(err);
        message.error('Không tải được danh sách học kỳ');
      })
      .finally(() => setLoading(false));
  }, []); // stable: không phụ thuộc value/onChange để tránh re-run loop

  useEffect(() => {
    fetchHocKy();
  }, [fetchHocKy]);

  const options = hocKys.map(hk => ({
    value: hk.hoc_ky_id,
    label: `${hk.ten_hoc_ky} – ${hk.nam_hoc}`,
  }));

  if (error) {
    return (
      <Space size={4}>
        <Select
          value={value}
          onChange={onChange}
          options={options}
          placeholder={placeholder}
          style={{ width, ...style }}
          allowClear
          disabled
          {...rest}
        />
        <Button
          icon={<ReloadOutlined />}
          onClick={fetchHocKy}
          loading={loading}
          title="Thử lại"
          size="small"
        />
      </Space>
    );
  }

  return (
    <Spin spinning={loading} size="small">
      <Select
        value={value}
        onChange={onChange}
        options={options}
        placeholder={placeholder}
        style={{ width, ...style }}
        allowClear
        {...rest}
      />
    </Spin>
  );
};

export default HocKySelect;

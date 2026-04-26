/**
 * FilterBar.jsx — Thanh lọc học kỳ + tuần navigation
 * Design.md mục 12.6: ◀ Week Range Picker ▶ Current Week
 *
 * Thay đổi v2:
 *   - Thêm prop onTKBStatusChange + tkbStatusValue cho lọc trạng thái TKB
 *   - Filter trạng thái chỉ render khi onTKBStatusChange được truyền
 */
import React from 'react';
import { Select, Button, Space } from 'antd';
import { LeftOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import HocKySelect from '../hoc-ky/HocKySelect';

/** Navigate tuần trước / sau */
const navigateWeek = (range, direction) => {
  if (!range) return null;
  const [start] = range;
  return [start.add(direction * 7, 'day'), start.add((direction + 1) * 7 - 1, 'day')];
};

/** Lấy thứ 2 của tuần hiện tại */
const getCurrentWeekStart = () => {
  const dow = dayjs().day();
  return dayjs().subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day');
};

const TKB_STATUS_OPTIONS = [
  { value: 'all',            label: 'Tất cả trạng thái' },
  { value: 'nhap',           label: 'Nháp'              },
  { value: 'cho_phe_duyet',  label: 'Chờ phê duyệt'     },
  { value: 'da_phe_duyet',   label: 'Đã phê duyệt'      },
  { value: 'da_cong_bo',     label: 'Đã công bố'        },
];

/**
 * FilterBar — bộ lọc học kỳ + điều hướng tuần
 *
 * @param {object}    props.hocKyId          — giá trị select học kỳ
 * @param {function}  props.onHocKyChange
 * @param {object[]}  props.weekRange        — [dayjs, dayjs] hoặc null
 * @param {function}  props.onWeekChange     — callback([dayjs, dayjs])
 * @param {function}  props.onTKBStatusChange — callback khi đổi trạng thái TKB (optional)
 * @param {string}    props.tkbStatusValue   — giá trị trạng thái TKB hiện chọn (optional, uncontrolled nếu không truyền)
 */
const FilterBar = ({
  hocKyId,
  onHocKyChange,
  weekRange,
  onWeekChange,
  hocKyWidth    = 220,
  showWeekNav   = true,
  onTKBStatusChange,
  tkbStatusValue = 'all',
}) => {
  const handlePrev = () => {
    if (!weekRange) return;
    const [start] = weekRange;
    onWeekChange?.([start.subtract(7, 'day'), start.subtract(1, 'day')]);
  };

  const handleNext = () => {
    if (!weekRange) return;
    const [start] = weekRange;
    onWeekChange?.([start.add(7, 'day'), start.add(13, 'day')]);
  };

  const handleCurrentWeek = () => {
    const start = getCurrentWeekStart();
    onWeekChange?.([start, start.add(6, 'day')]);
  };

  const weekLabel = weekRange
    ? `${weekRange[0].format('DD/MM/YYYY')} – ${weekRange[1].format('DD/MM/YYYY')}`
    : 'Tuần hiện tại';

  return (
    <Space wrap size={12}>
      <HocKySelect
        value={hocKyId}
        onChange={onHocKyChange}
        width={hocKyWidth}
      />

      {showWeekNav && (
        <>
          <Button
            icon={<LeftOutlined />}
            onClick={handlePrev}
            style={{ background: '#C63633', borderColor: '#C63633', color: '#fff' }}
          />
          <span style={{
            fontSize: 13,
            color: '#333',
            minWidth: 180,
            textAlign: 'center',
          }}>
            {weekLabel}
          </span>
          <Button onClick={handleCurrentWeek} style={{ borderColor: '#C63633', color: '#C63633' }}>
            Hiện tại
          </Button>
          <Button
            icon={<RightOutlined />}
            onClick={handleNext}
            style={{ background: '#C63633', borderColor: '#C63633', color: '#fff' }}
          />
        </>
      )}

      {onTKBStatusChange && (
        <Select
          value={tkbStatusValue}
          onChange={onTKBStatusChange}
          options={TKB_STATUS_OPTIONS}
          style={{ width: 160 }}
        />
      )}
    </Space>
  );
};

export default FilterBar;
export { navigateWeek, getCurrentWeekStart };

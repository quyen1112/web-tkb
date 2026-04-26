import { useMemo } from 'react';
import { Button, Empty } from 'antd';
import { PlusOutlined, SendOutlined, NotificationOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

import BuoiHocCard from './BuoiHocCard';
import { TIETS } from '../../utils/tkbGrid';

const FIELD_ALIAS = {
  ngay: ['ngay_hoc', 'ngay'],
  thu: ['thu_trong_tuan', 'thu'],
  tietBatDau: ['tiet_bat_dau', 'tiet'],
};

const THU_SHORT = { 2: 'Thứ 2', 3: 'Thứ 3', 4: 'Thứ 4', 5: 'Thứ 5', 6: 'Thứ 6', 7: 'Thứ 7', 8: 'CN' };

const STATUS_CONFIG = {
  nhap: { guiDisabled: false, congBoDisabled: true },
  cho_phe_duyet: { guiDisabled: true, congBoDisabled: true },
  da_phe_duyet: { guiDisabled: true, congBoDisabled: false },
  da_cong_bo: { guiDisabled: true, congBoDisabled: true },
};

function toThuTrongTuan(date) {
  const day = date.day();
  return day === 0 ? 8 : day + 1;
}

function pick(raw, ...aliases) {
  for (const alias of aliases) {
    if (alias && raw[alias] !== undefined && raw[alias] !== null) {
      return raw[alias];
    }
  }

  return undefined;
}

function normalizeItem(raw = {}) {
  let ngay = pick(raw, ...FIELD_ALIAS.ngay);
  if (ngay && typeof ngay === 'string') {
    ngay = dayjs(ngay);
  }

  let thu = pick(raw, ...FIELD_ALIAS.thu);
  if (thu === undefined && ngay) {
    thu = toThuTrongTuan(ngay);
  }

  return {
    id: raw.id ?? raw.buoi_hoc_id,
    ngay,
    thu,
    tietBatDau: pick(raw, ...FIELD_ALIAS.tietBatDau),
    raw,
  };
}

function buildWeekColumns(weekRange) {
  if (
    weekRange &&
    Array.isArray(weekRange) &&
    weekRange[0] &&
    weekRange[1] &&
    dayjs.isDayjs(weekRange[0]) &&
    dayjs.isDayjs(weekRange[1])
  ) {
    const [start, end] = weekRange;
    const days = [];
    let current = start.startOf('day');
    const lastDay = end.startOf('day');

    while (current.isBefore(lastDay, 'day') || current.isSame(lastDay, 'day')) {
      days.push(current);
      current = current.add(1, 'day');
    }

    return days;
  }

  const dow = dayjs().day();
  const monday = dayjs().subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day');
  return Array.from({ length: 7 }, (_, index) => monday.add(index, 'day'));
}

function isWeekInSemester(weekColumns, semesterRange) {
  if (!semesterRange?.start || !semesterRange?.end || !weekColumns.length) {
    return true;
  }

  const weekStart = weekColumns[0].startOf('day');
  const weekEnd = weekColumns[weekColumns.length - 1].startOf('day');
  const semesterStart = dayjs(String(semesterRange.start).slice(0, 10)).startOf('day');
  const semesterEnd = dayjs(String(semesterRange.end).slice(0, 10)).startOf('day');

  return !weekEnd.isBefore(semesterStart, 'day') && !weekStart.isAfter(semesterEnd, 'day');
}

function buildInternalGrid(buoiHoc, weekColumns, semesterRange) {
  const grid = {};
  TIETS.forEach((tiet) => {
    grid[tiet] = {};
  });

  if (!isWeekInSemester(weekColumns, semesterRange)) {
    return grid;
  }

  for (const raw of buoiHoc) {
    const item = normalizeItem(raw);

    if (item.thu === undefined || item.tietBatDau === undefined) {
      continue;
    }

    if (!grid[item.tietBatDau]) {
      grid[item.tietBatDau] = {};
    }

    if (!grid[item.tietBatDau][item.thu]) {
      grid[item.tietBatDau][item.thu] = [];
    }

    grid[item.tietBatDau][item.thu].push(raw);
  }

  return grid;
}

function AddCellButton({ onAdd, tiet, thu, date }) {
  if (!onAdd) {
    return null;
  }

  return (
    <button
      type="button"
      className="tkb-add-cell-btn"
      title={`Them buoi hoc thu ${thu}, tiet ${tiet}`}
      onClick={() => onAdd({ thu, tiet, date: date || null })}
    >
      <PlusOutlined />
    </button>
  );
}

export default function TKBGrid({
  buoiHoc = [],
  mode = 'view',
  weekRange = null,
  onCellClick,
  onAddCell,
  tkbStatus = 'nhap',
  onGuiPheDuyet,
  onCongBo,
  semesterRange = null,
}) {
  const isEdit = mode === 'edit';
  const weekColumns = useMemo(() => buildWeekColumns(weekRange), [weekRange]);
  const weekInSemester = useMemo(() => isWeekInSemester(weekColumns, semesterRange), [semesterRange, weekColumns]);
  const grid = useMemo(() => buildInternalGrid(buoiHoc, weekColumns, semesterRange), [buoiHoc, semesterRange, weekColumns]);

  const colHeaders = useMemo(
    () =>
      weekColumns.map((date) => {
        return { date, thu: toThuTrongTuan(date) };
      }),
    [weekColumns]
  );

  const statusCfg = STATUS_CONFIG[tkbStatus] ?? STATUS_CONFIG.nhap;

  return (
    <div className="tkb-feature-root">
      {isEdit && (onGuiPheDuyet || onCongBo) && (
        <div className="tkb-action-bar">
          {onGuiPheDuyet && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={statusCfg.guiDisabled}
              onClick={onGuiPheDuyet}
            >
              Gui duyet
            </Button>
          )}
          {onCongBo && (
            <Button
              icon={<NotificationOutlined />}
              disabled={statusCfg.congBoDisabled}
              onClick={onCongBo}
            >
              Cong bo
            </Button>
          )}
        </div>
      )}

      <div className="tkb-scroll-wrapper">
        <table className="tkb-feature-grid">
          <thead>
            <tr>
              <th className="tkb-feat-header-corner">Tiết</th>
              {colHeaders.map((col) => (
                <th key={col.date.format('YYYY-MM-DD')} className="tkb-feat-header-cell">
                  <div className="tkb-feat-thu">{THU_SHORT[col.thu] ?? `Thu ${col.thu}`}</div>
                  <div className="tkb-feat-date">{col.date.format('DD/MM')}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {TIETS.map((tiet) => (
              <tr key={tiet}>
                <td className="tkb-feat-row-label">
                  <strong>{tiet}</strong>
                </td>
                {colHeaders.map((col) => {
                  const cellItems = grid[tiet]?.[col.thu] ?? [];
                  const cellKey = `${tiet}-${col.date.format('YYYY-MM-DD')}`;

                  return (
                    <td
                      key={cellKey}
                      className={`tkb-feat-cell${cellItems.length === 0 ? ' tkb-feat-cell--empty' : ''}`}
                    >
                      {cellItems.length > 0 ? (
                        <div className="tkb-feat-cards">
                          {cellItems.map((item, index) => (
                            <BuoiHocCard
                              key={item.buoi_hoc_id ?? item.id ?? `${cellKey}-${index}`}
                              item={item}
                              mode={mode}
                              onClick={onCellClick}
                            />
                          ))}
                        </div>
                      ) : (
                        <AddCellButton onAdd={isEdit ? onAddCell : null} tiet={tiet} thu={col.thu} date={col.date} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(!weekInSemester || !buoiHoc || buoiHoc.length === 0) && (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <Empty description={weekInSemester ? 'Khong co buoi hoc nao trong tuan nay' : 'Tuan nay nam ngoai pham vi hoc ky'} />
        </div>
      )}
    </div>
  );
}

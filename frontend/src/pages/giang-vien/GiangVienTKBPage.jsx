import { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Empty, Select, Spin, Table, Tabs, message } from 'antd';
import { LeftOutlined, ReloadOutlined, RightOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery } from '@tanstack/react-query';

import api from '../../services/api';
import TKBGrid from '../../features/tkb/TKBGrid';
import { useTKB } from '../../features/tkb/useTKB';
import { fmtDate, getCurrentWeek } from '../../utils/dateUtils';
import { THU_LABELS } from '../../utils/tkbGrid';

const { RangePicker } = DatePicker;

const GiangVienTKBPage = () => {
  const [selectedHK, setSelectedHK] = useState(null);
  const [weekRange, setWeekRange] = useState(null);

  const hocKyQuery = useQuery({
    queryKey: ['giang-vien', 'hoc-ky'],
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const response = await api.get('/giang-vien/hoc-ky');
      return response.data || [];
    },
  });

  const tkbQuery = useTKB('giang_vien', selectedHK);

  useEffect(() => {
    const hocKys = Array.isArray(hocKyQuery.data) ? hocKyQuery.data : [];
    if (!selectedHK && hocKys.length > 0) {
      const activeHK = hocKys.find((hk) => hk.trang_thai === 'hoat_dong') || hocKys[0];
      setSelectedHK(activeHK?.hoc_ky_id || null);
    }
  }, [hocKyQuery.data, selectedHK]);

  useEffect(() => {
    if (!weekRange) {
      setWeekRange(getCurrentWeek());
    }
  }, [weekRange]);

  useEffect(() => {
    if (hocKyQuery.error) {
      message.error('Lỗi tải học kỳ.');
    }
  }, [hocKyQuery.error]);

  useEffect(() => {
    if (tkbQuery.error && selectedHK) {
      message.error('Lỗi tải TKB.');
    }
  }, [selectedHK, tkbQuery.error]);

  const data = Array.isArray(tkbQuery.data) ? tkbQuery.data : [];
  const hocKyList = Array.isArray(hocKyQuery.data) ? hocKyQuery.data : [];
  const selectedHocKy = hocKyList.find((hk) => hk.hoc_ky_id === selectedHK) || null;

  const navigateWeek = (direction) => {
    if (!weekRange) {
      return;
    }

    const [start] = weekRange;
    const nextStart = start.add(direction * 7, 'day');
    setWeekRange([nextStart, nextStart.add(6, 'day')]);
  };

  const goToCurrentWeek = () => {
    setWeekRange(getCurrentWeek());
  };

  const gridData = useMemo(
    () =>
      data.map((slot) => ({
        ...slot,
        phong_hoc: slot.ten_phong,
        lop_hoc_phan: slot.ma_lop_hp,
        ma_mon: slot.ma_mon,
      })),
    [data]
  );

  const columns = [
    { title: 'Mã LHP', dataIndex: 'ma_lop_hp', key: 'ma_lop_hp' },
    { title: 'Môn học', dataIndex: 'ten_mon', key: 'ten_mon' },
    { title: 'Phòng', dataIndex: 'ten_phong', key: 'ten_phong', render: (value) => value || 'Chưa xếp' },
    {
      title: 'Thứ',
      dataIndex: 'thu_trong_tuan',
      key: 'thu_trong_tuan',
      render: (value) => THU_LABELS[value] || value || '-',
    },
    {
      title: 'Tiết',
      key: 'tiet',
      render: (_, record) => `${record.tiet_bat_dau}-${record.tiet_ket_thuc}`,
    },
    {
      title: 'Giờ',
      key: 'gio',
      render: (_, record) => `${record.gio_bat_dau?.slice(0, 5) || '--:--'} - ${record.gio_ket_thuc?.slice(0, 5) || '--:--'}`,
    },
    {
      title: 'Áp dụng tuần',
      key: 'week',
      render: () => (weekRange ? `${fmtDate(weekRange[0])} - ${fmtDate(weekRange[1])}` : '-'),
    },
  ];

  const showHocKyEmpty = !hocKyQuery.isLoading && !hocKyQuery.error && hocKyList.length === 0;
  const showTkbEmpty = !!selectedHK && !tkbQuery.isLoading && !tkbQuery.isFetching && data.length === 0;

  return (
    <div className="tkb-page">
      <h2 className="page-title">THỜI KHÓA BIỂU CÁ NHÂN</h2>

      <Card>
        <div className="tkb-toolbar">
          <Select
            value={selectedHK}
            onChange={setSelectedHK}
            style={{ width: 220 }}
            loading={hocKyQuery.isLoading}
            options={hocKyList.map((hk) => ({
              value: hk.hoc_ky_id,
              label: `${hk.ten_hoc_ky} - ${hk.nam_hoc}`,
            }))}
          />

          <Button icon={<ReloadOutlined />} onClick={() => tkbQuery.refetch()} loading={tkbQuery.isFetching}>
            Tải lại
          </Button>
        </div>

        {hocKyQuery.error ? (
          <div style={{ padding: '32px 0' }}>
            <Empty description="Không thể tải danh sách học kỳ." />
          </div>
        ) : showHocKyEmpty ? (
          <div style={{ padding: '32px 0' }}>
            <Empty description="Không có học kỳ nào để hiển thị." />
          </div>
        ) : !selectedHK && !hocKyQuery.isLoading ? (
          <div style={{ padding: '32px 0' }}>
            <Empty description="Chưa chọn học kỳ." />
          </div>
        ) : tkbQuery.error && selectedHK ? (
          <div style={{ padding: '32px 0' }}>
            <Empty description="Không thể tải thời khóa biểu cho học kỳ này." />
          </div>
        ) : (
          <Tabs
            items={[
              {
                key: 'grid',
                label: 'TKB LƯỚI',
                children: (
                  <>
                    <div className="tkb-filter-bar">
                      <Button type="primary" className="tkb-filter-nav" icon={<LeftOutlined />} onClick={() => navigateWeek(-1)} />
                      <RangePicker
                        value={weekRange}
                        onChange={(dates) => {
                          if (dates) {
                            setWeekRange(dates);
                          }
                        }}
                        format="DD/MM/YYYY"
                      />
                      <Button className="tkb-filter-current" onClick={goToCurrentWeek}>
                        Hiện tại
                      </Button>
                      <Button type="primary" className="tkb-filter-nav" icon={<RightOutlined />} onClick={() => navigateWeek(1)} />
                    </div>

                    <Spin spinning={tkbQuery.isLoading || tkbQuery.isFetching}>
                      <TKBGrid
                        buoiHoc={gridData}
                        mode="view"
                        weekRange={weekRange}
                        semesterRange={selectedHocKy ? { start: selectedHocKy.ngay_bat_dau, end: selectedHocKy.ngay_ket_thuc } : null}
                      />
                      {showTkbEmpty && (
                        <div style={{ paddingTop: 16 }}>
                          <Empty description="Học kỳ này chưa có dữ liệu TKB." />
                        </div>
                      )}
                    </Spin>
                  </>
                ),
              },
              {
                key: 'list',
                label: 'DANH SÁCH SLOT',
                children: (
                  <Table
                    dataSource={data}
                    rowKey={(record) => record.tkb_slot_id ?? record.buoi_hoc_id}
                    columns={columns}
                    loading={tkbQuery.isLoading || tkbQuery.isFetching}
                    pagination={{ pageSize: 10 }}
                  />
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
};

export default GiangVienTKBPage;

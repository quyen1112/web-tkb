import { useEffect, useMemo, useState } from 'react';
import { Button, Card, DatePicker, Empty, Select, Spin, Tag, message } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  LeftOutlined,
  ReloadOutlined,
  RightOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import api from '../../services/api';
import TKBStatusBadge from '../../components/common/TKBStatusBadge';
import TKBGrid from '../../features/tkb/TKBGrid';
import { useTKB } from '../../features/tkb/useTKB';

const { RangePicker } = DatePicker;

const normalizeResponse = (payload, hocKyId) => {
  if (Array.isArray(payload)) {
    return {
      tkb: payload[0]
        ? {
            tkb_id: payload[0].tkb_id,
            hoc_ky_id: hocKyId,
            trang_thai: payload[0].tkb_trang_thai || null,
            ghi_chu: null,
          }
        : null,
      slots: payload,
    };
  }

  return {
    tkb: payload?.tkb || null,
    slots: Array.isArray(payload?.slots)
      ? payload.slots
      : Array.isArray(payload?.buoi_hoc)
        ? payload.buoi_hoc
        : [],
  };
};

const TruongKhoaTKBPage = () => {
  const [selectedHK, setSelectedHK] = useState(null);
  const [weekRange, setWeekRange] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);
  const queryClient = useQueryClient();

  const hocKyQuery = useQuery({
    queryKey: ['truong-khoa', 'hoc-ky'],
    staleTime: 5 * 60 * 1000,
    retry: 1,
    queryFn: async () => {
      const response = await api.get('/truong-khoa/hoc-ky');
      return response.data || [];
    },
  });

  const tkbQuery = useTKB('truong_khoa', selectedHK, { includeMeta: true });

  useEffect(() => {
    const hocKys = hocKyQuery.data || [];
    if (!selectedHK && hocKys.length > 0) {
      const activeHK = hocKys.find((hk) => hk.trang_thai === 'hoat_dong') || hocKys[0];
      setSelectedHK(activeHK?.hoc_ky_id || null);
    }
  }, [hocKyQuery.data, selectedHK]);

  useEffect(() => {
    if (!weekRange) {
      const dow = dayjs().day();
      const startOfWeek = dayjs().subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day');
      setWeekRange([startOfWeek, startOfWeek.add(6, 'day')]);
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

  const normalized = useMemo(
    () => normalizeResponse(tkbQuery.data, selectedHK),
    [selectedHK, tkbQuery.data]
  );

  const tkbMeta = normalized.tkb;
  const data = Array.isArray(normalized.slots) ? normalized.slots : [];
  const hocKyList = Array.isArray(hocKyQuery.data) ? hocKyQuery.data : [];
  const selectedHocKy = hocKyList.find((hk) => hk.hoc_ky_id === selectedHK) || null;
  const showHocKyEmpty = !hocKyQuery.isLoading && !hocKyQuery.error && hocKyList.length === 0;
  const showTkbEmpty = !!selectedHK && !tkbQuery.isLoading && !tkbQuery.isFetching && data.length === 0;

  const handlePheDuyet = async () => {
    if (!tkbMeta?.tkb_id) {
      return;
    }

    try {
      setActionLoading(true);
      await api.put(`/truong-khoa/phe-duyet-tkb/${tkbMeta.tkb_id}`);
      message.success('Phê duyệt TKB thành công.');
      await queryClient.invalidateQueries({ queryKey: ['tkb'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await tkbQuery.refetch();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi phê duyệt TKB.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleTuChoi = async () => {
    if (!tkbMeta?.tkb_id) {
      return;
    }

    try {
      setActionLoading(true);
      await api.put(`/truong-khoa/tu-choi-tkb/${tkbMeta.tkb_id}`);
      message.success('Đã từ chối TKB.');
      await queryClient.invalidateQueries({ queryKey: ['tkb'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      await tkbQuery.refetch();
    } catch (err) {
      message.error(err.response?.data?.error || 'Lỗi từ chối TKB.');
    } finally {
      setActionLoading(false);
    }
  };

  const navigateWeek = (direction) => {
    if (!weekRange) {
      return;
    }

    const [start] = weekRange;
    const newStart = start.add(direction * 7, 'day');
    setWeekRange([newStart, newStart.add(6, 'day')]);
  };

  const goToCurrentWeek = () => {
    const dow = dayjs().day();
    const startOfWeek = dayjs().subtract(dow === 0 ? 6 : dow - 1, 'day').startOf('day');
    setWeekRange([startOfWeek, startOfWeek.add(6, 'day')]);
  };

  const gridData = data.map((buoiHoc) => ({
    ...buoiHoc,
    phong_hoc: buoiHoc.ten_phong,
    giang_vien: buoiHoc.ten_gv,
    lop_hoc_phan: buoiHoc.ma_lop_hp,
    ma_mon: buoiHoc.ma_mon,
  }));

  const canReview = tkbMeta?.trang_thai === 'cho_phe_duyet';

  return (
    <div className="tkb-page">
      <h2 className="page-title">THỜI KHÓA BIỂU TOÀN KHOA</h2>

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

          <Button
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handlePheDuyet}
            disabled={!canReview}
            loading={actionLoading}
          >
            Phê duyệt
          </Button>

          <Button
            danger
            icon={<CloseCircleOutlined />}
            onClick={handleTuChoi}
            disabled={!canReview}
            loading={actionLoading}
          >
            Từ chối
          </Button>

          {tkbMeta ? <TKBStatusBadge status={tkbMeta.trang_thai} /> : <Tag>Chưa có TKB</Tag>}
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
          <Spin spinning={tkbQuery.isLoading || tkbQuery.isFetching}>
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
        )}
      </Card>
    </div>
  );
};

export default TruongKhoaTKBPage;

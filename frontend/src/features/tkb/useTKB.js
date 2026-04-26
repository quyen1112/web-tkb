import { useQuery } from '@tanstack/react-query';
import api from '../../services/api';

const ROLE_CONFIG = {
  sinh_vien: {
    key: 'sinh-vien',
    path: '/sinh-vien/tkb-ca-nhan',
  },
  giang_vien: {
    key: 'giang-vien',
    path: '/giang-vien/tkb-ca-nhan',
  },
  giao_vu: {
    key: 'giao-vu',
    path: '/giao-vu/thoi-khoa-bieu',
  },
  truong_khoa: {
    key: 'truong-khoa',
    path: '/truong-khoa/thoi-khoa-bieu',
  },
};

export function useTKB(role, hocKyId, options = {}) {
  const config = ROLE_CONFIG[role];
  const { includeMeta = false } = options;

  return useQuery({
    queryKey: ['tkb', config?.key || 'unknown', hocKyId, includeMeta ? 'meta' : 'list'],
    enabled: !!config && !!hocKyId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!config) {
        throw new Error(`useTKB: invalid role "${role}"`);
      }

      const response = await api.get(config.path, {
        params: {
          hoc_ky_id: hocKyId,
          ...(includeMeta ? { include_meta: 1 } : {}),
        },
      });

      return response.data;
    },
  });
}

export default useTKB;

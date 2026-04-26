/**
 * services/api.js — Re-exports từ src/api/client.js
 *
 * Lý do: Phase 1 tạo src/api/client.js là axios instance chuẩn hóa.
 * File này giữ lại để các page có sẵn import từ '../services/api'
 * hoặc '../../services/api' vẫn hoạt động (backward compat).
 *
 * IMPORTANT: Client mới KHÔNG tạo axios instance riêng.
 * Tất cả logic mới → src/api/*.js
 */
import client from '../api/client';

export default client;

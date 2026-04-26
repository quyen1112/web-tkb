/**
 * API Client — axios instance
 * Chuẩn hóa: baseURL, interceptors, 401 handler
 * File này là nguồn duy nhất của axios instance.
 */
import axios from 'axios';

const apiBaseURL = import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' },
});

// Gắn token vào mọi request
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Xử lý lỗi global
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Skip redirect cho endpoint đăng nhập — để component xử lý message error
    if (error.config?.url?.includes('/auth/login')) {
      return Promise.reject(error);
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;

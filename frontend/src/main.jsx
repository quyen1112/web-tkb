import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import App from './App';
import { AuthProvider } from './context/AuthContext';
import './index.css';

dayjs.locale('vi');

// React Query client — shared across the app
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      // 5 phút stale time (design.md mục 11.4)
      staleTime: 5 * 60 * 1000,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <ConfigProvider locale={viVN}>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ConfigProvider>
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);

import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import './AppLayout.css';

const AppLayout = () => {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const toggleSidebar = () => {
    setMobileSidebarOpen((prev) => !prev);
  };

  const closeSidebar = () => {
    setMobileSidebarOpen(false);
  };

  return (
    <div className="portal-shell">
      <div className="portal-shell__sidebar">
        <Sidebar mobileOpen={mobileSidebarOpen} onNavigate={closeSidebar} />
      </div>

      <div className="portal-shell__main">
        <Topbar onToggleSidebar={toggleSidebar} />
        <main className="portal-shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AppLayout;

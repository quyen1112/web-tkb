import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import logoImg from '../../assets/images/TLU.png';
import UserPanel from './UserPanel';
import { MENU_BY_ROLE } from './menuConfig';

const Sidebar = ({ collapsed = false, mobileOpen = false, onNavigate }) => {
  const { user } = useAuth();
  const sections = MENU_BY_ROLE[user?.vai_tro] || [];

  return (
    <aside className={`portal-sidebar ${collapsed ? 'is-collapsed' : ''} ${mobileOpen ? 'is-open' : ''}`}>
      <div className="portal-sidebar-header">
        <img src={logoImg} alt="TLU logo" className="portal-sidebar-logo" />
        {!collapsed && (
          <div className="portal-sidebar-brand">
            <div className="portal-sidebar-brand-top">Thang Long</div>
            <div className="portal-sidebar-brand-bottom">University</div>
          </div>
        )}
      </div>

      {!collapsed && <UserPanel />}

      <nav className="portal-sidebar-nav">
        {sections.map((section) => (
          <div className="portal-menu-section" key={section.section}>
            {!collapsed && <div className="portal-menu-section-title">{section.section}</div>}
            <div className="portal-menu-items">
              {section.items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.key}
                    to={item.to}
                    className={({ isActive }) => `portal-menu-link${isActive ? ' is-active' : ''}`}
                    onClick={onNavigate}
                    title={item.label}
                  >
                    <span className="portal-menu-icon">{Icon ? <Icon /> : null}</span>
                    {!collapsed && <span className="portal-menu-label">{item.label}</span>}
                  </NavLink>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
};

export default Sidebar;

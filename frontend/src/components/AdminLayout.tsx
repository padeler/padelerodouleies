import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Header } from './Header';
import { AdminSidebar } from './AdminSidebar';
import { useIsMobile } from '../hooks/useIsMobile';
import './AdminLayout.css';

export function AdminLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="admin-shell">
      <div className={`admin-sidebar-wrap ${isMobile ? 'mobile' : ''} ${sidebarOpen ? 'open' : ''}`}>
        <AdminSidebar onClose={isMobile ? closeSidebar : undefined} />
      </div>
      {isMobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={closeSidebar} />
      )}
      <div className="admin-main">
        <Header onToggleSidebar={isMobile ? toggleSidebar : undefined} />
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Header } from '../components/Header';
import { KidSidebar } from '../components/KidSidebar';
import { DashboardChores } from './dashboard/DashboardChores';
import { Marketplace } from './dashboard/Marketplace';
import { KidHistory } from './dashboard/KidHistory';
import { Leaderboard } from './dashboard/Leaderboard';
import { useRealtime } from '../hooks/useRealtime';
import { useIsMobile } from '../hooks/useIsMobile';
import { getPendingStars } from '../api/client';
import { useAuthStore } from '../state/authStore';
import './KidDashboard.css';

export function KidDashboard() {
  useRealtime();

  const { data: pendingData } = useQuery({
    queryKey: ['pending-stars'],
    queryFn: getPendingStars,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (pendingData == null) return;
    const current = useAuthStore.getState().user;
    if (current && current.pending_stars !== pendingData.pending_stars) {
      useAuthStore.setState({ user: { ...current, pending_stars: pendingData.pending_stars } });
    }
  }, [pendingData]);
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="kid-shell">
      <div className={`kid-sidebar-wrap ${isMobile ? 'mobile' : ''} ${sidebarOpen ? 'open' : ''}`}>
        <KidSidebar onClose={isMobile ? closeSidebar : undefined} />
      </div>
      {isMobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={closeSidebar} />
      )}
      <div className="kid-main">
        <Header onToggleSidebar={isMobile ? toggleSidebar : undefined} />
        <main className="kid-content">
          <Routes>
            <Route path="/" element={<DashboardChores />} />
            <Route path="chores" element={<DashboardChores />} />
            <Route path="marketplace" element={<Marketplace />} />
            <Route path="history" element={<KidHistory />} />
            <Route path="leaderboard" element={<Leaderboard />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

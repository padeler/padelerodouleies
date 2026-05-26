import { Routes, Route } from 'react-router-dom';
import { Header } from '../components/Header';
import { KidSidebar } from '../components/KidSidebar';
import { DashboardChores } from './dashboard/DashboardChores';
import { Marketplace } from './dashboard/Marketplace';
import { KidHistory } from './dashboard/KidHistory';
import { Leaderboard } from './dashboard/Leaderboard';
import { useRealtime } from '../hooks/useRealtime';
import './KidDashboard.css';

export function KidDashboard() {
  useRealtime();

  return (
    <div className="kid-shell">
      <KidSidebar />
      <div className="kid-main">
        <Header />
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

import { Routes, Route } from 'react-router-dom';
import { Header } from '../components/Header';

function DashboardPlaceholder() {
  return <div className="dashboard-placeholder">Kid dashboard — coming soon</div>;
}

export function KidDashboard() {
  return (
    <div className="dashboard-layout">
      <Header />
      <Routes>
        <Route path="/*" element={<DashboardPlaceholder />} />
      </Routes>
    </div>
  );
}

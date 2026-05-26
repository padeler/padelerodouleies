import { Routes, Route } from 'react-router-dom';
import { Header } from '../components/Header';

function AdminPlaceholder() {
  return <div className="admin-placeholder">Admin panel — coming soon</div>;
}

export function AdminPanel() {
  return (
    <div className="admin-layout">
      <Header />
      <Routes>
        <Route path="/*" element={<AdminPlaceholder />} />
      </Routes>
    </div>
  );
}

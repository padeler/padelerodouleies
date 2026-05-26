import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Setup } from './pages/Setup';
import { AdminPanel } from './pages/AdminPanel';
import { KidDashboard } from './pages/KidDashboard';
import { getMe } from './api/client';
import { useAuth } from './hooks/useAuth';
import './App.css';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, setUser } = useAuth();
  const loading = user === null;

  if (loading) {
    useEffect(() => {
      getMe()
        .then((u) => {
          setUser({ ...u, role: u.role as 'admin' | 'user' });
        })
        .catch(() => {
          // Not authenticated — stay on landing
        });
    }, [setUser]);
    return <div className="loading">Loading…</div>;
  }

  return children;
}

function ProtectedRoute({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/setup" element={<Setup />} />
          <Route
            path="/admin/*"
            element={
              <ProtectedRoute admin>
                <AdminPanel />
              </ProtectedRoute>
            }
          />
          <Route
            path="/dashboard/*"
            element={
              <ProtectedRoute>
                <KidDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthGuard>
    </BrowserRouter>
  );
}

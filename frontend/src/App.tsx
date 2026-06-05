import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Landing } from './pages/Landing';
import { Setup } from './pages/Setup';
import { AdminPanel } from './pages/AdminPanel';
import { KidDashboard } from './pages/KidDashboard';
import { getMe } from './api/client';
import { useAuth } from './hooks/useAuth';
import { IdleWatcher } from './components/IdleWatcher';
import './App.css';

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { setUser } = useAuth();
  const [checking, setChecking] = useState(true);

  // Validate the session once on mount. Re-running this on every navigation
  // fired a redundant network request and flashed the full-page loading
  // spinner on each tab switch — noticeably sluggish on older tablets. The
  // login/logout flows keep the auth store in sync directly.
  useEffect(() => {
    console.log('[AuthGuard] checking session...');
    getMe()
      .then((u) => {
        console.log('[AuthGuard] session valid, user:', u.name, 'role:', u.role);
        setUser({ ...u, role: u.role as 'admin' | 'user' });
      })
      .catch((err) => {
        console.log('[AuthGuard] session invalid:', err);
        setUser(null);
      })
      .finally(() => {
        setChecking(false);
      });
  }, [setUser]);

  if (checking) {
    return <div className="loading">Loading…</div>;
  }

  return children;
}

function ProtectedRoute({ children, admin }: { children: React.ReactNode; admin?: boolean }) {
  const { user } = useAuth();
  console.log('[ProtectedRoute] user:', user?.name, 'admin:', !!admin);
  if (!user) return <Navigate to="/" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (user) return <Navigate to={user.role === 'admin' ? '/admin' : '/dashboard'} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthGuard>
        <IdleWatcher />
        <Routes>
          <Route path="/" element={<PublicRoute><Landing /></PublicRoute>} />
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

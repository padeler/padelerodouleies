import { Routes, Route } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { ApprovalsPage } from './admin/ApprovalsPage';
import { ChoresPage } from './admin/ChoresPage';
import { RewardsPage } from './admin/RewardsPage';
import { UsersPage } from './admin/UsersPage';
import { FulfillmentPage } from './admin/FulfillmentPage';
import { ActivityPage } from './admin/ActivityPage';
import { Stats } from './dashboard/Stats';

export function AdminPanel() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<ApprovalsPage />} />
        <Route path="approvals" element={<ApprovalsPage />} />
        <Route path="chores" element={<ChoresPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="fulfillment" element={<FulfillmentPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="stats" element={<Stats />} />
      </Route>
    </Routes>
  );
}

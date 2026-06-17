import { Routes, Route } from 'react-router-dom';
import { AdminLayout } from '../components/AdminLayout';
import { ApprovalsPage } from './admin/ApprovalsPage';
import { ChoresPage } from './admin/ChoresPage';
import { RewardsPage } from './admin/RewardsPage';
import { UsersPage } from './admin/UsersPage';
import { FulfillmentPage } from './admin/FulfillmentPage';
import { ActivityPage } from './admin/ActivityPage';
import { Stats } from './dashboard/Stats';
import { GamesHub } from './dashboard/games/GamesHub';
import { MemoryMatch } from './dashboard/games/MemoryMatch';
import { Simon } from './dashboard/games/Simon';
import { StarCatcher } from './dashboard/games/StarCatcher';
import { Snake } from './dashboard/games/Snake';
import { WhackAMole } from './dashboard/games/WhackAMole';
import { ExercisesHub } from './dashboard/exercises/ExercisesHub';
import { BundleList } from './dashboard/exercises/BundleList';
import { BundlePlayer } from './dashboard/exercises/BundlePlayer';

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
        <Route path="games" element={<GamesHub />} />
        <Route path="games/memory" element={<MemoryMatch />} />
        <Route path="games/simon" element={<Simon />} />
        <Route path="games/catcher" element={<StarCatcher />} />
        <Route path="games/snake" element={<Snake />} />
        <Route path="games/whack" element={<WhackAMole />} />
        <Route path="exercises" element={<ExercisesHub />} />
        <Route path="exercises/:subject" element={<BundleList />} />
        <Route path="exercises/:subject/:bundleId" element={<BundlePlayer />} />
      </Route>
    </Routes>
  );
}

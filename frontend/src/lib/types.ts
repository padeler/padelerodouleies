/** Shared entity types for admin API responses. */

export interface Chore {
  id: number;
  title: string;
  description: string | null;
  icon_name: string;
  claim_mode: 'each' | 'one';
  points_value: number;
  is_repeating: boolean;
  start_time: string | null;
  window_hours: number | null;
  is_active: boolean;
  repeat_days: string[] | null;
  n_day_interval: number | null;
  created_at: string;
}

export interface Reward {
  id: number;
  title: string;
  description: string | null;
  icon_name: string;
  cost_stars: number;
  is_collaborative: boolean;
  is_enabled: boolean;
  created_at: string;
}

export interface AdminUser {
  id: number;
  name: string;
  avatar_kind: 'icon' | 'image';
  avatar_value: string;
  role: 'admin' | 'user';
  current_stars: number;
  preferred_locale: string;
  is_active: boolean;
}

export interface PendingClaim {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar_kind: 'icon' | 'image';
  user_avatar_value: string;
  chore_id: number;
  chore_icon: string;
  chore_title: string;
  points_value: number;
  claimed_at: string;
}

export interface FulfillmentEntry {
  id: number;
  reward_id: number;
  reward_title: string;
  reward_icon: string;
  user_id: number;
  user_name: string;
  status: 'claimed' | 'fulfilled';
  claimed_at: string;
  fulfilled_at: string | null;
  stars_contributed: number;
}

export interface HistoryEntry {
  id: number;
  user_id: number;
  user_name: string;
  user_avatar_kind: 'icon' | 'image';
  user_avatar_value: string;
  action_type: string;
  action_label: string | null;
  points_delta: number;
  ref_table: string | null;
  ref_id: number | null;
  item_title?: string;
  item_icon?: string;
  admin_note: string | null;
  actor_name: string | null;
  actor_avatar_kind: 'icon' | 'image' | null;
  actor_avatar_value: string | null;
  timestamp: string;
}

export interface IconCatalogItem {
  name: string;
  category: string;
  svg_ref: string;
  keywords_en: string[];
  keywords_el: string[];
}

export type AvatarSelection = { kind: 'icon' | 'image'; value: string };

export interface ChoreClaimedBy {
  user_id: number;
  name: string;
  avatar_kind: 'icon' | 'image';
  avatar_value: string;
}

export interface VisibleChore {
  id: number;
  title: string;
  description: string | null;
  icon_name: string;
  claim_mode: 'each' | 'one';
  points_value: number;
  status: 'available' | 'pending' | 'approved';
  claimed_by: ChoreClaimedBy | null;
  /** ISO timestamp when the chore becomes claimable again; null while available. */
  available_again_at: string | null;
}

export interface KidHistoryEntry {
  id: number;
  action_type: string;
  points_delta: number;
  ref_table: string | null;
  ref_id: number | null;
  admin_note: string | null;
  timestamp: string;
  chore_title?: string;
  chore_icon?: string;
  chore_points_value?: number;
  item_title?: string;
  item_icon?: string;
}

export interface MarketplaceReward {
  id: number;
  title: string;
  description: string | null;
  icon_name: string;
  cost_stars: number;
  is_collaborative: boolean;
  current_stars?: number;
  target_stars?: number;
  contributors?: Array<{ user_id: number; user_name: string; stars: number }>;
  /** ISO timestamp when an individual reward becomes redeemable again; null while available today. */
  available_again_at?: string | null;
}

export interface LeaderboardEntry {
  ranking: number;
  id: number;
  name: string;
  avatar_kind: string;
  avatar_value: string;
  current_stars: number;
}

export interface StatKid {
  id: number;
  name: string;
  avatar_kind: string;
  avatar_value: string;
}

export interface StatsWindow {
  earned_per_weekday: { weekday: number; stars: number }[];
  total_stars_earned: number;
  total_chores: number;
  total_awards: number;
  top_earner: (StatKid & { stars: number }) | null;
  top_chorer: (StatKid & { count: number }) | null;
  top_buyer: (StatKid & { count: number }) | null;
}

export interface StatsPerKid extends StatKid {
  current_stars: number;
  total_earned: number;
  total_spent: number;
  best_day: { date: string; stars: number } | null;
  best_week: { week_start: string; stars: number } | null;
  // Best score per Games-tab game key (e.g. "memory.easy", "simon", "catcher").
  game_scores: Record<string, number>;
}

// Whole-family game scoreboard (kids + parents who have played).
export interface StatGamePlayer extends StatKid {
  game_scores: Record<string, number>;
}

export interface StatsResponse {
  window_week: StatsWindow;
  window_all: StatsWindow;
  per_kid: StatsPerKid[];
  game_players: StatGamePlayer[];
}

export type WSEvent =
  | { event: 'stars_changed'; user_id: number; current_stars: number }
  | { event: 'pending_stars_changed'; user_id: number; pending_stars: number }
  | { event: 'pending_claims_changed'; count: number }
  | { event: 'visible_chores_changed'; user_id: number }
  | { event: 'collab_progress_changed'; reward_id: number; current: number; target: number; contributions: Array<{ user_id: number; user_name: string; stars: number }> }
  | { event: 'fulfillment_queue_changed' }
  | { event: 'history_changed'; user_id: number }
  | { event: 'chores_changed' };

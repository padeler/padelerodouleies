/** Shared entity types for admin API responses. */

export interface Chore {
  id: number;
  title_el: string;
  title_en: string;
  description_el: string | null;
  description_en: string | null;
  icon_name: string;
  scope: 'individual' | 'pooled';
  points_value: number;
  is_repeating: boolean;
  start_time: string | null;
  window_hours: number | null;
  is_active: boolean;
  created_at: string;
}

export interface Reward {
  id: number;
  title_el: string;
  title_en: string;
  description_el: string | null;
  description_en: string | null;
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
  chore_title_el: string;
  chore_title_en: string;
  points_value: number;
  claimed_at: string;
}

export interface FulfillmentEntry {
  id: number;
  reward_id: number;
  reward_title_el: string;
  reward_title_en: string;
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
  action_type: string;
  points_delta: number;
  ref_table: string | null;
  ref_id: number | null;
  admin_note: string | null;
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
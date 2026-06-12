import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { Stats } from './Stats';
import { useI18nStore } from '../../i18n/store';
import type { StatsResponse } from '../../lib/types';

const server = setupServer();

const TRANSLATIONS: Record<string, Record<string, string>> = {
  'common.loading': { el: 'Φόρτωση…', en: 'Loading…' },
  'stats.title': { el: 'Στατιστικά', en: 'Star Stats' },
  'stats.tab_week': { el: 'Εβδομάδα', en: 'Last week' },
  'stats.tab_all': { el: 'Όλα', en: 'All time' },
  'stats.earned_per_weekday': { el: 'Ανά ημέρα', en: 'Stars per day' },
  'stats.total_stars_earned': { el: 'Σύνολο', en: 'Total stars' },
  'stats.total_chores': { el: 'Δουλειές', en: 'Chores' },
  'stats.total_awards': { el: 'Βραβεία', en: 'Awards' },
  'stats.top_earner': { el: 'Πρωταθλητής', en: 'Top earner' },
  'stats.top_chorer': { el: 'Εργατικός', en: 'Hardest worker' },
  'stats.top_buyer': { el: 'Αγοραστής', en: 'Top buyer' },
  'stats.per_kid_title': { el: 'Ανά παιδί', en: 'Per kid' },
  'stats.best_day': { el: 'Καλύτερη μέρα', en: 'Best day' },
  'stats.best_week': { el: 'Καλύτερη εβδομάδα', en: 'Best week' },
  'stats.earned': { el: 'Κερδισμένα', en: 'Earned' },
  'stats.spent': { el: 'Ξοδεμένα', en: 'Spent' },
  'stats.empty': { el: 'Κανένα στατιστικό', en: 'No stats yet' },
  'stats.none_yet': { el: '—', en: '—' },
  'stats.chores_count': { el: '{count} δουλειές', en: '{count} chores' },
  'stats.awards_count': { el: '{count} βραβεία', en: '{count} awards' },
  'stats.weekday_mon': { el: 'Δευ', en: 'Mon' },
  'stats.weekday_tue': { el: 'Τρί', en: 'Tue' },
  'stats.weekday_wed': { el: 'Τετ', en: 'Wed' },
  'stats.weekday_thu': { el: 'Πέμ', en: 'Thu' },
  'stats.weekday_fri': { el: 'Παρ', en: 'Fri' },
  'stats.weekday_sat': { el: 'Σάβ', en: 'Sat' },
  'stats.weekday_sun': { el: 'Κυρ', en: 'Sun' },
  'stats.games_title': { el: 'Σκορ Παιχνιδιών', en: 'Game scores' },
  'stats.games_none': { el: 'Δεν έχει παίξει ακόμα', en: 'No games played yet' },
  'games.memory.title': { el: 'Παιχνίδι Μνήμης', en: 'Memory Match' },
  'games.memory.easy': { el: 'Εύκολο', en: 'Easy' },
  'games.memory.medium': { el: 'Μέτριο', en: 'Medium' },
  'games.memory.hard': { el: 'Δύσκολο', en: 'Hard' },
  'games.simon.title': { el: 'Σάιμον', en: 'Simon' },
  'games.catcher.title': { el: 'Πιάσε τα Αστέρια', en: 'Star Catcher' },
};

const SAMPLE: StatsResponse = {
  window_week: {
    earned_per_weekday: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, stars: weekday === 2 ? 12 : 0 })),
    total_stars_earned: 12,
    total_chores: 3,
    total_awards: 1,
    top_earner: { id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', stars: 12 },
    top_chorer: { id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', count: 3 },
    top_buyer: { id: 2, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'star', count: 1 },
  },
  window_all: {
    earned_per_weekday: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, stars: 10 })),
    total_stars_earned: 70,
    total_chores: 9,
    total_awards: 4,
    top_earner: { id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', stars: 40 },
    top_chorer: { id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', count: 6 },
    top_buyer: { id: 2, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'star', count: 4 },
  },
  per_kid: [
    {
      id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', current_stars: 25,
      total_earned: 40, total_spent: 15,
      best_day: { date: '2026-06-03', stars: 12 },
      best_week: { week_start: '2026-06-01', stars: 30 },
      game_scores: { 'memory.easy': 7, simon: 5, catcher: 23 },
    },
    {
      id: 2, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'star', current_stars: 5,
      total_earned: 30, total_spent: 25,
      best_day: null,
      best_week: null,
      game_scores: {},
    },
  ],
  game_players: [
    { id: 1, name: 'Maria', avatar_kind: 'icon', avatar_value: 'fox', game_scores: { 'memory.easy': 7, simon: 5, catcher: 23 } },
    { id: 2, name: 'Nikos', avatar_kind: 'icon', avatar_value: 'star', game_scores: {} },
    // A parent who has played shows up on the family scoreboard.
    { id: 3, name: 'Dad', avatar_kind: 'icon', avatar_value: 'shield', game_scores: { 'memory.hard': 30 } },
  ],
};

function renderStats() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <Stats />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

beforeAll(() => {
  server.listen();
  useI18nStore.getState().setTranslations(TRANSLATIONS);
  useI18nStore.getState().setLocale('en');
});

afterEach(() => server.resetHandlers());

afterAll(() => server.close());

describe('Stats', () => {
  it('renders summary cards, champions and per-kid cards', async () => {
    server.use(http.get('/api/stats', () => HttpResponse.json(SAMPLE)));
    renderStats();
    await waitFor(() => {
      // week window default: total 12, chores 3, awards 1
      expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Top earner')).toBeInTheDocument();
    });
    // both champions and per-kid show Maria → at least 2 occurrences
    expect(screen.getAllByText('Maria').length).toBeGreaterThanOrEqual(2);
    // per-kid earned/spent for Nikos
    expect(screen.getByText('+30 ⭐')).toBeInTheDocument();
  });

  it('switches between week and all-time windows', async () => {
    server.use(http.get('/api/stats', () => HttpResponse.json(SAMPLE)));
    renderStats();
    await waitFor(() => expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1));

    await userEvent.click(screen.getByRole('button', { name: 'All time' }));
    // all-time total stars earned = 70
    await waitFor(() => expect(screen.getByText('70')).toBeInTheDocument());
  });

  it('shows per-kid game scores with labels, and a hint for kids without scores', async () => {
    server.use(http.get('/api/stats', () => HttpResponse.json(SAMPLE)));
    renderStats();
    await waitFor(() => expect(screen.getByText(/Game scores/)).toBeInTheDocument());
    // Maria's rows: memory.easy, simon, catcher
    expect(screen.getByText('🃏 Memory Match · Easy')).toBeInTheDocument();
    expect(screen.getByText('🚦 Simon')).toBeInTheDocument();
    expect(screen.getByText('⭐ Star Catcher')).toBeInTheDocument();
    expect(screen.getByText('23')).toBeInTheDocument();
    // Nikos has no scores
    expect(screen.getByText('No games played yet')).toBeInTheDocument();
    // A parent who has played appears on the same scoreboard.
    expect(screen.getByText('Dad')).toBeInTheDocument();
    expect(screen.getByText('30')).toBeInTheDocument();
  });

  it('shows empty state when there is no data', async () => {
    const empty: StatsResponse = {
      window_week: { ...SAMPLE.window_week, earned_per_weekday: [], total_stars_earned: 0, total_chores: 0, total_awards: 0, top_earner: null, top_chorer: null, top_buyer: null },
      window_all: { ...SAMPLE.window_all, earned_per_weekday: [], total_stars_earned: 0, total_chores: 0, total_awards: 0, top_earner: null, top_chorer: null, top_buyer: null },
      per_kid: [],
      game_players: [],
    };
    server.use(http.get('/api/stats', () => HttpResponse.json(empty)));
    renderStats();
    await waitFor(() => expect(screen.getByText('No stats yet')).toBeInTheDocument());
  });
});

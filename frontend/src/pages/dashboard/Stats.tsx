import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getStats } from '../../api/client';
import { useT, useLocale } from '../../i18n/store';
import { formatDateShort } from '../../lib/datetime';
import type { StatKid, StatsWindow, StatsPerKid } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import './Stats.css';

// Display order + labels for the Games-tab best scores (keys match the backend
// game key set in app/services/games.py).
const GAME_SCORE_ROWS: { key: string; emoji: string; titleKey: string; subKey?: string }[] = [
  { key: 'memory.easy', emoji: '🃏', titleKey: 'games.memory.title', subKey: 'games.memory.easy' },
  { key: 'memory.medium', emoji: '🃏', titleKey: 'games.memory.title', subKey: 'games.memory.medium' },
  { key: 'memory.hard', emoji: '🃏', titleKey: 'games.memory.title', subKey: 'games.memory.hard' },
  { key: 'simon', emoji: '🚦', titleKey: 'games.simon.title' },
  { key: 'catcher', emoji: '⭐', titleKey: 'games.catcher.title' },
];

const WEEKDAY_KEYS = [
  'stats.weekday_mon',
  'stats.weekday_tue',
  'stats.weekday_wed',
  'stats.weekday_thu',
  'stats.weekday_fri',
  'stats.weekday_sat',
  'stats.weekday_sun',
];

export function Stats() {
  const t = useT();
  const [window, setWindow] = useState<'week' | 'all'>('week');

  const { data, isLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: getStats,
  });

  if (isLoading) return <div className="page-loading">{t('common.loading')}</div>;

  const stats = data;
  const win: StatsWindow | undefined = window === 'week' ? stats?.window_week : stats?.window_all;
  const perKid = stats?.per_kid ?? [];

  const hasAnyData = (stats?.window_all.total_stars_earned ?? 0) > 0 || perKid.length > 0;

  return (
    <div className="stats-page">
      <h2>📊 {t('stats.title')}</h2>

      <div className="stats-window-toggle">
        <button
          type="button"
          className={window === 'week' ? 'active' : ''}
          onClick={() => setWindow('week')}
        >
          {t('stats.tab_week')}
        </button>
        <button
          type="button"
          className={window === 'all' ? 'active' : ''}
          onClick={() => setWindow('all')}
        >
          {t('stats.tab_all')}
        </button>
      </div>

      {!hasAnyData && (
        <div className="empty-state">
          <span className="empty-icon">📊</span>
          <p>{t('stats.empty')}</p>
        </div>
      )}

      {hasAnyData && win && (
        <>
          <div className="stats-cards">
            <StatCard icon="⭐" value={win.total_stars_earned} label={t('stats.total_stars_earned')} tone="gold" />
            <StatCard icon="✅" value={win.total_chores} label={t('stats.total_chores')} tone="green" />
            <StatCard icon="🎁" value={win.total_awards} label={t('stats.total_awards')} tone="pink" />
          </div>

          <WeekdayChart entries={win.earned_per_weekday} weekdayLabel={(i) => t(WEEKDAY_KEYS[i] ?? '')} />

          <div className="stats-champions">
            <ChampionCard
              title={t('stats.top_earner')}
              emoji="🏆"
              kid={win.top_earner}
              detail={win.top_earner ? `${win.top_earner.stars} ⭐` : null}
            />
            <ChampionCard
              title={t('stats.top_chorer')}
              emoji="💪"
              kid={win.top_chorer}
              detail={win.top_chorer ? t('stats.chores_count', { count: String(win.top_chorer.count) }) : null}
            />
            <ChampionCard
              title={t('stats.top_buyer')}
              emoji="🛍️"
              kid={win.top_buyer}
              detail={win.top_buyer ? t('stats.awards_count', { count: String(win.top_buyer.count) }) : null}
            />
          </div>

          <h3 className="stats-section-title">{t('stats.per_kid_title')}</h3>
          <div className="stats-kid-grid">
            {perKid.map((kid) => (
              <KidStatCard key={kid.id} kid={kid} />
            ))}
          </div>

          <h3 className="stats-section-title">🎮 {t('stats.games_title')}</h3>
          <div className="stats-kid-grid">
            {perKid.map((kid) => (
              <GameScoresCard key={kid.id} kid={kid} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ icon, value, label, tone }: { icon: string; value: number; label: string; tone: string }) {
  return (
    <div className={`stat-card tone-${tone}`}>
      <span className="stat-card-icon">{icon}</span>
      <span className="stat-card-value">{value}</span>
      <span className="stat-card-label">{label}</span>
    </div>
  );
}

function WeekdayChart({
  entries,
  weekdayLabel,
}: {
  entries: { weekday: number; stars: number }[];
  weekdayLabel: (i: number) => string;
}) {
  const t = useT();
  const max = Math.max(1, ...entries.map((e) => e.stars));
  return (
    <div className="weekday-chart-wrap">
      <h3 className="stats-section-title">{t('stats.earned_per_weekday')}</h3>
      <div className="weekday-chart">
        {entries.map((e) => {
          const pct = Math.round((e.stars / max) * 100);
          const isMax = e.stars === max && e.stars > 0;
          return (
            <div key={e.weekday} className="weekday-col">
              <span className="weekday-value">{e.stars > 0 ? e.stars : ''}</span>
              <div className="weekday-bar-track">
                <div
                  className={`weekday-bar ${isMax ? 'is-max' : ''}`}
                  style={{ height: `${pct}%` }}
                />
              </div>
              <span className="weekday-label">{weekdayLabel(e.weekday)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChampionCard({
  title,
  emoji,
  kid,
  detail,
}: {
  title: string;
  emoji: string;
  kid: StatKid | null;
  detail: string | null;
}) {
  const t = useT();
  return (
    <div className="champion-card">
      <span className="champion-emoji">{emoji}</span>
      <span className="champion-title">{title}</span>
      {kid ? (
        <>
          <Avatar kind={kid.avatar_kind} value={kid.avatar_value} size={48} className="champion-avatar" />
          <span className="champion-name">{kid.name}</span>
          <span className="champion-detail">{detail}</span>
        </>
      ) : (
        <span className="champion-none">{t('stats.none_yet')}</span>
      )}
    </div>
  );
}

function GameScoresCard({ kid }: { kid: StatsPerKid }) {
  const t = useT();
  const rows = GAME_SCORE_ROWS.filter((row) => kid.game_scores[row.key] !== undefined);
  return (
    <div className="kid-stat-card">
      <div className="kid-stat-head">
        <Avatar kind={kid.avatar_kind} value={kid.avatar_value} size={44} className="kid-stat-avatar" />
        <div className="kid-stat-name">
          <strong>{kid.name}</strong>
        </div>
      </div>
      <div className="kid-stat-rows">
        {rows.length === 0 && (
          <div className="kid-stat-row">
            <span className="ksr-label">{t('stats.games_none')}</span>
          </div>
        )}
        {rows.map((row) => (
          <div key={row.key} className="kid-stat-row">
            <span className="ksr-label">
              {row.emoji} {t(row.titleKey)}
              {row.subKey ? ` · ${t(row.subKey)}` : ''}
            </span>
            <span className="ksr-value">{kid.game_scores[row.key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KidStatCard({ kid }: { kid: StatsPerKid }) {
  const t = useT();
  const locale = useLocale();
  return (
    <div className="kid-stat-card">
      <div className="kid-stat-head">
        <Avatar kind={kid.avatar_kind} value={kid.avatar_value} size={44} className="kid-stat-avatar" />
        <div className="kid-stat-name">
          <strong>{kid.name}</strong>
          <span className="kid-stat-balance">{kid.current_stars} ⭐</span>
        </div>
      </div>
      <div className="kid-stat-rows">
        <div className="kid-stat-row">
          <span className="ksr-label">{t('stats.earned')}</span>
          <span className="ksr-value earned">+{kid.total_earned} ⭐</span>
        </div>
        <div className="kid-stat-row">
          <span className="ksr-label">{t('stats.spent')}</span>
          <span className="ksr-value spent">-{kid.total_spent} ⭐</span>
        </div>
        <div className="kid-stat-row">
          <span className="ksr-label">{t('stats.best_day')}</span>
          <span className="ksr-value">
            {kid.best_day ? `${formatDateShort(kid.best_day.date, locale)} · ${kid.best_day.stars} ⭐` : t('stats.none_yet')}
          </span>
        </div>
        <div className="kid-stat-row">
          <span className="ksr-label">{t('stats.best_week')}</span>
          <span className="ksr-value">
            {kid.best_week ? `${formatDateShort(kid.best_week.week_start, locale)} · ${kid.best_week.stars} ⭐` : t('stats.none_yet')}
          </span>
        </div>
      </div>
    </div>
  );
}

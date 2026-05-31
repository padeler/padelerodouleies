import { useQuery } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { getLeaderboard } from '../../api/client';
import { useT } from '../../i18n/store';
import { useAuth } from '../../hooks/useAuth';
import { notifyCelebration } from '../../lib/notify';
import type { LeaderboardEntry } from '../../lib/types';
import { Avatar } from '../../components/Avatar';
import './Leaderboard.css';

const podiumOrder: number[] = [1, 0, 2];

export function Leaderboard() {
  const t = useT();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
  });

  // Celebrate a podium rank only once per visit to the page, not on every
  // refetch / re-render (which previously fired the toast + confetti 3x).
  const celebrated = useRef(false);
  useEffect(() => {
    if (!data || !user || celebrated.current) return;
    const myEntry = data.find((e) => e.id === user.id);
    if (myEntry && myEntry.ranking <= 3) {
      celebrated.current = true;
      const medals = ['🥇', '🥈', '🥉'];
      notifyCelebration(`${medals[myEntry.ranking - 1]} ${user.name}!`, 'leaderboard-celebration');
    }
  }, [data, user]);

  if (isLoading) return <div className="page-loading">{t('common.loading')}</div>;

  const entries = data ?? [];
  // A podium needs at least two contenders; with a single user we fall back to
  // listing everyone as rows so the page is never blank.
  const hasPodium = entries.length >= 2;
  const top3 = entries.slice(0, 3);
  const listEntries = hasPodium ? entries.slice(3) : entries;

  return (
    <div className="leaderboard-page">
      <h2>{t('nav.leaderboard')}</h2>

      {hasPodium && (
        <div className="podium">
          {podiumOrder.map((pos) => {
            const entry = top3[pos];
            if (!entry) return null;
            return (
              <PodiumFigure key={entry.id} entry={entry} rank={pos + 1} />
            );
          })}
        </div>
      )}

      {listEntries.length > 0 && (
        <div className="leaderboard-list">
          {listEntries.map((entry) => (
            <div key={entry.id} className="leaderboard-row">
              <span className="lb-rank">#{entry.ranking}</span>
              <Avatar
                kind={entry.avatar_kind}
                value={entry.avatar_value}
                size={36}
                className="lb-avatar"
              />
              <span className="lb-name">{entry.name}</span>
              <span className="lb-stars">{entry.current_stars} ⭐</span>
            </div>
          ))}
        </div>
      )}

      {entries.length === 0 && (
        <div className="empty-state">
          <span className="empty-icon">🏆</span>
          <p>{t('leaderboard.empty')}</p>
        </div>
      )}
    </div>
  );
}

function PodiumFigure({ entry, rank }: { entry: LeaderboardEntry; rank: number }) {
  const heights = [120, 90, 70];
  const labels = ['🥇', '🥈', '🥉'];
  const colors = ['#ffd700', '#c0c0c0', '#cd7f32'];

  return (
    <div className="podium-figure">
      <Avatar
        kind={entry.avatar_kind}
        value={entry.avatar_value}
        className="podium-avatar"
      />
      <div className="podium-name">{entry.name}</div>
      <div className="podium-stars">{entry.current_stars} ⭐</div>
      <div
        className="podium-block"
        style={{
          height: `${heights[rank - 1]}px`,
          background: colors[rank - 1],
        }}
      >
        <span className="podium-label">{labels[rank - 1]}</span>
      </div>
    </div>
  );
}

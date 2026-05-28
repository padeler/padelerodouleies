import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getLeaderboard } from '../../api/client';
import { useT } from '../../i18n/store';
import { useAuth } from '../../hooks/useAuth';
import { notifyCelebration } from '../../lib/notify';
import type { LeaderboardEntry } from '../../lib/types';
import './Leaderboard.css';

const podiumOrder: number[] = [2, 0, 1];

export function Leaderboard() {
  const t = useT();
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: getLeaderboard,
  });

  useEffect(() => {
    if (!data || !user) return;
    const myEntry = data.find((e) => e.id === user.id);
    if (myEntry && myEntry.ranking <= 3) {
      const medals = ['🥇', '🥈', '🥉'];
      notifyCelebration(`${medals[myEntry.ranking - 1]} ${user.name}!`);
    }
  }, [data, user]);

  if (isLoading) return <div className="page-loading">{t('common.loading')}</div>;

  const entries = data ?? [];
  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="leaderboard-page">
      <h2>{t('nav.leaderboard')}</h2>

      {top3.length >= 2 && (
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

      {rest.length > 0 && (
        <div className="leaderboard-list">
          {rest.map((entry) => (
            <div key={entry.id} className="leaderboard-row">
              <span className="lb-rank">#{entry.ranking}</span>
              <span className="lb-avatar">
                <img
                  className="lb-avatar-img"
                  src={entry.avatar_kind === 'image' ? entry.avatar_value : `/api/icons/svg/${entry.avatar_value}`}
                  alt=""
                />
              </span>
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
  const heights = [90, 120, 70];
  const labels = ['🥈', '🥇', '🥉'];
  const colors = ['#c0c0c0', '#ffd700', '#cd7f32'];

  return (
    <div className="podium-figure">
      <div className="podium-avatar">
        <img
          src={entry.avatar_kind === 'image' ? entry.avatar_value : `/api/icons/svg/${entry.avatar_value}`}
          alt=""
          className="podium-avatar-img"
        />
      </div>
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

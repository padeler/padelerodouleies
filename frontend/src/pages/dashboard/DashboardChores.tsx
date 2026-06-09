import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVisibleChores, claimChore, getPendingStars } from '../../api/client';
import { useT, useLocale } from '../../i18n/store';
import { useAuth } from '../../hooks/useAuth';
import type { VisibleChore } from '../../lib/types';
import { formatRelativeFromNow } from '../../lib/datetime';
import { notifyCelebration, notifyError } from '../../lib/notify';
import { playClaim, playFlip } from '../../lib/sound';
import { Avatar } from '../../components/Avatar';
import './flip-card.css';
import './DashboardChores.css';

function ClaimerBadge({ claimed_by }: { claimed_by: VisibleChore['claimed_by'] }) {
  if (!claimed_by) return null;
  return (
    <div className="chore-claimer-badge">
      <Avatar
        kind={claimed_by.avatar_kind}
        value={claimed_by.avatar_value}
        size={28}
        className="chore-claimer-avatar"
      />
      <span className="chore-claimer-name">{claimed_by.name}</span>
    </div>
  );
}

function ChoreCard({ chore, currentUserId }: { chore: VisibleChore; currentUserId: number }) {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [flipped, setFlipped] = useState(false);

  const mutation = useMutation({
    mutationFn: () => claimChore(chore.id),
    onSuccess: () => {
      playClaim();
      notifyCelebration(t('chore.pending'));
      queryClient.invalidateQueries({ queryKey: ['visible-chores'] });
      queryClient.invalidateQueries({ queryKey: ['pending-stars'] });
    },
    onError: () => {
      notifyError(t('chore.already_claimed'));
    },
  });

  const isMyPending = chore.status === 'pending' && chore.claimed_by?.user_id === currentUserId;
  const isMyApproved = chore.status === 'approved' && chore.claimed_by?.user_id === currentUserId;
  const isTakenByOther = (chore.status === 'pending' || chore.status === 'approved') &&
    chore.claimed_by?.user_id !== currentUserId;

  const cardClass = [
    'chore-card',
    `chore-mode-${chore.claim_mode}`,
    chore.status !== 'available' ? `chore-status-${chore.status}` : '',
    isTakenByOther ? 'chore-taken' : '',
  ].filter(Boolean).join(' ');

  const iconSrc = chore.icon_name.startsWith('/')
    ? chore.icon_name
    : `/api/icons/svg/${chore.icon_name}`;

  return (
    <div
      className={`flip-card ${flipped ? 'flipped' : ''}`}
      onClick={() => {
        playFlip();
        setFlipped((f) => !f);
      }}
    >
      <div className="flip-card-inner">
        <div className={`${cardClass} flip-card-face flip-card-front`}>
          <div className="chore-icon-wrap">
            <img src={iconSrc} alt="" className="chore-icon" />
          </div>
          <h3 className="chore-title">{chore.title}</h3>
          <div className="chore-points">+{chore.points_value} ★</div>

          {chore.status === 'available' && (
            <button
              className="chore-claim-btn"
              type="button"
              disabled={mutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                mutation.mutate();
              }}
            >
              {mutation.isPending ? (
                <span className="chore-pending-label">{t('chore.pending')}</span>
              ) : (
                t('chore.claim')
              )}
            </button>
          )}

          {isMyPending && (
            <div className="chore-status-badge chore-status-mine-pending">
              {t('chore.status_pending_mine')}
            </div>
          )}

          {isMyApproved && (
            <div className="chore-status-badge chore-status-mine-approved">
              {t('chore.status_approved_mine')}
            </div>
          )}

          {isTakenByOther && chore.status === 'pending' && (
            <>
              <div className="chore-status-badge chore-status-taken">
                {t('chore.claimed_by', { name: chore.claimed_by!.name })}
              </div>
              <ClaimerBadge claimed_by={chore.claimed_by} />
            </>
          )}

          {isTakenByOther && chore.status === 'approved' && (
            <>
              <div className="chore-status-badge chore-status-done">
                {t('chore.done_by', { name: chore.claimed_by!.name })}
              </div>
              <ClaimerBadge claimed_by={chore.claimed_by} />
            </>
          )}

          {mutation.isError && (
            <div className="chore-error">{t('chore.already_claimed')}</div>
          )}
        </div>

        <div className={`${cardClass} flip-card-face flip-card-back`}>
          <div className="flip-back-header">
            <img src={iconSrc} alt="" className="flip-back-icon" />
            <h3 className="flip-back-title">{chore.title}</h3>
          </div>
          <div className="flip-back-label">{t('card.details')}</div>
          <p className="flip-back-desc">
            {chore.description || t('card.no_description')}
          </p>
          <div className="chore-points">+{chore.points_value} ★</div>
          {chore.available_again_at && (
            <div className="chore-available-again">
              {t('chore.available_again', {
                when: formatRelativeFromNow(chore.available_again_at, locale),
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DashboardChores() {
  const t = useT();
  const { user } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ['visible-chores'],
    queryFn: getVisibleChores,
    refetchInterval: 30_000,
  });

  const { data: pendingData } = useQuery({
    queryKey: ['pending-stars'],
    queryFn: getPendingStars,
    enabled: user?.role !== 'admin',
  });

  if (isLoading) return <div className="page-loading">{t('common.loading')}</div>;

  const chores = data ?? [];
  const pendingStars = pendingData?.pending_stars ?? 0;

  return (
    <div className="dashboard-chores">
      <div className="dashboard-greeting">
        {user && (
          <Avatar
            kind={user.avatar_kind}
            value={user.avatar_value}
            size={64}
            className="dashboard-avatar"
          />
        )}
        <h2>
          {t('login.welcome')} {user?.name}!
        </h2>
        {user?.role !== 'admin' && (
          <div className="stars-display">
            {pendingStars > 0 && (
              <span className="pending-stars" title={t('chore.pending_stars')}>{pendingStars}☆ </span>
            )}
            <span className="confirmed-stars">{user?.current_stars ?? 0} ★</span>
          </div>
        )}
      </div>
      {chores.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">✨</span>
          <p>{t('chore.none_visible')}</p>
        </div>
      ) : (
        <div className="chore-grid">
          {chores.map((chore) => (
            <ChoreCard key={chore.id} chore={chore} currentUserId={user?.id ?? -1} />
          ))}
        </div>
      )}
    </div>
  );
}

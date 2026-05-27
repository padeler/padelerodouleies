import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getVisibleChores, claimChore } from '../../api/client';
import { useT } from '../../i18n/store';
import { useAuth } from '../../hooks/useAuth';
import type { VisibleChore } from '../../lib/types';
import './DashboardChores.css';

function ChoreCard({ chore }: { chore: VisibleChore }) {
  const t = useT();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => claimChore(chore.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['visible-chores'] });
    },
  });

  return (
    <div className={`chore-card chore-scope-${chore.scope}`}>
      <div className="chore-icon-wrap">
        <img
          src={`/api/icons/svg/${chore.icon_name}`}
          alt=""
          className="chore-icon"
        />
      </div>
      <h3 className="chore-title">{chore.title}</h3>
      <div className="chore-points">+{chore.points_value} ⭐</div>
      <button
        className="chore-claim-btn"
        type="button"
        disabled={mutation.isPending}
        onClick={() => mutation.mutate()}
      >
        {mutation.isPending ? (
          <span className="chore-pending">{t('chore.pending')}</span>
        ) : (
          t('chore.claim')
        )}
      </button>
      {mutation.isError && (
        <div className="chore-error">
          {chore.scope === 'pooled' ? t('chore.already_claimed') : t('error.generic')}
        </div>
      )}
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

  if (isLoading) return <div className="page-loading">{t('common.loading')}</div>;

  const chores = data ?? [];

  return (
    <div className="dashboard-chores">
      <div className="dashboard-greeting">
        <h2>
          {t('login.welcome')} {user?.name}!
        </h2>
        <div className="stars-display">{user?.current_stars ?? 0} ⭐</div>
      </div>
      {chores.length === 0 ? (
        <div className="empty-state">
          <span className="empty-icon">✨</span>
          <p>{t('chore.none_visible')}</p>
        </div>
      ) : (
        <div className="chore-grid">
          {chores.map((chore) => (
            <ChoreCard key={chore.id} chore={chore} />
          ))}
        </div>
      )}
    </div>
  );
}

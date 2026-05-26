import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMarketplaceRewards, redeemReward, contributeReward } from '../../api/client';
import { useT, useLocale } from '../../i18n/store';
import { useAuth } from '../../hooks/useAuth';
import type { MarketplaceReward } from '../../lib/types';
import './Marketplace.css';

function RewardCard({ reward }: { reward: MarketplaceReward }) {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const stars = user?.current_stars ?? 0;
  const title = locale === 'en' ? reward.title_en : reward.title_el;
  const desc = locale === 'en' ? reward.description_en : reward.description_el;

  const redeemMutation = useMutation({
    mutationFn: () => redeemReward(reward.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
    },
  });

  if (reward.is_collaborative) return null;

  const canAfford = stars >= reward.cost_stars;

  return (
    <div className="reward-card">
      <div className="reward-icon-wrap">
        <img src={`/api/icons/svg/${reward.icon_name}`} alt="" className="reward-icon" />
      </div>
      <h3 className="reward-title">{title}</h3>
      {desc && <p className="reward-desc">{desc}</p>}
      <div className="reward-cost">{reward.cost_stars} ⭐</div>
      <button
        className={`redeem-btn ${canAfford ? '' : 'redeem-locked'}`}
        type="button"
        disabled={!canAfford || redeemMutation.isPending}
        onClick={() => redeemMutation.mutate()}
      >
        {redeemMutation.isPending
          ? t('common.loading')
          : canAfford
            ? t('reward.redeem')
            : `${t('reward.insufficient')} (${stars}/${reward.cost_stars})`}
      </button>
      {redeemMutation.isSuccess && <div className="reward-success">{t('common.success')}</div>}
      {redeemMutation.isError && <div className="reward-error">{t('common.error')}</div>}
    </div>
  );
}

function CollabCard({ reward }: { reward: MarketplaceReward }) {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const stars = user?.current_stars ?? 0;
  const title = locale === 'en' ? reward.title_en : reward.title_el;
  const current = reward.current_stars ?? 0;
  const target = reward.target_stars ?? reward.cost_stars;
  const contributors = reward.contributors ?? [];

  const [contributeAmount, setContributeAmount] = useState(1);
  const [showModal, setShowModal] = useState(false);

  const contributeMutation = useMutation({
    mutationFn: () => contributeReward(reward.id, contributeAmount),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-rewards'] });
      setShowModal(false);
    },
  });

  const maxContribute = Math.min(stars, target - current);

  return (
    <div className="collab-card">
      <div className="collab-header">
        <img src={`/api/icons/svg/${reward.icon_name}`} alt="" className="collab-icon" />
        <h3 className="collab-title">{title}</h3>
      </div>
      <div className="collab-progress-wrap">
        <div className="collab-progress-bar">
          {contributors.map((c, i) => {
            const pct = (c.stars / target) * 100;
            const colors = ['#7b2ff7', '#f0c36d', '#22c55e', '#3b82f6', '#ef4444'];
            return (
              <div
                key={c.user_id}
                className="collab-segment"
                style={{
                  width: `${pct}%`,
                  background: colors[i % colors.length],
                }}
                title={`${c.user_name}: ${c.stars}⭐`}
              />
            );
          })}
        </div>
        <div className="collab-total">
          {current} / {target} ⭐
        </div>
      </div>
      {maxContribute > 0 && current < target && (
        <button
          className="contribute-btn"
          type="button"
          onClick={() => setShowModal(true)}
        >
          {t('reward.contribute')}
        </button>
      )}
      {current >= target && (
        <div className="collab-complete">{t('reward.complete')}</div>
      )}

      {showModal && (
        <div className="collab-modal-overlay" onClick={() => setShowModal(false)}>
          <div className="collab-modal" onClick={(e) => e.stopPropagation()}>
            <h4>{t('reward.contribute')}</h4>
            <div className="collab-slider-wrap">
              <input
                type="range"
                min={1}
                max={maxContribute}
                value={contributeAmount}
                onChange={(e) => setContributeAmount(Number(e.target.value))}
              />
              <div className="collab-slider-value">{contributeAmount} ⭐</div>
            </div>
            <div className="collab-modal-actions">
              <button
                className="btn-cancel"
                onClick={() => setShowModal(false)}
              >
                {t('common.cancel')}
              </button>
              <button
                className="btn-confirm"
                disabled={contributeMutation.isPending || contributeAmount < 1}
                onClick={() => contributeMutation.mutate()}
              >
                {t('common.confirm')}
              </button>
            </div>
            {contributeMutation.isError && (
              <div className="reward-error">{t('common.error')}</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function Marketplace() {
  const t = useT();

  const { data, isLoading } = useQuery({
    queryKey: ['marketplace-rewards'],
    queryFn: getMarketplaceRewards,
  });

  if (isLoading) return <div className="page-loading">{t('common.loading')}</div>;

  const rewards = data ?? [];
  const collab = rewards.filter((r) => r.is_collaborative);
  const individual = rewards.filter((r) => !r.is_collaborative);

  return (
    <div className="marketplace-page">
      <h2>{t('nav.marketplace')}</h2>
      {collab.length > 0 && (
        <section className="marketplace-section">
          <h3>{t('reward.collaborative_goals')}</h3>
          <div className="collab-grid">
            {collab.map((r) => (
              <CollabCard key={r.id} reward={r} />
            ))}
          </div>
        </section>
      )}
      <section className="marketplace-section">
        <h3>{t('nav.rewards')}</h3>
        {individual.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">🎁</span>
            <p>{t('marketplace.empty')}</p>
          </div>
        ) : (
          <div className="reward-grid">
            {individual.map((r) => (
              <RewardCard key={r.id} reward={r} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

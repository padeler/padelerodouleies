import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getMarketplaceRewards, redeemReward, contributeReward } from '../../api/client';
import { useT, useLocale } from '../../i18n/store';
import { useAuth } from '../../hooks/useAuth';
import type { MarketplaceReward } from '../../lib/types';
import { formatRelativeFromNow } from '../../lib/datetime';
import { notifyCelebration, notifyError } from '../../lib/notify';
import { playFlip, playReward } from '../../lib/sound';
import './flip-card.css';
import './Marketplace.css';

function RewardCard({ reward }: { reward: MarketplaceReward }) {
  const t = useT();
  const locale = useLocale();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const stars = user?.current_stars ?? 0;
  const [flipped, setFlipped] = useState(false);

  const redeemMutation = useMutation({
    mutationFn: () => redeemReward(reward.id),
    onSuccess: () => {
      playReward();
      notifyCelebration(t('common.success'));
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      // Refresh the marketplace so this reward flips to its "claimed today" state.
      queryClient.invalidateQueries({ queryKey: ['marketplace-rewards'] });
    },
    onError: () => {
      notifyError(t('common.error'));
    },
  });

  if (reward.is_collaborative) return null;

  // An individual reward is redeemable once per kid per day; the backend sets
  // `available_again_at` (next Athens midnight) once it has been claimed today.
  const redeemedToday = Boolean(reward.available_again_at);
  const canAfford = stars >= reward.cost_stars;
  const iconSrc = `/api/icons/svg/${reward.icon_name}`;

  return (
    <div
      className={`flip-card ${flipped ? 'flipped' : ''}`}
      onClick={() => {
        playFlip();
        setFlipped((f) => !f);
      }}
    >
      <div className="flip-card-inner">
        <div className="reward-card flip-card-face flip-card-front">
          <div className="reward-icon-wrap">
            <img src={iconSrc} alt="" className="reward-icon" />
          </div>
          <h3 className="reward-title">{reward.title}</h3>
          <div className="reward-cost">{reward.cost_stars} ⭐</div>
          {redeemedToday ? (
            <div className="reward-redeemed-badge">{t('reward.redeemed_today')}</div>
          ) : (
            <button
              className={`redeem-btn ${canAfford ? '' : 'redeem-locked'}`}
              type="button"
              disabled={!canAfford || redeemMutation.isPending}
              onClick={(e) => {
                e.stopPropagation();
                redeemMutation.mutate();
              }}
            >
              {redeemMutation.isPending
                ? t('common.loading')
                : canAfford
                  ? t('reward.redeem')
                  : `${t('reward.insufficient')} (${stars}/${reward.cost_stars})`}
            </button>
          )}
          {redeemMutation.isError && <div className="reward-error">{t('common.error')}</div>}
        </div>

        <div className="reward-card flip-card-face flip-card-back">
          <div className="flip-back-header">
            <img src={iconSrc} alt="" className="flip-back-icon" />
            <h3 className="flip-back-title">{reward.title}</h3>
          </div>
          <div className="flip-back-label">{t('card.details')}</div>
          <p className="flip-back-desc">
            {reward.description || t('card.no_description')}
          </p>
          <div className="reward-cost">{reward.cost_stars} ⭐</div>
          {reward.available_again_at && (
            <div className="reward-available-again">
              {t('reward.available_again', {
                when: formatRelativeFromNow(reward.available_again_at, locale),
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CollabCard({ reward }: { reward: MarketplaceReward }) {
  const t = useT();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const stars = user?.current_stars ?? 0;
  const current = reward.current_stars ?? 0;
  const target = reward.target_stars ?? reward.cost_stars;
  const contributors = reward.contributors ?? [];

  const [contributeAmount, setContributeAmount] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [flipped, setFlipped] = useState(false);

  const contributeMutation = useMutation({
    mutationFn: () => contributeReward(reward.id, contributeAmount),
    onSuccess: () => {
      notifyCelebration(t('reward.contribute') + ' ✓');
      queryClient.invalidateQueries({ queryKey: ['auth-me'] });
      queryClient.invalidateQueries({ queryKey: ['marketplace-rewards'] });
      setShowModal(false);
    },
    onError: () => {
      notifyError(t('common.error'));
    },
  });

  const maxContribute = Math.min(stars, target - current);
  const iconSrc = `/api/icons/svg/${reward.icon_name}`;

  return (
    <div
      className={`flip-card ${flipped ? 'flipped' : ''}`}
      onClick={() => {
        playFlip();
        setFlipped((f) => !f);
      }}
    >
      <div className="flip-card-inner">
        <div className="collab-card flip-card-face flip-card-front">
          <div className="collab-header">
            <img src={iconSrc} alt="" className="collab-icon" />
            <h3 className="collab-title">{reward.title}</h3>
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
              onClick={(e) => {
                e.stopPropagation();
                setShowModal(true);
              }}
            >
              {t('reward.contribute')}
            </button>
          )}
          {current >= target && (
            <div className="collab-complete">{t('reward.complete')}</div>
          )}
        </div>

        <div className="collab-card flip-card-face flip-card-back">
          <div className="collab-header">
            <img src={iconSrc} alt="" className="collab-icon" />
            <h3 className="collab-title">{reward.title}</h3>
          </div>
          <div className="flip-back-label">{t('card.details')}</div>
          <p className="flip-back-desc">
            {reward.description || t('card.no_description')}
          </p>
          <div className="collab-total">{target} ⭐</div>
        </div>
      </div>

      {showModal && createPortal(
        <div
          className="collab-modal-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setShowModal(false);
          }}
        >
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
        </div>,
        document.body,
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

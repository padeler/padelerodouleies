import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createReward, updateReward } from '../api/client';
import { useT } from '../i18n/store';
import type { Reward } from '../lib/types';
import { IconPicker } from './IconPicker';
import { notifySuccess, notifyError } from '../lib/notify';

const rewardSchema = z.object({
  title: z.string().min(1, 'Required').max(200),
  description: z.string().max(500).optional(),
  icon_name: z.string().min(1, 'Required'),
  cost_stars: z.number().int().min(1),
  is_collaborative: z.boolean(),
});

type RewardForm = z.infer<typeof rewardSchema>;

interface RewardModalProps {
  reward?: Reward | null;
  onClose: () => void;
}

export function RewardModal({ reward, onClose }: RewardModalProps) {
  const t = useT();
  const qc = useQueryClient();

  const defaultValues: RewardForm = {
    title: reward?.title ?? '',
    description: reward?.description ?? '',
    icon_name: reward?.icon_name ?? 'gift',
    cost_stars: reward?.cost_stars ?? 20,
    is_collaborative: reward?.is_collaborative ?? false,
  };

  const { control, handleSubmit, formState: { errors } } = useForm<RewardForm>({
    resolver: zodResolver(rewardSchema),
    defaultValues,
  });

  const mutate = useMutation({
    mutationFn: async (data: RewardForm) => {
      if (reward) {
        return updateReward(reward.id, data);
      }
      return createReward(data);
    },
    onSuccess: () => {
      notifySuccess((reward ? t('common.edit') : t('reward.new')) + ' ✓');
      qc.invalidateQueries({ queryKey: ['rewards'] });
      onClose();
    },
    onError: (err) => {
      notifyError(err.message || t('common.error'));
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          {reward ? t('common.edit') : t('reward.new')}
        </h3>
        <form onSubmit={handleSubmit((data) => mutate.mutate(data))}>
          <div className="admin-form-group">
            <label>{t('reward.title_placeholder')}</label>
            <Controller name="title" control={control} render={({ field }) => (
              <input {...field} placeholder={t('reward.title_placeholder')} />
            )} />
            {errors.title && <div className="field-error">{errors.title.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('chore.description_placeholder')}</label>
            <Controller name="description" control={control} render={({ field }) => (
              <input {...field} placeholder={t('chore.description_placeholder')} />
            )} />
            {errors.description && <div className="field-error">{errors.description.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('chore.icon')}</label>
            <Controller name="icon_name" control={control} render={({ field }) => (
              <IconPicker selected={field.value} onChange={field.onChange} />
            )} />
            {errors.icon_name && <div className="field-error">{errors.icon_name.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('reward.cost')}</label>
            <Controller name="cost_stars" control={control} render={({ field }) => (
              <input {...field} type="number" min={1} onChange={(e) => field.onChange(Number(e.target.value))} />
            )} />
            {errors.cost_stars && <div className="field-error">{errors.cost_stars.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('reward.collaborative')}</label>
            <Controller name="is_collaborative" control={control} render={({ field }) => (
              <div className="toggle-group">
                <button
                  type="button"
                  className={`toggle-btn ${field.value ? 'active' : ''}`}
                  onClick={() => field.onChange(!field.value)}
                >
                  {t('reward.collaborative')}
                </button>
              </div>
            )} />
          </div>
          <div className="admin-form-actions">
            <button type="button" className="admin-btn" onClick={onClose}>
              <span className="btn-icon">✕</span>
              <span className="btn-text">{t('common.cancel')}</span>
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={mutate.isPending}>
              <span className="btn-icon">✓</span>
              <span className="btn-text">{t('common.save')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

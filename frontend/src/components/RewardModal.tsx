import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createReward, updateReward } from '../api/client';
import { useT } from '../i18n/store';
import type { Reward } from '../lib/types';
import { IconPicker } from './IconPicker';

const rewardSchema = z.object({
  title_el: z.string().min(1, 'Required'),
  title_en: z.string().min(1, 'Required'),
  description_el: z.string().optional(),
  description_en: z.string().optional(),
  icon_name: z.string().min(1, 'Required'),
  cost_stars: z.number().int().min(1),
  is_collaborative: z.boolean(),
  is_enabled: z.boolean(),
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
    title_el: reward?.title_el ?? '',
    title_en: reward?.title_en ?? '',
    description_el: reward?.description_el ?? '',
    description_en: reward?.description_en ?? '',
    icon_name: reward?.icon_name ?? 'gift',
    cost_stars: reward?.cost_stars ?? 20,
    is_collaborative: reward?.is_collaborative ?? false,
    is_enabled: reward?.is_enabled ?? true,
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
      qc.invalidateQueries({ queryKey: ['rewards'] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          {reward ? t('common.edit') : t('nav.rewards')}
        </h3>
        <form onSubmit={handleSubmit((data) => mutate.mutate(data))}>
          <div className="admin-form-group">
            <label>{t('chore.title_el_placeholder')}</label>
            <Controller name="title_el" control={control} render={({ field }) => (
              <input {...field} />
            )} />
            {errors.title_el && <div className="field-error">{errors.title_el.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('chore.title_en_placeholder')}</label>
            <Controller name="title_en" control={control} render={({ field }) => (
              <input {...field} />
            )} />
            {errors.title_en && <div className="field-error">{errors.title_en.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>Icon</label>
            <Controller name="icon_name" control={control} render={({ field }) => (
              <IconPicker selected={field.value} onChange={field.onChange} />
            )} />
            {errors.icon_name && <div className="field-error">{errors.icon_name.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>Cost (Stars)</label>
            <Controller name="cost_stars" control={control} render={({ field }) => (
              <input {...field} type="number" min={1} onChange={(e) => field.onChange(Number(e.target.value))} />
            )} />
            {errors.cost_stars && <div className="field-error">{errors.cost_stars.message}</div>}
          </div>
          <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Controller name="is_collaborative" control={control} render={({ field }) => (
              <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
            )} />
            <label style={{ margin: 0 }}>Collaborative</label>
          </div>
          <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Controller name="is_enabled" control={control} render={({ field }) => (
              <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
            )} />
            <label style={{ margin: 0 }}>Enabled</label>
          </div>
          <div className="admin-form-actions">
            <button type="button" className="admin-btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={mutate.isPending}>
              {t('common.save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

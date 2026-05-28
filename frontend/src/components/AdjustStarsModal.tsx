import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adjustStars } from '../api/client';
import { useT } from '../i18n/store';
import type { AdminUser } from '../lib/types';
import { notifySuccess, notifyCelebration, notifyError } from '../lib/notify';

type Form = {
  direction: '+' | '-';
  amount: number;
  description: string;
};

interface AdjustStarsModalProps {
  user: AdminUser;
  onClose: () => void;
}

export function AdjustStarsModal({ user, onClose }: AdjustStarsModalProps) {
  const t = useT();
  const qc = useQueryClient();

  const schema = z.object({
    direction: z.enum(['+', '-']),
    amount: z.number().int().min(1),
    description: z.string().min(3, t('stars.note_min_chars')),
  });

  const { control, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: {
      direction: '+',
      amount: 1,
      description: '',
    },
  });

  const mutate = useMutation({
    mutationFn: async (data: Form) => {
      const delta = data.direction === '+' ? data.amount : -data.amount;
      return adjustStars(user.id, delta, data.description);
    },
    onSuccess: () => {
      notifyCelebration(t('stars.adjust') + ' ✓');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-history'] });
      onClose();
    },
    onError: (err) => {
      notifyError(err.message || t('common.error'));
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>{t('stars.adjust')}: {user.name}</h3>
        <form onSubmit={handleSubmit((data) => mutate.mutate(data))}>
          <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Controller name="direction" control={control} render={({ field }) => (
              <select {...field}>
                <option value="+">+ {t('stars.add')}</option>
                <option value="-">− {t('stars.remove')}</option>
              </select>
            )} />
            <Controller name="amount" control={control} render={({ field }) => (
              <input {...field} type="number" min={1} style={{ width: 80 }}
                onChange={(e) => field.onChange(Number(e.target.value))} />
            )} />
            <span>⭐</span>
          </div>
          {errors.amount && <div className="field-error">{errors.amount.message}</div>}
          <div className="admin-form-group">
            <label>{t('stars.manual_note')}</label>
            <Controller name="description" control={control} render={({ field }) => (
              <textarea {...field} rows={3} />
            )} />
            {errors.description && <div className="field-error">{errors.description.message}</div>}
          </div>
          <div className="admin-form-actions">
            <button type="button" className="admin-btn" onClick={onClose}>
              <span className="btn-icon">✕</span>
              <span className="btn-text">{t('common.cancel')}</span>
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={mutate.isPending}>
              <span className="btn-icon">✓</span>
              <span className="btn-text">{t('common.confirm')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

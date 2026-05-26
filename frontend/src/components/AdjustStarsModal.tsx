import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { adjustStars } from '../api/client';
import { useT } from '../i18n/store';
import { AdminUser } from '../lib/types';

const schema = z.object({
  direction: z.enum(['+', '-']),
  amount: z.number().int().min(1),
  description: z.string().min(3, 'At least 3 characters'),
});

type Form = z.infer<typeof schema>;

interface AdjustStarsModalProps {
  user: AdminUser;
  onClose: () => void;
}

export function AdjustStarsModal({ user, onClose }: AdjustStarsModalProps) {
  const t = useT();
  const qc = useQueryClient();

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
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      qc.invalidateQueries({ queryKey: ['admin-history'] });
      onClose();
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
                <option value="+">+ Add</option>
                <option value="-">− Remove</option>
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
              {t('common.cancel')}
            </button>
            <button type="submit" className="admin-btn admin-btn-primary" disabled={mutate.isPending}>
              {t('common.confirm')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

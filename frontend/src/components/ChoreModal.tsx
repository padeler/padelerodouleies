import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChore, updateChore } from '../api/client';
import { useT } from '../i18n/store';
import type { Chore } from '../lib/types';
import { IconPicker } from './IconPicker';

const choreSchema = z.object({
  title_el: z.string().min(1, 'Required'),
  title_en: z.string().min(1, 'Required'),
  description_el: z.string().optional(),
  description_en: z.string().optional(),
  icon_name: z.string().min(1, 'Required'),
  scope: z.enum(['individual', 'pooled']),
  points_value: z.number().int().min(1),
  is_repeating: z.boolean(),
  start_time: z.string().optional(),
  window_hours: z.number().int().min(1).max(24).optional(),
});

type ChoreForm = z.infer<typeof choreSchema>;

interface ChoreModalProps {
  chore?: Chore | null;
  onClose: () => void;
}

export function ChoreModal({ chore, onClose }: ChoreModalProps) {
  const t = useT();
  const qc = useQueryClient();

  const defaultValues: ChoreForm = {
    title_el: chore?.title_el ?? '',
    title_en: chore?.title_en ?? '',
    description_el: chore?.description_el ?? '',
    description_en: chore?.description_en ?? '',
    icon_name: chore?.icon_name ?? 'star',
    scope: chore?.scope ?? 'individual',
    points_value: chore?.points_value ?? 5,
    is_repeating: chore?.is_repeating ?? true,
    start_time: chore?.start_time ?? '',
    window_hours: chore?.window_hours ?? 4,
  };

  const { control, handleSubmit, formState: { errors } } = useForm<ChoreForm>({
    resolver: zodResolver(choreSchema),
    defaultValues,
  });

  const mutate = useMutation({
    mutationFn: async (data: ChoreForm) => {
      if (chore) {
        return updateChore(chore.id, data);
      }
      return createChore(data);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chores'] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          {chore ? t('common.edit') : t('chore.new')}
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
            <label>Scope</label>
            <Controller name="scope" control={control} render={({ field }) => (
              <select {...field}>
                <option value="individual">Individual</option>
                <option value="pooled">Pooled</option>
              </select>
            )} />
          </div>
          <div className="admin-form-group">
            <label>Points</label>
            <Controller name="points_value" control={control} render={({ field }) => (
              <input {...field} type="number" min={1} onChange={(e) => field.onChange(Number(e.target.value))} />
            )} />
            {errors.points_value && <div className="field-error">{errors.points_value.message}</div>}
          </div>
          <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Controller name="is_repeating" control={control} render={({ field }) => (
              <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
            )} />
            <label style={{ margin: 0 }}>Repeating</label>
          </div>
          <div className="admin-form-group">
            <label>Start Time</label>
            <Controller name="start_time" control={control} render={({ field }) => (
              <input {...field} type="time" />
            )} />
          </div>
          <div className="admin-form-group">
            <label>Window (hours)</label>
            <Controller name="window_hours" control={control} render={({ field }) => (
              <input {...field} type="number" min={1} max={24} onChange={(e) => field.onChange(Number(e.target.value))} />
            )} />
            {errors.window_hours && <div className="field-error">{errors.window_hours.message}</div>}
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

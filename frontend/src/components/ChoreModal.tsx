import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChore, updateChore, uploadChoreImage } from '../api/client';
import { useT } from '../i18n/store';
import type { Chore } from '../lib/types';
import { IconPicker } from './IconPicker';

const choreSchema = z.object({
  title: z.string().min(1, 'Required').max(200),
  description: z.string().max(500).optional(),
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
  const [iconTab, setIconTab] = useState<'icon' | 'upload'>(chore?.icon_name?.startsWith('/') ? 'upload' : 'icon');
  const [uploadError, setUploadError] = useState<string | null>(null);

  const defaultValues: ChoreForm = {
    title: chore?.title ?? '',
    description: chore?.description ?? '',
    icon_name: chore?.icon_name ?? 'star',
    scope: chore?.scope ?? 'individual',
    points_value: chore?.points_value ?? 5,
    is_repeating: chore?.is_repeating ?? true,
    start_time: chore?.start_time ?? '',
    window_hours: chore?.window_hours ?? undefined,
  };

  const { control, handleSubmit, formState: { errors }, watch } = useForm<ChoreForm>({
    resolver: zodResolver(choreSchema),
    defaultValues,
  });

  const isRepeating = watch('is_repeating');

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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const resp = await uploadChoreImage(file);
      const { getField } = control as any;
      const iconField = getField('icon_name');
      if (iconField) iconField.onChange(resp.url);
      setIconTab('icon');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          {chore ? t('common.edit') : t('chore.new')}
        </h3>
        <form onSubmit={handleSubmit((data) => mutate.mutate(data))}>
          <div className="admin-form-group">
            <label>{t('chore.title_placeholder')}</label>
            <Controller name="title" control={control} render={({ field }) => (
              <input {...field} placeholder={t('chore.title_placeholder')} />
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
            <div className="chore-icon-tabs" style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <button
                type="button"
                className={`admin-btn ${iconTab === 'icon' ? 'admin-btn-primary' : ''}`}
                onClick={() => setIconTab('icon')}
              >
                {t('icon_picker.tab_icon')}
              </button>
              <button
                type="button"
                className={`admin-btn ${iconTab === 'upload' ? 'admin-btn-primary' : ''}`}
                onClick={() => setIconTab('upload')}
              >
                {t('icon_picker.tab_upload')}
              </button>
            </div>
            {iconTab === 'icon' ? (
              <Controller name="icon_name" control={control} render={({ field }) => (
                <IconPicker selected={field.value} onChange={field.onChange} />
              )} />
            ) : (
              <div>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleImageUpload} />
                {uploadError && <div className="field-error">{uploadError}</div>}
              </div>
            )}
            {errors.icon_name && <div className="field-error">{errors.icon_name.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('chore.scope')}</label>
            <Controller name="scope" control={control} render={({ field }) => (
              <select {...field}>
                <option value="individual">{t('chore.scope_individual')}</option>
                <option value="pooled">{t('chore.scope_pooled')}</option>
              </select>
            )} />
          </div>
          <div className="admin-form-group">
            <label>{t('chore.points')}</label>
            <Controller name="points_value" control={control} render={({ field }) => (
              <input {...field} type="number" min={1} onChange={(e) => field.onChange(Number(e.target.value))} />
            )} />
            {errors.points_value && <div className="field-error">{errors.points_value.message}</div>}
          </div>
          <div className="admin-form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Controller name="is_repeating" control={control} render={({ field }) => (
              <input type="checkbox" checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />
            )} />
            <label style={{ margin: 0 }}>{t('chore.repeating')}</label>
          </div>
          {isRepeating && (
            <>
              <div className="admin-form-group">
                <label>{t('chore.start_time')}</label>
                <Controller name="start_time" control={control} render={({ field }) => (
                  <input {...field} type="time" step={1800} />
                )} />
                <div style={{ fontSize: 11, color: 'var(--text-muted, #888)', marginTop: 4 }}>
                  {t('chore.time_optional')}
                </div>
              </div>
              <div className="admin-form-group">
                <label>{t('chore.window')}</label>
                <Controller name="window_hours" control={control} render={({ field }) => (
                  <input {...field} type="number" min={1} max={24} onChange={(e) => field.onChange(Number(e.target.value))} />
                )} />
                {errors.window_hours && <div className="field-error">{errors.window_hours.message}</div>}
              </div>
            </>
          )}
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

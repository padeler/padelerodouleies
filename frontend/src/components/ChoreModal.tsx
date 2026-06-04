import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createChore, updateChore, uploadChoreImage } from '../api/client';
import { useT } from '../i18n/store';
import type { Chore } from '../lib/types';
import { IconPicker } from './IconPicker';
import { TimePicker24h } from './TimePicker24h';
import { toast } from 'react-hot-toast';
import './TimePicker24h.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const choreSchema = z.object({
  title: z.string().min(1, 'Required').max(200),
  description: z.string().max(500).optional(),
  icon_name: z.string().min(1, 'Required'),
  claim_mode: z.enum(['each', 'one']),
  points_value: z.number().int().min(1),
  is_repeating: z.boolean(),
  start_time: z.string().nullable().optional(),
  window_hours: z.number().int().min(1).max(24).nullable(),
  repeat_pattern: z.enum(['daily', 'weekly']),
  repeat_days: z.array(z.string()).optional(),
});

function getRepeatPattern(chore?: { repeat_days?: string[] | null }): 'daily' | 'weekly' {
  if (chore?.repeat_days?.length) return 'weekly';
  return 'daily';
}

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
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(
    chore?.icon_name?.startsWith('/') ? chore.icon_name : null
  );

  const defaultValues: ChoreForm = {
    title: chore?.title ?? '',
    description: chore?.description ?? '',
    icon_name: chore?.icon_name ?? 'star',
    claim_mode: chore?.claim_mode ?? 'each',
    points_value: chore?.points_value ?? 5,
    is_repeating: chore?.is_repeating ?? true,
    start_time: chore?.start_time ?? undefined,
    window_hours: chore?.window_hours ?? null,
    repeat_pattern: getRepeatPattern(chore ?? undefined),
    repeat_days: chore?.repeat_days ?? [],
  };

  const { control, handleSubmit, setValue, formState: { errors }, watch } = useForm<ChoreForm>({
    resolver: zodResolver(choreSchema),
    defaultValues,
  });

  const isRepeating = watch('is_repeating');
  const repeatPattern = watch('repeat_pattern');

  const mutate = useMutation({
    mutationFn: async (data: ChoreForm) => {
      const payload: Record<string, unknown> = { ...data };
      if (payload.start_time === '') delete payload.start_time;
      // Map repeat_pattern to backend fields
      if (payload.repeat_pattern === 'daily') {
        payload.repeat_days = null;
      } else if (payload.repeat_pattern === 'weekly') {
        payload.repeat_days = payload.repeat_days || [];
      }
      payload.n_day_interval = null;
      delete payload.repeat_pattern;
      if (chore) {
        return updateChore(chore.id, payload);
      }
      return createChore(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chores'] });
      toast.success(chore ? t('common.edit') + ' ✓' : t('chore.new') + ' ✓');
      onClose();
    },
    onError: (err) => {
      toast.error(err.message || t('common.error'));
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const resp = await uploadChoreImage(file);
      setValue('icon_name', resp.url);
      setUploadedPreviewUrl(resp.url);
      toast.success(t('common.success'));
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      setUploadError(msg);
      toast.error(msg);
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
                <span className="btn-icon">✦</span>
                <span className="btn-text">{t('icon_picker.tab_icon')}</span>
              </button>
              <button
                type="button"
                className={`admin-btn ${iconTab === 'upload' ? 'admin-btn-primary' : ''}`}
                onClick={() => setIconTab('upload')}
              >
                <span className="btn-icon">⬆</span>
                <span className="btn-text">{t('icon_picker.tab_upload')}</span>
              </button>
            </div>
            {iconTab === 'icon' ? (
              <Controller name="icon_name" control={control} render={({ field }) => (
                <IconPicker selected={field.value} onChange={field.onChange} />
              )} />
            ) : (
              <div>
                <input type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={handleImageUpload} />
                {uploadedPreviewUrl && (
                  <img
                    src={uploadedPreviewUrl}
                    alt="Preview"
                    style={{ display: 'block', width: 64, height: 64, objectFit: 'cover', borderRadius: 8, marginTop: 8 }}
                  />
                )}
                {uploadError && <div className="field-error">{uploadError}</div>}
              </div>
            )}
            {errors.icon_name && <div className="field-error">{errors.icon_name.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('chore.claim_mode')}</label>
            <Controller name="claim_mode" control={control} render={({ field }) => (
              <div className="toggle-group">
                {(['each', 'one'] as const).map((val) => (
                  <button
                    key={val}
                    type="button"
                    className={`toggle-btn ${field.value === val ? 'active' : ''}`}
                    onClick={() => field.onChange(val)}
                  >
                    {val === 'each' ? t('chore.claim_mode_each') : t('chore.claim_mode_one')}
                  </button>
                ))}
              </div>
            )} />
            {errors.claim_mode && <div className="field-error">{errors.claim_mode.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('chore.points')}</label>
            <Controller name="points_value" control={control} render={({ field }) => (
              <input {...field} type="number" min={1} onChange={(e) => field.onChange(Number(e.target.value))} />
            )} />
            {errors.points_value && <div className="field-error">{errors.points_value.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('chore.repeating')}</label>
            <div className="toggle-group">
              <button
                type="button"
                className={`toggle-btn ${watch('is_repeating') ? 'active' : ''}`}
                onClick={() => setValue('is_repeating', !isRepeating)}
              >
                {t('chore.repeating')}
              </button>
            </div>
          </div>
          {isRepeating && (
            <>
              <div className="admin-form-group">
                <label>{t('chore.repeat_pattern')}</label>
                <div className="toggle-group">
                  {(['daily', 'weekly'] as const).map((pattern) => (
                    <button
                      key={pattern}
                      type="button"
                      className={`toggle-btn ${repeatPattern === pattern ? 'active' : ''}`}
                      onClick={() => {
                        setValue('repeat_pattern', pattern);
                        // A weekly chore with no days selected would be treated as daily
                        // by the backend, so default to every weekday when switching to weekly.
                        if (pattern === 'weekly' && !(watch('repeat_days')?.length)) {
                          setValue('repeat_days', [...WEEKDAYS]);
                        }
                      }}
                    >
                      {pattern === 'daily' ? t('chore.daily') : t('chore.weekly')}
                    </button>
                  ))}
                </div>
              </div>
              {repeatPattern === 'weekly' && (
                <div className="admin-form-group">
                  <label>{t('chore.repeat_days_label')}</label>
                  <div className="day-toggle-row">
                    {WEEKDAYS.map((day) => {
                      const current = watch('repeat_days') || [];
                      return (
                        <button
                          key={day}
                          type="button"
                          className={`day-toggle ${current.includes(day) ? 'day-toggle-active' : ''}`}
                          onClick={() => {
                            const next = current.includes(day)
                              ? current.filter((d) => d !== day)
                              : [...current, day];
                            setValue('repeat_days', next);
                          }}
                        >
                          {day}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="admin-form-group">
                <label>{t('chore.start_time')}</label>
                <Controller name="start_time" control={control} render={({ field }) => (
                  <TimePicker24h value={field.value ?? ''} onChange={field.onChange} />
                )} />
              </div>
              <div className="admin-form-group">
                <label>{t('chore.window')}</label>
                <div className="toggle-group">
                  {([
                    { label: t('chore.window_none'), value: null },
                    { label: '1h', value: 1 },
                    { label: '2h', value: 2 },
                    { label: '4h', value: 4 },
                    { label: '8h', value: 8 },
                  ] as const).map((opt) => (
                    <button
                      key={String(opt.value)}
                      type="button"
                      className={`toggle-btn ${watch('window_hours') === opt.value ? 'active' : ''}`}
                      onClick={() => setValue('window_hours', opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {errors.window_hours && <div className="field-error">{errors.window_hours.message}</div>}
              </div>
            </>
          )}
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

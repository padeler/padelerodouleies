import { useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAdminUser, updateAdminUser } from '../api/client';
import { useT } from '../i18n/store';
import type { AdminUser, AvatarSelection } from '../lib/types';
import { AvatarPicker } from './AvatarPicker';
import { notifySuccess, notifyError } from '../lib/notify';

// PIN is mandatory when creating a user; on edit it is not submitted at all.
function buildUserSchema(isCreate: boolean) {
  return z
    .object({
      name: z.string().min(1, 'Required').max(100),
      role: z.enum(['admin', 'user']),
      birthdate: z.string().optional(),
      pin: z.string().regex(/^\d{4}$/, '4 digits required').optional(),
    })
    .superRefine((data, ctx) => {
      if (isCreate && !data.pin) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pin'], message: '4 digits required' });
      }
    });
}

type UserForm = {
  name: string;
  role: 'admin' | 'user';
  birthdate?: string;
  pin?: string;
};

interface UserModalProps {
  user?: AdminUser | null;
  onClose: () => void;
}

export function UserModal({ user, onClose }: UserModalProps) {
  const t = useT();
  const qc = useQueryClient();
  const [avatar, setAvatar] = useState<AvatarSelection>({
    kind: user?.avatar_kind ?? 'icon',
    value: user?.avatar_value ?? 'fox',
  });
  const [serverError, setServerError] = useState<string | null>(null);

  const defaultValues: UserForm = {
    name: user?.name ?? '',
    role: user?.role ?? 'user',
    birthdate: user?.birthdate ?? '',
    pin: undefined,
  };

  const schema = useMemo(() => buildUserSchema(!user), [user]);
  const { control, handleSubmit, formState: { errors } } = useForm<UserForm>({
    resolver: zodResolver(schema),
    defaultValues,
  });

  const mutate = useMutation({
    mutationFn: async (data: UserForm) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        role: data.role,
        avatar_kind: avatar.kind,
        avatar_value: avatar.value,
        // Empty string clears the birthdate; otherwise send the ISO date.
        birthdate: data.birthdate ? data.birthdate : null,
      };
      if (user) {
        return updateAdminUser(user.id, payload);
      }
      return createAdminUser({
        ...payload,
        pin: data.pin,
      } as any);
    },
    onSuccess: () => {
      notifySuccess((user ? t('common.edit') : t('user.new')) + ' ✓');
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
    onError: (err) => {
      if (err instanceof Error) {
        setServerError(err.message);
        notifyError(err.message);
      }
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          {user ? t('common.edit') + ': ' + user.name : t('user.new')}
        </h3>
        {serverError && (
          <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(238,85,85,0.15)', borderRadius: 6, color: '#e55', fontSize: 13 }}>
            {serverError}
          </div>
        )}
        <form onSubmit={handleSubmit((data) => mutate.mutate(data))}>
          <div className="admin-form-group">
            <label>{t('bootstrap.name')}</label>
            <Controller name="name" control={control} render={({ field }) => (
              <input {...field} />
            )} />
            {errors.name && <div className="field-error">{errors.name.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>{t('user.role')}</label>
            <Controller name="role" control={control} render={({ field }) => (
              <select {...field}>
                <option value="user">{t('user.role_user')}</option>
                <option value="admin">{t('user.role_admin')}</option>
              </select>
            )} />
          </div>
          <div className="admin-form-group">
            <label>{t('user.birthdate')}</label>
            <Controller name="birthdate" control={control} render={({ field }) => (
              <input type="date" {...field} value={field.value ?? ''} />
            )} />
          </div>
          <div className="admin-form-group">
            <label>{t('user.avatar')}</label>
            <AvatarPicker selected={avatar} onChange={setAvatar} />
          </div>
          {!user && (
            <div className="admin-form-group">
              <label>{t('bootstrap.pin')}</label>
              <Controller name="pin" control={control} render={({ field }) => (
                <input {...field} maxLength={4} />
              )} />
              {errors.pin && <div className="field-error">{errors.pin.message}</div>}
            </div>
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

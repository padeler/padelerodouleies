import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createAdminUser, updateAdminUser } from '../api/client';
import { useT } from '../i18n/store';
import { AdminUser } from '../lib/types';
import { AvatarSelection } from '../lib/types';
import { AvatarPicker } from './AvatarPicker';

const userSchema = z.object({
  name: z.string().min(1, 'Required'),
  role: z.enum(['admin', 'user']),
  pin: z.string().length(4, '4 digits required').regex(/^\d{4}$/, 'PIN must be numeric').optional(),
});

type UserForm = z.infer<typeof userSchema>;

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

  const defaultValues: UserForm = {
    name: user?.name ?? '',
    role: user?.role ?? 'user',
    pin: undefined,
  };

  const { control, handleSubmit, formState: { errors } } = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues,
  });

  const mutate = useMutation({
    mutationFn: async (data: UserForm) => {
      const payload: Record<string, unknown> = {
        name: data.name,
        role: data.role,
        avatar_kind: avatar.kind,
        avatar_value: avatar.value,
      };
      if (user) {
        return updateAdminUser(user.id, payload);
      }
      return createAdminUser({
        ...payload,
        pin: data.pin ?? '0000',
      } as any);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      onClose();
    },
  });

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>
          {user ? t('common.edit') + ': ' + user.name : t('nav.users')}
        </h3>
        <form onSubmit={handleSubmit((data) => mutate.mutate(data))}>
          <div className="admin-form-group">
            <label>{t('bootstrap.name')}</label>
            <Controller name="name" control={control} render={({ field }) => (
              <input {...field} />
            )} />
            {errors.name && <div className="field-error">{errors.name.message}</div>}
          </div>
          <div className="admin-form-group">
            <label>Role</label>
            <Controller name="role" control={control} render={({ field }) => (
              <select {...field}>
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            )} />
          </div>
          <div className="admin-form-group">
            <label>Avatar</label>
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

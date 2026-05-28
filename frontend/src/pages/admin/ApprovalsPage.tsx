import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getPendingClaims, approveClaim, declineClaim } from '../../api/client';
import { useT } from '../../i18n/store';
import type { PendingClaim } from '../../lib/types';
import { useState } from 'react';
import { notifySuccess, notifyCelebration, notifyError } from '../../lib/notify';
import './AdminPage.css';

function ClaimCard({ claim }: { claim: PendingClaim }) {
  const t = useT();
  const qc = useQueryClient();
  const [note, setNote] = useState('');

  const mutate = useMutation({
    mutationFn: (action: 'approve' | 'decline') => {
      if (action === 'approve') return approveClaim(claim.id);
      return declineClaim(claim.id, note || undefined);
    },
    onSuccess: () => {
      notifyCelebration(t('chore.approved'));
      qc.invalidateQueries({ queryKey: ['pending-claims'] });
      qc.invalidateQueries({ queryKey: ['pending-count'] });
    },
    onError: (err) => {
      notifyError(err.message || t('common.error'));
    },
  });

  return (
    <div className="admin-card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <img
          src={claim.user_avatar_kind === 'image' ? claim.user_avatar_value : `/api/icons/svg/${claim.user_avatar_value}`}
          alt=""
          style={{ width: 32, height: 32, borderRadius: claim.user_avatar_kind === 'image' ? '50%' : 0, objectFit: 'cover' }}
        />
        <strong>{claim.user_name}</strong>
        <span style={{ color: 'var(--accent)' }}>+{claim.points_value} ⭐</span>
      </div>
      <div style={{ marginBottom: 8, fontSize: 14 }}>
        <img src={claim.chore_icon.startsWith('/') ? claim.chore_icon : `/api/icons/svg/${claim.chore_icon}`} alt="" style={{ width: 20, height: 20, verticalAlign: 'middle', marginRight: 6 }} />
        {t('chore.label')}
        {' — '}
        {claim.chore_title}
      </div>
      <textarea
        placeholder={t('admin.reason_placeholder')}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        style={{ width: '100%', marginBottom: 8, boxSizing: 'border-box', padding: '6px 8px' }}
        rows={2}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          className="admin-btn admin-btn-success"
          onClick={() => mutate.mutate('approve')}
          disabled={mutate.isPending}
        >
          <span className="btn-icon">✓</span>
          <span className="btn-text">{t('btn.approve')}</span>
        </button>
        <button
          className="admin-btn admin-btn-danger"
          onClick={() => mutate.mutate('decline')}
          disabled={mutate.isPending}
        >
          <span className="btn-icon">✕</span>
          <span className="btn-text">{t('btn.decline')}</span>
        </button>
      </div>
    </div>
  );
}

export function ApprovalsPage() {
  const t = useT();
  const { data, isLoading, error } = useQuery({
    queryKey: ['pending-claims'],
    queryFn: getPendingClaims,
  });

  if (isLoading) return <div>{t('common.loading')}</div>;
  if (error) return <div style={{ color: '#e55' }}>Error loading claims: {error instanceof Error ? error.message : String(error)}</div>;

  return (
    <div>
      <h2 className="admin-page-title">{t('nav.approvals')}</h2>
      {data?.length === 0 ? (
        <div style={{ color: 'var(--text-muted, #888)' }}>No pending claims</div>
      ) : (
        (data as PendingClaim[])?.map((claim) => (
          <ClaimCard key={claim.id} claim={claim} />
        ))
      )}
    </div>
  );
}

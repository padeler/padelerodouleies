import { useState } from 'react';
import { useT } from '../i18n/store';
import type { AvatarSelection } from '../lib/types';
import { IconPicker } from './IconPicker';
import { uploadAvatar } from '../api/client';
import './AvatarPicker.css';

interface AvatarPickerProps {
  selected?: AvatarSelection;
  onChange: (avatar: AvatarSelection) => void;
}

export function AvatarPicker({ selected, onChange }: AvatarPickerProps) {
  const t = useT();
  const [tab, setTab] = useState<'icon' | 'upload'>('icon');
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleIconSelect = (name: string) => {
    onChange({ kind: 'icon', value: name });
    setPreview(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const resp = await uploadAvatar(file);
      onChange({ kind: 'image', value: resp.url });
      setPreview(resp.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('icon_picker.upload_failed'));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="avatar-picker">
      <div className="avatar-picker-tabs">
        <button
          type="button"
          className={`avatar-picker-tab ${tab === 'icon' ? 'active' : ''}`}
          onClick={() => setTab('icon')}
        >
          <span className="btn-icon">✦</span>
          <span className="btn-text">{t('icon_picker.tab_icon')}</span>
        </button>
        <button
          type="button"
          className={`avatar-picker-tab ${tab === 'upload' ? 'active' : ''}`}
          onClick={() => setTab('upload')}
        >
          <span className="btn-icon">⬆</span>
          <span className="btn-text">{t('icon_picker.tab_upload')}</span>
        </button>
      </div>
      {tab === 'icon' ? (
        <IconPicker
          selected={tab === 'icon' && selected?.kind === 'icon' ? selected.value : undefined}
          onChange={handleIconSelect}
        />
      ) : (
        <div className="avatar-picker-upload">
          <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
          {uploading && <div className="avatar-picker-status">{t('icon_picker.uploading')}</div>}
          {error && <div className="avatar-picker-error">{error}</div>}
          {preview && !uploading && (
            <img src={preview} alt="Preview" className="avatar-picker-preview" />
          )}
        </div>
      )}
    </div>
  );
}

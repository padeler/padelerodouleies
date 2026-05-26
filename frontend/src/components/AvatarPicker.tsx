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

  const handleIconSelect = (name: string) => {
    onChange({ kind: 'icon', value: name });
    setPreview(null);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const resp = await uploadAvatar(file);
      onChange({ kind: 'image', value: resp.url });
      setPreview(resp.url);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload failed');
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
          {t('icon_picker.tab_icon')}
        </button>
        <button
          type="button"
          className={`avatar-picker-tab ${tab === 'upload' ? 'active' : ''}`}
          onClick={() => setTab('upload')}
        >
          {t('icon_picker.tab_upload')}
        </button>
      </div>
      {tab === 'icon' ? (
        <IconPicker
          selected={tab === 'icon' && selected?.kind === 'icon' ? selected.value : undefined}
          onChange={handleIconSelect}
        />
      ) : (
        <div className="avatar-picker-upload">
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleFileChange} />
          {preview && (
            <img src={preview} alt="Preview" className="avatar-picker-preview" />
          )}
        </div>
      )}
    </div>
  );
}

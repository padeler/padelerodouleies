import { useMemo } from 'react';
import { useT } from '../i18n/store';

interface TimePicker24hProps {
  value: string;
  onChange: (value: string) => void;
}

export function TimePicker24h({ value, onChange }: TimePicker24hProps) {
  const t = useT();

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 60 }, (_, i) => i), []);

  const isEmpty = !value || value === '';
  const [hourStr, minuteStr] = (value || '00:00').split(':');
  const hour = hourStr ? parseInt(hourStr, 10) : 0;
  const minute = minuteStr ? parseInt(minuteStr, 10) : 0;

  const buildValue = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

  return (
    <div className="time-picker-24h">
      <select
        value={isEmpty ? '' : (isNaN(hour) ? '' : hour)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') {
            onChange('');
          } else {
            onChange(buildValue(Number(v), minute));
          }
        }}
      >
        <option value="">--</option>
        {hours.map((h) => (
          <option key={h} value={h}>
            {String(h).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span className="time-picker-sep">:</span>
      <select
        value={isEmpty ? '' : (isNaN(minute) ? '' : minute)}
        onChange={(e) => {
          const v = e.target.value;
          if (v === '') {
            onChange('');
          } else {
            onChange(buildValue(hour, Number(v)));
          }
        }}
      >
        <option value="">--</option>
        {minutes.map((m) => (
          <option key={m} value={m}>
            {String(m).padStart(2, '0')}
          </option>
        ))}
      </select>
      <span className="time-picker-label">{t('chore.time_optional')}</span>
    </div>
  );
}

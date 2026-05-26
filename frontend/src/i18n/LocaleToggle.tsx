import React from 'react';
import { useI18nStore } from './store';

const LocaleToggle: React.FC = () => {
  const { locale, setLocale } = useI18nStore();
  const next: 'el' | 'en' = locale === 'el' ? 'en' : 'el';

  return (
    <button
      onClick={() => setLocale(next)}
      style={{
        padding: '4px 12px',
        border: '1px solid #ccc',
        borderRadius: 4,
        background: '#fff',
        cursor: 'pointer',
        fontWeight: 'bold',
      }}
    >
      {next.toUpperCase()}
    </button>
  );
};

export default LocaleToggle;

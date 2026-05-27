import React from 'react';
import { useI18nStore } from './store';
import './LocaleToggle.css';

const LocaleToggle: React.FC = () => {
  const { locale, setLocale } = useI18nStore();
  const next: 'el' | 'en' = locale === 'el' ? 'en' : 'el';

  return (
    <button
      className="locale-toggle"
      onClick={() => setLocale(next)}
      type="button"
    >
      {next.toUpperCase()}
    </button>
  );
};

export default LocaleToggle;

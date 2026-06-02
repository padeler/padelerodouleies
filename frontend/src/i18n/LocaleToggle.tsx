import React from 'react';
import { useI18nStore } from './store';
import './LocaleToggle.css';

const NATIVE_NAME: Record<'el' | 'en', string> = {
  el: 'Ελληνικά',
  en: 'English',
};

const LocaleToggle: React.FC = () => {
  const { locale, setLocale } = useI18nStore();
  const next: 'el' | 'en' = locale === 'el' ? 'en' : 'el';

  return (
    <button
      className="locale-toggle"
      onClick={() => setLocale(next)}
      type="button"
      title={NATIVE_NAME[next]}
    >
      <span className="btn-icon">🌐</span>
      <span className="btn-text">{NATIVE_NAME[next]}</span>
    </button>
  );
};

export default LocaleToggle;

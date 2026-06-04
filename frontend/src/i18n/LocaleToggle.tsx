import React from 'react';
import { useI18nStore } from './store';
import './LocaleToggle.css';

const NATIVE_NAME: Record<'el' | 'en', string> = {
  el: 'Ελληνικά',
  en: 'English',
};

// Monochrome globe (Lucide "globe"); uses currentColor so it stays black/white per theme.
const GlobeIcon: React.FC = () => (
  <svg
    className="btn-icon locale-globe"
    xmlns="http://www.w3.org/2000/svg"
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

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
      <GlobeIcon />
      <span className="btn-text">{NATIVE_NAME[next]}</span>
    </button>
  );
};

export default LocaleToggle;

import { create } from 'zustand';
import { useCallback } from 'react';

type Locale = 'el' | 'en';

interface I18nState {
  locale: Locale;
  translations: Record<string, Record<string, string>>;
  setLocale: (locale: Locale) => void;
  setTranslations: (translations: Record<string, Record<string, string>>) => void;
  t: (key: string, params?: Record<string, string>) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: 'el',
  translations: {},
  setLocale: (locale) => set({ locale }),
  setTranslations: (translations) => set({ translations }),
  t: (key: string, params?: Record<string, string>) => {
    const { translations, locale } = get();
    const entry = translations[key];
    if (!entry) {
      return `[${key}]`;
    }
    let result = entry[locale] ?? entry.el;
    if (!result) {
      return `[${key}]`;
    }
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, v);
      }
    }
    return result;
  },
}));

export function useT() {
  const locale = useI18nStore((s) => s.locale);
  const translations = useI18nStore((s) => s.translations);
  return useCallback((key: string, params?: Record<string, string>): string => {
    const entry = translations[key];
    if (!entry) return `[${key}]`;
    let result = entry[locale] ?? entry.el;
    if (!result) return `[${key}]`;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        result = result.replace(`{${k}}`, v);
      }
    }
    return result;
  }, [locale, translations]);
}

export function useLocale() {
  return useI18nStore((s) => s.locale);
}

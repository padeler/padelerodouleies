import { create } from 'zustand';

type Locale = 'el' | 'en';

interface I18nState {
  locale: Locale;
  translations: Record<string, Record<string, string>>;
  setLocale: (locale: Locale) => void;
  setTranslations: (translations: Record<string, Record<string, string>>) => void;
  t: (key: string) => string;
}

export const useI18nStore = create<I18nState>((set, get) => ({
  locale: 'el',
  translations: {},
  setLocale: (locale) => set({ locale }),
  setTranslations: (translations) => set({ translations }),
  t: (key: string) => {
    const { translations, locale } = get();
    const entry = translations[key];
    if (!entry) {
      throw new Error(`Missing translation key: ${key}`);
    }
    return entry[locale] ?? entry.el;
  },
}));

export function useT() {
  return useI18nStore((s) => s.t);
}

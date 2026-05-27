import { describe, expect, it, afterEach } from 'vitest';
import { useI18nStore } from './store';

describe('i18n store', () => {
  afterEach(() => {
    useI18nStore.getState().setLocale('el');
    useI18nStore.getState().setTranslations({});
  });

  it('defaults to Greek locale', () => {
    expect(useI18nStore.getState().locale).toBe('el');
  });

  it('sets locale', () => {
    useI18nStore.getState().setLocale('en');
    expect(useI18nStore.getState().locale).toBe('en');
  });

  it('returns translation for existing key in current locale', () => {
    useI18nStore.getState().setTranslations({
      'greeting.hello': { el: 'Γεια', en: 'Hello' },
    });
    expect(useI18nStore.getState().t('greeting.hello')).toBe('Γεια');
  });

  it('returns English value when locale is en', () => {
    useI18nStore.getState().setLocale('en');
    useI18nStore.getState().setTranslations({
      'greeting.hello': { el: 'Γεια', en: 'Hello' },
    });
    expect(useI18nStore.getState().t('greeting.hello')).toBe('Hello');
  });

  it('throws on missing translation key', () => {
    useI18nStore.getState().setTranslations({});
    expect(() => useI18nStore.getState().t('nonexistent.key')).toThrow('Missing translation key: nonexistent.key');
  });

  it('throws when both locales missing', () => {
    useI18nStore.getState().setTranslations({
      'broken': { el: undefined as any, en: undefined as any },
    });
    expect(() => useI18nStore.getState().t('broken')).toThrow('Missing translation key: broken');
  });
});

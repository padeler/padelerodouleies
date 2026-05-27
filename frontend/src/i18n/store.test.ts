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

  it('returns bracketed key on missing translation key', () => {
    useI18nStore.getState().setTranslations({});
    expect(useI18nStore.getState().t('nonexistent.key')).toBe('[nonexistent.key]');
  });

  it('returns bracketed key when both locales missing', () => {
    useI18nStore.getState().setTranslations({
      'broken': { el: undefined as any, en: undefined as any },
    });
    expect(useI18nStore.getState().t('broken')).toBe('[broken]');
  });

  it('interpolates params into translation string', () => {
    useI18nStore.getState().setTranslations({
      'greeting': { el: 'Γεια {name}', en: 'Hello {name}' },
    });
    expect(useI18nStore.getState().t('greeting', { name: 'Dimitris' })).toBe('Γεια Dimitris');
  });

  it('returns English fallback when locale missing', () => {
    useI18nStore.getState().setTranslations({
      'partial': { el: 'Greek', en: 'English' },
    });
    useI18nStore.getState().setLocale('en');
    expect(useI18nStore.getState().t('partial')).toBe('English');
    useI18nStore.getState().setTranslations({
      'el-only': { el: 'Only Greek' },
    });
    expect(useI18nStore.getState().t('el-only')).toBe('Only Greek');
  });
});

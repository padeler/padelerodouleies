import { describe, expect, it } from 'vitest';
import { normalizeSearchTerm } from './search';

describe('normalizeSearchTerm', () => {
  it('lowercases', () => {
    expect(normalizeSearchTerm('HELLO')).toBe('hello');
  });

  it('strips Greek diacritics', () => {
    expect(normalizeSearchTerm('δόντι')).toBe('δοντι');
    expect(normalizeSearchTerm('Δόντι')).toBe('δοντι');
  });

  it('handles mixed case with accents', () => {
    expect(normalizeSearchTerm('ΔΟΝΤΙ')).toBe('δοντι');
  });

  it('preserves non-accented characters', () => {
    expect(normalizeSearchTerm('brush')).toBe('brush');
  });

  it('handles empty string', () => {
    expect(normalizeSearchTerm('')).toBe('');
  });
});

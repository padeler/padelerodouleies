/**
 * Date/time formatting helpers.
 *
 * Backend timestamps are stored as naive UTC (no timezone suffix), so a raw
 * `new Date("2026-06-02T10:00:00")` would be parsed as the browser's local time
 * and render incorrectly. We normalize such strings to UTC and always render in
 * the Athens timezone, which is the single locale this app runs in.
 */

export const APP_TIMEZONE = 'Europe/Athens';

/** Parse a backend timestamp, treating naive (suffix-less) strings as UTC. */
export function parseUtc(value: string): Date {
  // Already carries a timezone designator (Z or ±HH:MM) → trust it as-is.
  const hasTimezone = /[zZ]|[+-]\d{2}:?\d{2}$/.test(value);
  return new Date(hasTimezone ? value : `${value}Z`);
}

/**
 * Format a date-only string (YYYY-MM-DD) as a short localized day+month.
 * Parsed from its parts to avoid any timezone shifting (a date-only string has
 * no time component, so it must not be normalized to UTC midnight).
 */
export function formatDateShort(value: string, locale: 'el' | 'en' = 'el'): string {
  const [year, month, day] = value.split('-').map(Number);
  const d = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
  return d.toLocaleDateString(locale === 'el' ? 'el-GR' : 'en-US', {
    day: '2-digit',
    month: 'short',
  });
}

/**
 * Format a future timestamp as a localized relative phrase from now
 * (e.g. "in 5 hours" / "σε 5 ώρες"). Picks minutes under an hour, hours under a
 * day, then days — letting Intl.RelativeTimeFormat handle pluralization.
 */
export function formatRelativeFromNow(value: string, locale: 'el' | 'en' = 'el'): string {
  const diffMs = parseUtc(value).getTime() - Date.now();
  const rtf = new Intl.RelativeTimeFormat(locale === 'el' ? 'el-GR' : 'en-US', {
    numeric: 'auto',
  });
  const diffMin = Math.round(diffMs / 60_000);
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, 'minute');
  const diffHours = Math.round(diffMs / 3_600_000);
  if (Math.abs(diffHours) < 24) return rtf.format(diffHours, 'hour');
  return rtf.format(Math.round(diffMs / 86_400_000), 'day');
}

/** Format a backend timestamp as a localized date+time string in Athens time. */
export function formatDateTime(value: string, locale: 'el' | 'en' = 'el'): string {
  return parseUtc(value).toLocaleString(locale === 'el' ? 'el-GR' : 'en-US', {
    timeZone: APP_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Per-user accent color support.
 *
 * Users pick one of a fixed palette of swatches; the chosen color overrides the
 * `--accent` family of CSS variables on the document root (taking precedence
 * over the theme defaults defined in index.css). A null choice clears the
 * override and falls back to the theme default.
 *
 * The hex values here MUST stay in sync with `_ALLOWED_ACCENTS` in
 * `backend/app/api/auth.py`.
 */

export const ACCENT_SWATCHES: readonly string[] = [
  '#aa3bff', // purple (default)
  '#4d96ff', // blue
  '#00b894', // green
  '#ff6bb5', // pink
  '#ff922b', // orange
  '#ef4444', // red
  '#14b8a6', // teal
  '#f5b301', // amber
];

/** Convert a "#RRGGBB" string to an "r, g, b" channel triplet. */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `${r}, ${g}, ${b}`;
}

/**
 * Darken a "#RRGGBB" color by scaling each channel toward black. Used to derive
 * a deep, hue-preserving sidebar tint that stays dark enough for light text to
 * remain readable on top of it. Factor is in [0, 1] (lower = darker).
 */
function darkenRgb(hex: string, factor: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * factor);
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * factor);
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * factor);
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Lighten a "#RRGGBB" color by mixing each channel toward white. Used to derive
 * hue-matched background-glow tints from the accent. Amount is in [0, 1]
 * (higher = lighter).
 */
function lightenRgb(hex: string, amount: number): string {
  const mix = (c: number) => Math.round(c + (255 - c) * amount);
  const r = mix(parseInt(hex.slice(1, 3), 16));
  const g = mix(parseInt(hex.slice(3, 5), 16));
  const b = mix(parseInt(hex.slice(5, 7), 16));
  return `rgb(${r}, ${g}, ${b})`;
}

/**
 * Apply (or clear) the accent override on <html>. Passing null/undefined removes
 * the inline override so the theme default from index.css applies again.
 */
export function applyAccent(color: string | null | undefined): void {
  const root = document.documentElement;
  if (!color) {
    root.style.removeProperty('--accent');
    root.style.removeProperty('--accent-bg');
    root.style.removeProperty('--accent-border');
    root.style.removeProperty('--accent-strong');
    root.style.removeProperty('--accent-sidebar');
    root.style.removeProperty('--accent-sidebar-2');
    root.style.removeProperty('--bg-accent-1');
    root.style.removeProperty('--bg-accent-2');
    root.style.removeProperty('--bg-accent-3');
    return;
  }
  const rgb = hexToRgb(color);
  root.style.setProperty('--accent', color);
  root.style.setProperty('--accent-bg', `rgba(${rgb}, 0.12)`);
  root.style.setProperty('--accent-border', `rgba(${rgb}, 0.5)`);
  // Darker, hue-matched shade for gradient depth (e.g. the claim button).
  root.style.setProperty('--accent-strong', darkenRgb(color, 0.7));
  // Deep, hue-matched sidebar gradient (top lighter, bottom darker); kept dark
  // so the sidebar's light text stays legible regardless of the chosen accent.
  root.style.setProperty('--accent-sidebar', darkenRgb(color, 0.32));
  root.style.setProperty('--accent-sidebar-2', darkenRgb(color, 0.18));
  // Three hue-matched tints drive the decorative page-background glow, overriding
  // the per-tab defaults so the background follows the chosen accent.
  root.style.setProperty('--bg-accent-1', color);
  root.style.setProperty('--bg-accent-2', lightenRgb(color, 0.45));
  root.style.setProperty('--bg-accent-3', lightenRgb(color, 0.2));
}

/** Time-of-day theme: dark (Carbon g100) between 20:00 and 04:00, light (g10) otherwise. */

const NIGHT_START = 20;
const NIGHT_END = 4;

function nightNow(now = new Date()): boolean {
  const hour = now.getHours();
  return hour >= NIGHT_START || hour < NIGHT_END;
}

export const themeState = $state({ dark: nightNow() });

/**
 * Drive Carbon's built-in theme switching (`css/all.css` scopes every theme
 * under `:root[theme=…]`); re-check the clock so the UI flips without reload.
 */
export function initTheme(): void {
  const apply = () => {
    themeState.dark = nightNow();
    document.documentElement.setAttribute(
      'theme',
      themeState.dark ? 'g100' : 'g10',
    );
  };
  apply();
  setInterval(apply, 60_000);
}

/** Read a theme CSS variable from the document root (ECharts needs real colors). */
export function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  return value || fallback;
}

/** cssVar with an alpha channel for gradient fills. */
export function cssVarA(name: string, fallback: string, alpha: number): string {
  const hex = cssVar(name, fallback);
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

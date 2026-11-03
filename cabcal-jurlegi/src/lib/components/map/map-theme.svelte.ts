import { themeState } from '../../state/theme.svelte';

/** Day palette: Carbon light-blue presentation colors for SVG and Three.js. */
const light = {
  background: '#edf4fc',
  building: '#d0e2ff',
  facade: '#a6c8ff',
  border: '#78a9ff',
  text: '#0043ce',
  labelBackground: '#ffffff',
  labelText: '#161616',
  labelAlarmBackground: '#fff1f1',
  accent: '#0f62fe',
  online: '#198038',
  offline: '#6f6f6f',
  warning: '#8e6a00',
  danger: '#da1e28',
  clear: '#edf4fc',
} as const;

/** Night palette (20:00–04:00): the original dark Carbon presentation colors. */
const dark = {
  background: '#262626',
  building: '#393939',
  facade: '#525252',
  border: '#6f6f6f',
  text: '#f4f4f4',
  labelBackground: '#161616',
  labelText: '#f4f4f4',
  labelAlarmBackground: 'rgba(127, 29, 29, 0.92)',
  accent: '#78a9ff',
  online: '#42be65',
  offline: '#a8a8a8',
  warning: '#f1c21b',
  danger: '#ff8389',
  clear: '#161616',
} as const;

function active() {
  return themeState.dark ? dark : light;
}

/**
 * Active palette; follows the time-of-day theme without a reload.
 * Getters re-read `themeState` on every access, so template/effect consumers
 * stay reactive. (Modules cannot export `$derived` directly.)
 */
export const mapTheme = {
  get background() { return active().background; },
  get building() { return active().building; },
  get facade() { return active().facade; },
  get border() { return active().border; },
  get text() { return active().text; },
  get labelBackground() { return active().labelBackground; },
  get labelText() { return active().labelText; },
  get labelAlarmBackground() { return active().labelAlarmBackground; },
  get accent() { return active().accent; },
  get online() { return active().online; },
  get offline() { return active().offline; },
  get warning() { return active().warning; },
  get danger() { return active().danger; },
  get clear() { return active().clear; },
};

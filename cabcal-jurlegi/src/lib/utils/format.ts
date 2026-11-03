/**
 * Display formatting for metric values.
 *
 * Gamma dose rates are displayed in nSv/h (the RMS-200 manual allows nSv/h
 * or nGy/h for the same numeric scale; this site reports nSv/h). Values
 * above 1000 nSv/h are shown as x.xx μSv/h.
 */
export interface MetricDisplay {
  value: string;
  unit: string;
}

/** Normalize a raw unit string for display (legacy nGy/h → nSv/h). */
export function displayUnit(unit: string): string {
  return unit === 'nGy/h' ? 'nSv/h' : unit;
}

/** Format a metric value with its unit for display. */
export function formatMetric(value: number, unit: string): MetricDisplay {
  const u = displayUnit(unit);
  if (!Number.isFinite(value)) return { value: '—', unit: u };
  if (u === 'nSv/h' && Math.abs(value) > 1000) {
    return { value: (value / 1000).toFixed(2), unit: 'μSv/h' };
  }
  const abs = Math.abs(value);
  if (abs >= 10000) return { value: value.toExponential(2), unit: u };
  return { value: value.toFixed(1), unit: u };
}

/** One-line engineering readout: "328.5 nSv/h" / "1.04 μSv/h". */
export function formatMetricText(value: number, unit: string): string {
  const d = formatMetric(value, unit);
  return `${d.value} ${d.unit}`;
}

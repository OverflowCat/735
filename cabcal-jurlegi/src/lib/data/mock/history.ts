import type { HistoricalPoint } from '../../types/device';
import type { HistoryQuery, TimeRange } from '../../services/data-source';

const RELATIVE_MS: Record<TimeRange, number> = {
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
};

function generateTimeSeries(
  startMs: number,
  endMs: number,
  baseValue: number,
  variance: number,
  trend: number,
): HistoricalPoint[] {
  const total = Math.max(1, endMs - startMs);
  // Aim for ~200–500 points regardless of window length.
  const step = Math.max(10_000, Math.floor(total / 300));
  const count = Math.min(Math.floor(total / step), 500);
  const points: HistoricalPoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = startMs + i * step;
    const noise = (Math.random() - 0.5) * 2 * variance;
    const drift = trend * (i / Math.max(1, count));
    points.push({ timestamp: t, value: Math.max(0, baseValue + noise + drift) });
  }
  return points;
}

const historyGenerators: Record<
  string,
  (startMs: number, endMs: number) => HistoricalPoint[]
> = {
  'dev-gamma-001:0102060301': (s, e) => generateTimeSeries(s, e, 85, 15, 5),
  'dev-gamma-002:0102060301': (s, e) => generateTimeSeries(s, e, 240, 40, 30),
  'dev-radon-001:0102060302': (s, e) => generateTimeSeries(s, e, 180, 30, 10),
  'dev-radon-002:0102060302': (s, e) => generateTimeSeries(s, e, 1100, 150, 200),
  'dev-gamma-003:0102060301': (s, e) => generateTimeSeries(s, e, 62, 10, -3),
  'dev-radon-003:0102060302': (s, e) => generateTimeSeries(s, e, 50, 20, 0),
  'dev-gamma-004:0102060301': (s, e) => generateTimeSeries(s, e, 45, 8, 2),
};

function resolveWindow(query: HistoryQuery): { startMs: number; endMs: number } {
  if (query.kind === 'absolute') {
    return { startMs: query.startMs, endMs: query.endMs };
  }
  const endMs = Date.now();
  return { startMs: endMs - RELATIVE_MS[query.range], endMs };
}

export function getMockHistory(
  deviceId: string,
  metric: string,
  query: HistoryQuery,
): HistoricalPoint[] {
  const { startMs, endMs } = resolveWindow(query);
  const key = `${deviceId}:${metric}`;
  const gen = historyGenerators[key];
  if (gen) return gen(startMs, endMs);
  return generateTimeSeries(startMs, endMs, 100, 20, 0);
}

import type { HistoricalPoint } from '../../types/device';
import type { TimeRange } from '../../services/data-source';

function generateTimeSeries(
  range: TimeRange,
  baseValue: number,
  variance: number,
  trend: number,
): HistoricalPoint[] {
  const now = Date.now();
  const rangeMs: Record<TimeRange, number> = {
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
  };
  const intervalMs: Record<TimeRange, number> = {
    '15m': 10_000,
    '1h': 60_000,
    '24h': 10 * 60_000,
    '7d': 60 * 60_000,
  };
  const total = rangeMs[range];
  const step = intervalMs[range];
  const count = Math.min(Math.floor(total / step), 500);
  const points: HistoricalPoint[] = [];
  for (let i = 0; i < count; i++) {
    const t = now - total + i * step;
    const noise = (Math.random() - 0.5) * 2 * variance;
    const drift = trend * (i / count);
    points.push({ timestamp: t, value: Math.max(0, baseValue + noise + drift) });
  }
  return points;
}

const historyGenerators: Record<string, (range: TimeRange) => HistoricalPoint[]> = {
  'dev-gamma-001:0102060301': (r) => generateTimeSeries(r, 85, 15, 5),
  'dev-gamma-002:0102060301': (r) => generateTimeSeries(r, 240, 40, 30),
  'dev-radon-001:0102060302': (r) => generateTimeSeries(r, 180, 30, 10),
  'dev-radon-002:0102060302': (r) => generateTimeSeries(r, 1100, 150, 200),
  'dev-gamma-003:0102060301': (r) => generateTimeSeries(r, 62, 10, -3),
  'dev-radon-003:0102060302': (r) => generateTimeSeries(r, 50, 20, 0),
  'dev-gamma-004:0102060301': (r) => generateTimeSeries(r, 45, 8, 2),
};

export function getMockHistory(
  deviceId: string,
  metric: string,
  range: TimeRange,
): HistoricalPoint[] {
  const key = `${deviceId}:${metric}`;
  const gen = historyGenerators[key];
  if (gen) return gen(range);
  return generateTimeSeries(range, 100, 20, 0);
}

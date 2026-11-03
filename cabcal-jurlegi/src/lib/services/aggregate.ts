import type { HistoricalPoint } from '../types/device';
import { AGGREGATE_MS, type AggregateGranule } from './data-source';

/**
 * Downsample a time series into fixed-width buckets by averaging.
 * `raw` returns the points unchanged. Buckets are aligned to the supplied
 * `startMs` (or the first point) and labelled by their window start.
 */
export function aggregatePoints(
  points: HistoricalPoint[],
  granule: AggregateGranule,
  startMs?: number,
): HistoricalPoint[] {
  if (granule === 'raw' || points.length === 0) return points;
  const width = AGGREGATE_MS[granule];
  const align = startMs ?? points[0].timestamp;
  const buckets = new Map<number, { sum: number; count: number }>();
  for (const p of points) {
    if (!Number.isFinite(p.timestamp) || !Number.isFinite(p.value)) continue;
    // Index relative to alignment so large timestamps don't overflow.
    const idx = Math.floor((p.timestamp - align) / width);
    const bucketStart = align + idx * width;
    const b = buckets.get(bucketStart) ?? { sum: 0, count: 0 };
    b.sum += p.value;
    b.count += 1;
    buckets.set(bucketStart, b);
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([timestamp, { sum, count }]) => ({
      timestamp,
      value: sum / count,
    }));
}

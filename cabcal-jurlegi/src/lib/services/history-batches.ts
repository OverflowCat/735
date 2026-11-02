import type { HistoricalPoint } from '../types/device';
import type { DeviceDataSource, HistoryQuery } from './data-source';

const minute = 60_000;
const durations = {
  '15m': 15 * minute,
  '1h': 60 * minute,
  '24h': 1440 * minute,
  '7d': 10080 * minute,
};
export interface HistoryBatchProgress {
  points: HistoricalPoint[];
  completed: number;
  total: number;
}

/** Freeze "now" once; inclusive API windows cover each millisecond exactly once. */
export function historyWindows(query: HistoryQuery, now = Date.now()) {
  const endMs = query.kind === 'absolute' ? query.endMs : now;
  const startMs =
    query.kind === 'absolute' ? query.startMs : endMs - durations[query.range];
  if (
    !Number.isSafeInteger(startMs) ||
    !Number.isSafeInteger(endMs) ||
    startMs > endMs
  )
    throw new Error('Invalid history window');
  const windows: { kind: 'absolute'; startMs: number; endMs: number }[] = [];
  let end = endMs;
  let span = 15 * minute;
  while (end >= startMs) {
    const start = Math.max(startMs, end - span);
    windows.push({ kind: 'absolute', startMs: start, endMs: end });
    end = start - 1;
    span = Math.min(span * 4, 1440 * minute);
  }
  return windows;
}

/** One request at a time, newest first, publishing each completed batch immediately. */
export async function loadHistoryBatches(
  source: Pick<DeviceDataSource, 'getHistory'>,
  deviceId: string,
  metric: string,
  query: HistoryQuery,
  signal: AbortSignal,
  onBatch: (progress: HistoryBatchProgress) => void,
) {
  const windows = historyWindows(query);
  const points = new Map<number, HistoricalPoint>();
  for (let i = 0; i < windows.length; i++) {
    signal.throwIfAborted();
    const window = windows[i];
    const batch = await source.getHistory(deviceId, metric, window, { signal });
    signal.throwIfAborted();
    for (const p of batch) {
      if (
        Number.isFinite(p.timestamp) &&
        Number.isFinite(p.value) &&
        p.timestamp >= window.startMs &&
        p.timestamp <= window.endMs
      )
        points.set(p.timestamp, p);
    }
    onBatch({
      points: [...points.values()].sort((a, b) => a.timestamp - b.timestamp),
      completed: i + 1,
      total: windows.length,
    });
  }
}

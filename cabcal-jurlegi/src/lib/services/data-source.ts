// Abstract data source interface. Replace MockDeviceDataSource with a real
// implementation that talks to the Rust backend when available.

import type { Device, DeviceHistory, HistoricalPoint } from '../types/device';
import type { FactoryScene } from '../types/scene';

export type TimeRange = '15m' | '1h' | '24h' | '7d';

export const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  '15m': '15分钟',
  '1h': '1小时',
  '24h': '24小时',
  '7d': '7天',
};

/**
 * Aggregation granularity for history downsampling. `raw` keeps every
 * returned point; the rest bucket points into fixed-width windows and
 * average the values within each window.
 */
export type AggregateGranule = 'raw' | '1m' | '5m' | '15m' | '1h' | '1d';

export const AGGREGATE_LABELS: Record<AggregateGranule, string> = {
  raw: '原始数据',
  '1m': '1分钟',
  '5m': '5分钟',
  '15m': '15分钟',
  '1h': '1小时',
  '1d': '1天',
};

export const AGGREGATE_MS: Record<Exclude<AggregateGranule, 'raw'>, number> = {
  '1m': 60 * 1000,
  '5m': 5 * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '1h': 60 * 60 * 1000,
  '1d': 24 * 60 * 60 * 1000,
};

/** History window: relative preset or absolute [startMs, endMs]. */
export type HistoryQuery =
  | { kind: 'relative'; range: TimeRange }
  | { kind: 'absolute'; startMs: number; endMs: number };

export interface HistoryRequestOptions {
  signal?: AbortSignal;
}

export function relativeQuery(range: TimeRange): HistoryQuery {
  return { kind: 'relative', range };
}

export function absoluteQuery(startMs: number, endMs: number): HistoryQuery {
  return { kind: 'absolute', startMs, endMs };
}

export interface DeviceDataSource {
  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  getHistory(
    deviceId: string,
    metric: string,
    query: HistoryQuery,
    options?: HistoryRequestOptions,
  ): Promise<HistoricalPoint[]>;
  getScene(): Promise<FactoryScene>;
  updateScene(scene: FactoryScene): Promise<void>;
}

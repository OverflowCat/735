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

/** History window: relative preset or absolute [startMs, endMs]. */
export type HistoryQuery =
  | { kind: 'relative'; range: TimeRange }
  | { kind: 'absolute'; startMs: number; endMs: number };

export function relativeQuery(range: TimeRange): HistoryQuery {
  return { kind: 'relative', range };
}

export function absoluteQuery(startMs: number, endMs: number): HistoryQuery {
  return { kind: 'absolute', startMs, endMs };
}

export interface DeviceDataSource {
  getDevices(): Promise<Device[]>;
  getDevice(id: string): Promise<Device | undefined>;
  getHistory(deviceId: string, metric: string, query: HistoryQuery): Promise<HistoricalPoint[]>;
  getScene(): Promise<FactoryScene>;
  updateScene(scene: FactoryScene): Promise<void>;
}

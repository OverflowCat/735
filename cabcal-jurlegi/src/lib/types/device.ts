// Domain device model combining protocol data with scene placement.

import type { DeviceType, DeviceStatus, AlarmInfo, MetricData } from './protocol';

export interface Device {
  id: string;
  code: string;
  name: string;
  type: DeviceType;
  station: string;
  status: DeviceStatus;
  metrics: MetricData[];
  lastUpdate: string; // ISO string
  alarms: AlarmInfo[];
}

export interface HistoricalPoint {
  timestamp: number;
  value: number;
}

export interface DeviceHistory {
  deviceId: string;
  metric: string;
  points: HistoricalPoint[];
}

/** Short unique label (asset SN). Field inventory uses SN as `id`; names may be identical. */
export function deviceSn(d: Pick<Device, 'id' | 'code'>): string {
  return d.id || d.code;
}

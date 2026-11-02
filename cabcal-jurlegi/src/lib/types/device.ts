// Domain device model combining protocol data with scene placement.

import type {
  DeviceType,
  DeviceStatus,
  AlarmInfo,
  MetricData,
} from './protocol';

export interface Device {
  id: string;
  name: string;
  type: DeviceType;
  station: string;
  status: DeviceStatus;
  metrics: MetricData[];
  lastUpdate: string; // ISO string
  alarms: AlarmInfo[];
  assetSn?: string;
  unreported?: boolean;
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
export function deviceSn(d: Pick<Device, 'id' | 'assetSn'>): string {
  return d.assetSn || d.id;
}

export function deviceStatusLabel(d: Device): string {
  if (d.unreported) return '未上报';
  return d.status === 'online'
    ? '在线'
    : d.status === 'offline'
      ? '离线'
      : '故障';
}

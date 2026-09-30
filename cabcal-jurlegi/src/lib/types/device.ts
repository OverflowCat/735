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

// Types derived from ../protocol.typ - the source of truth for device communication.

export type DeviceType = 'gamma' | 'radon';

export type DeviceStatus = 'online' | 'offline' | 'fault';

export interface AlarmInfo {
  level: 1 | 2;
  reason: string;
  threshold: { low: number; up: number };
  action: string | null;
}

export interface MetricData {
  metric: string;
  name: string;
  timestamp: string; // ms timestamp string
  value: number;
  unit: string;
  alarm: false | AlarmInfo;
}

export interface DeviceReport {
  station: string;
  device: string;
  metrics: MetricData[];
}

export interface HeartbeatReport {
  station: string;
  device: string;
  type: DeviceType;
  status: DeviceStatus;
  timestamp: string;
}

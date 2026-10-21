import type { Device } from '../../types/device';

const now = Date.now();
const ts = (offset: number) => String(now + offset);

export const mockDevices: Device[] = [
  {
    id: 'dev-gamma-001',
    code: '1-1',
    name: '1-1 γ剂量率监测仪',
    type: 'gamma',
    station: 'STATION-01',
    status: 'online',
    lastUpdate: new Date(now - 5000).toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率实时值',
        timestamp: ts(-5000),
        value: 0.1,
        unit: 'uSv/h',
        alarm: false,
      },
    ],
    alarms: [],
  },
  {
    id: 'dev-radon-001',
    code: '1-2',
    name: '1-2 氡及子体监测仪',
    type: 'radon',
    station: 'STATION-01',
    status: 'online',
    lastUpdate: new Date(now - 12000).toISOString(),
    metrics: [
      {
        metric: '0102060302',
        name: '氡及子体浓度实时值',
        timestamp: ts(-12000),
        value: 5.0,
        unit: 'Bq/m³',
        alarm: false,
      },
    ],
    alarms: [],
  },
  {
    id: 'dev-gamma-002',
    code: 'BR-GAMMA-C19-001',
    name: 'C19厂房 γ监测仪',
    type: 'gamma',
    station: 'STATION-01',
    status: 'online',
    lastUpdate: new Date(now - 8000).toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率实时值',
        timestamp: ts(-8000),
        value: 0.12,
        unit: 'uSv/h',
        alarm: false,
      },
    ],
    alarms: [],
  },
  {
    id: 'dev-radon-002',
    code: 'BR-RADON-C24-002',
    name: '空气测氡仪-D区',
    type: 'radon',
    station: 'STATION-01',
    status: 'online',
    lastUpdate: new Date(now - 6000).toISOString(),
    metrics: [
      {
        metric: '0102060302',
        name: '氡及子体浓度实时值',
        timestamp: ts(-6000),
        value: 1200.0,
        unit: 'Bq/m³',
        alarm: {
          level: 2,
          reason: '氡浓度持续超出二级上限阈值',
          threshold: { low: 100, up: 1000 },
          action: 'vent_start',
        },
      },
    ],
    alarms: [
      {
        level: 2,
        reason: '氡浓度持续超出二级上限阈值',
        threshold: { low: 100, up: 1000 },
        action: 'vent_start',
      },
    ],
  },
  {
    id: 'dev-gamma-003',
    code: 'BR-GAMMA-C3-003',
    name: 'γ剂量率监测仪-E区',
    type: 'gamma',
    station: 'STATION-01',
    status: 'offline',
    lastUpdate: new Date(now - 3600000).toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率实时值',
        timestamp: ts(-3600000),
        value: 62.1,
        unit: 'nGy/h',
        alarm: false,
      },
    ],
    alarms: [],
  },
  {
    id: 'dev-radon-003',
    code: 'BR-RADON-C24-003',
    name: '空气测氡仪-F区',
    type: 'radon',
    station: 'STATION-01',
    status: 'fault',
    lastUpdate: new Date(now - 7200000).toISOString(),
    metrics: [
      {
        metric: '0102060302',
        name: '氡及子体浓度实时值',
        timestamp: ts(-7200000),
        value: 0,
        unit: 'Bq/m³',
        alarm: false,
      },
    ],
    alarms: [],
  },
  {
    id: 'dev-gamma-004',
    code: 'BR-GAMMA-C3-004',
    name: 'γ剂量率监测仪-G区',
    type: 'gamma',
    station: 'STATION-02',
    status: 'online',
    lastUpdate: new Date(now - 3000).toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率实时值',
        timestamp: ts(-3000),
        value: 45.0,
        unit: 'nGy/h',
        alarm: false,
      },
    ],
    alarms: [],
  },
];

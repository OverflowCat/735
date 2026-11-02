import type { Device } from '../../types/device';
import { legacyEndpoints } from '../floorplans/inventory';

const now = Date.now();
const ts = (offset: number) => String(now + offset);

/** Default inventory matching the 20 on-line γ tunnels + shared-bus radon nodes. */
export const mockDevices: Device[] = [
  // 20 γ (order matches backend --gamma argv → gamma_01..gamma_20)
  ...legacyEndpoints.map(([id, ip], i) => ({
    id,
    name: `γ剂量率监测仪-${id.slice(6)}`,
    type: 'gamma' as const,
    station: 'STATION-01',
    status: 'online' as const,
    lastUpdate: new Date(now - 3000 - i * 200).toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率实时值',
        timestamp: ts(-3000 - i * 200),
        value: 250 + ((i * 37) % 900),
        unit: 'nGy/h',
        alarm: false as const,
      },
    ],
    alarms: [],
  })),
  // SN-named field devices (devices.json inventory; paired radon via radonNode)
  ...(
    [
      ['2026012904', 'C19-1 γ剂量率监测仪', 572.5],
      ['2026012928', 'C19-2 γ剂量率监测仪', 2315.0],
      ['2026012914', 'C35-1 γ剂量率监测仪', 3279.0],
      ['2026012903', 'C35-2 γ剂量率监测仪', 277.6],
      ['2026012923', 'C35-3 γ剂量率监测仪', 527.2],
      ['2026012918', '过滤厂房-1 γ剂量率监测仪', 1572.0],
      ['2026012924', '过滤厂房-2 γ剂量率监测仪', 1578.0],
      ['2026012929', '过滤厂房-3 γ剂量率监测仪', 1035.0],
    ] as const
  ).map(([id, name, value], i) => ({
    id,
    name,
    type: 'gamma' as const,
    station: 'STATION-01',
    status: 'online' as const,
    lastUpdate: new Date(now - 2500 - i * 180).toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率实时值',
        timestamp: ts(-2500 - i * 180),
        value,
        unit: 'nGy/h',
        alarm: false as const,
      },
    ],
    alarms: [],
  })),
  // radon nodes discovered on the same buses (node_id → value)
  ...(
    [
      ['radon-35', 91],
      ['radon-39', 7],
      ['radon-32', 6],
      ['radon-38', 10],
      ['radon-34', 17],
      ['radon-31', 16],
      ['radon-30', 105],
      ['radon-33', 79],
    ] as const
  ).map(([id, value], i) => ({
    id,
    name: `空气测氡仪-${id.slice(6)}`,
    type: 'radon' as const,
    station: 'STATION-01',
    status: 'online' as const,
    lastUpdate: new Date(now - 5000 - i * 300).toISOString(),
    metrics: [
      {
        metric: '0102060302',
        name: '氡及子体浓度实时值',
        timestamp: ts(-5000 - i * 300),
        value,
        unit: 'Bq/m³',
        alarm: false as const,
      },
    ],
    alarms: [],
  })),
];

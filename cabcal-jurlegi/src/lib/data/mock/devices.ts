import type { Device } from '../../types/device';
import { legacyEndpoints } from '../floorplans/inventory';

const now = Date.now();
const ts = (offset: number) => now + offset;

/** Default inventory matching the 20 on-line γ tunnels + shared-bus radon nodes. */
export const mockDevices: Device[] = [
  // 20 γ (order matches backend --gamma argv → gamma_01..gamma_20)
  ...legacyEndpoints.map(([id, ip], i) => ({
    id,
    name: `γ剂量率监测仪-${id.slice(6)}`,
    type: 'gamma' as const,
    station: '水冶厂',
    status: 'online' as const,
    lastUpdate: new Date(now - 3000 - i * 200).toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率实时值',
        timestamp: ts(-3000 - i * 200),
        value: 250 + ((i * 37) % 900),
        unit: 'nSv/h',
        alarm: false as const,
      },
    ],
    alarms: [],
  })),
  // SN-named field devices (devices.json inventory; paired radon via radonNode)
  ...(
    [
      ['2026012904', 'C19-1 γ剂量率监测仪', 'C19', 572.5],
      ['2026012928', 'C19-2 γ剂量率监测仪', 'C19', 2315.0],
      ['2026012914', 'C35-1 γ剂量率监测仪', 'C35', 3279.0],
      ['2026012903', 'C35-2 γ剂量率监测仪', 'C35', 277.6],
      ['2026012923', 'C35-3 γ剂量率监测仪', 'C35', 527.2],
      ['2026012918', '过滤厂房-1 γ剂量率监测仪', 'JZGL', 1572.0],
      ['2026012924', '过滤厂房-2 γ剂量率监测仪', 'JZGL', 1578.0],
      ['2026012929', '过滤厂房-3 γ剂量率监测仪', 'JZGL', 1035.0],
    ] as const
  ).map(([id, name, station, value], i) => ({
    id,
    name,
    type: 'gamma' as const,
    station,
    status: 'online' as const,
    lastUpdate: new Date(now - 2500 - i * 180).toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率实时值',
        timestamp: ts(-2500 - i * 180),
        value,
        unit: 'nSv/h',
        alarm: false as const,
      },
    ],
    alarms: [],
  })),
  // radon nodes discovered on the same buses (node_id → value)
  // station follows the bus owner's 厂房 (AGENTS.md 氡节点归属)
  ...(
    [
      ['radon-35', 'C19', 91],
      ['radon-39', '水冶厂', 7],
      ['radon-32', '水冶厂', 6],
      ['radon-38', 'C35', 10],
      ['radon-34', '水冶厂', 17],
      ['radon-31', '水冶厂', 16],
      ['radon-30', '水冶厂', 105],
      ['radon-33', '水冶厂', 79],
    ] as const
  ).map(([id, station, value], i) => ({
    id,
    name: `空气测氡仪-${id.slice(6)}`,
    type: 'radon' as const,
    station,
    status: 'online' as const,
    lastUpdate: new Date(now - 5000 - i * 300).toISOString(),
    metrics: [
      {
        metric: '0102060302',
        name: '氡及子体浓度实时值',
        timestamp: ts(-5000 - i * 300),
        value,
        unit: 'Bq/m3',
        alarm: false as const,
      },
    ],
    alarms: [],
  })),
];

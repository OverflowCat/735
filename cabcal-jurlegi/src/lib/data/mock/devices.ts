import type { Device } from '../../types/device';

const now = Date.now();
const ts = (offset: number) => String(now + offset);

/** Default inventory matching the 20 on-line γ tunnels + shared-bus radon nodes. */
export const mockDevices: Device[] = [
  // 20 γ (order matches backend --gamma argv → gamma_01..gamma_20)
  ...([
    ['gamma_01', '192.168.10.11'],
    ['gamma_02', '192.168.10.12'],
    ['gamma_03', '192.168.10.16'],
    ['gamma_04', '192.168.10.17'],
    ['gamma_05', '192.168.10.18'],
    ['gamma_06', '192.168.10.19'],
    ['gamma_07', '192.168.10.20'],
    ['gamma_08', '192.168.10.21'],
    ['gamma_09', '192.168.10.22'],
    ['gamma_10', '192.168.10.23'],
    ['gamma_11', '192.168.10.25'],
    ['gamma_12', '192.168.10.26'],
    ['gamma_13', '192.168.10.29'],
    ['gamma_14', '192.168.10.30'],
    ['gamma_15', '192.168.10.31'],
    ['gamma_16', '192.168.10.32'],
    ['gamma_17', '192.168.10.35'],
    ['gamma_18', '192.168.10.36'],
    ['gamma_19', '192.168.10.37'],
    ['gamma_20', '192.168.10.40'],
  ] as const).map(([id, ip], i) => ({
    id,
    code: `BR-GAMMA-${id}`,
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
  // radon nodes discovered on the same buses (node_id → value)
  ...([
    ['radon-39', 7],
    ['radon-32', 6],
    ['radon-38', 10],
    ['radon-34', 17],
    ['radon-31', 16],
    ['radon-30', 105],
    ['radon-33', 79],
  ] as const).map(([id, value], i) => ({
    id,
    code: `BR-RADON-C24-${id.slice(6).padStart(3, '0')}`,
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

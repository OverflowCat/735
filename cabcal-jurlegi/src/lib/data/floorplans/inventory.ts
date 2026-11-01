import configuredDevices from '../../../../../devices.json';
import type { Device } from '../../types/device';

// Legacy IDs are assigned by --gamma argument order; never derive them from SN.
export const legacyEndpoints = [
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
] as const;

export const gammaInventory = [
  ...legacyEndpoints.map(([id, ip]) => ({
    id,
    assetSn: `20260129${String(Number(ip.split('.').at(-1)) - 10).padStart(2, '0')}`,
    name: '水冶厂 γ剂量率监测仪',
    radonNode: undefined as number | undefined,
  })),
  ...configuredDevices.map((entry) => ({
    id: entry.id,
    assetSn: entry.id,
    name: entry.name,
    radonNode: entry.radonNode,
  })),
];

// Legacy bus pairs follow field records (2026-10-30); explicit devices.json pairs win.
const legacyRadonPairs: Record<string, number> = {
  '2026012901': 39,
  '2026012902': 32,
  '2026012906': 36,
  '2026012907': 34,
  '2026012908': 31,
  '2026012909': 30,
  '2026012910': 33,
};
export const radonPairs = new Map<string, number>();
const configuredNodes = new Set(
  configuredDevices.flatMap((d) =>
    d.radonNode === undefined ? [] : [d.radonNode],
  ),
);
for (const [asset, node] of Object.entries(legacyRadonPairs)) {
  if (!configuredNodes.has(node)) radonPairs.set(asset, node);
}
for (const entry of gammaInventory) {
  if (entry.radonNode !== undefined)
    radonPairs.set(entry.assetSn, entry.radonNode);
}

function placeholder(
  id: string,
  name: string,
  type: Device['type'],
  assetSn?: string,
): Device {
  return {
    id,
    code: id,
    name,
    type,
    assetSn,
    station: 'STATION-01',
    status: 'offline',
    unreported: true,
    lastUpdate: '',
    metrics: [],
    alarms: [],
  };
}

export const installedDevices: Device[] = [
  ...gammaInventory.map((d) => placeholder(d.id, d.name, 'gamma', d.assetSn)),
  ...[...new Set(radonPairs.values())].map((node) =>
    placeholder(`radon-${node}`, `空气测氡仪-${node}`, 'radon'),
  ),
];

/** Missing API records are installations with no report, never mock readings. */
export function mergeInstalledDevices(reported: Device[]): Device[] {
  const reports = new Map(reported.map((d) => [d.id, d]));
  const merged = installedDevices.map((d) => {
    const report = reports.get(d.id);
    reports.delete(d.id);
    return report
      ? { ...report, assetSn: d.assetSn, unreported: false }
      : { ...d };
  });
  return [...merged, ...reports.values()];
}

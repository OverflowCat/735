import plans from './plans.json';
import { gammaInventory, installedDevices, radonPairs } from './inventory';
import { mockScene } from '../mock/scene';
import type { MapDefinition, DevicePlacement } from '../../types/scene';

export const buildings = [
  { id: 'c19', name: 'C19 采区', mapId: 'c19' },
  { id: 'c35', name: 'C35 采区', mapId: 'c35' },
  { id: 'c3', name: 'C3 采区', mapId: 'c3' },
  { id: 'filter', name: '集中过滤厂房', mapId: 'filter' },
  { id: 'hydromet', name: '水冶厂', mapId: 'hydromet-f1' },
];

const assetIds = new Map(gammaInventory.map((d) => [d.assetSn, d.id]));
const availableIds = new Set(installedDevices.map((d) => d.id));

export const mapDefinitions: MapDefinition[] = [
  {
    id: 'site',
    name: '厂区总览',
    building: 'site',
    version: 1,
    scene: {
      ...mockScene,
      objects: mockScene.objects.map((o) => ({
        ...o,
        targetMapId: buildings.find((b) => `bldg-${b.id}` === o.id)?.mapId,
      })),
      devices: [
        ...mockScene.devices.filter(
          (p) =>
            availableIds.has(p.deviceId) && !p.deviceId.startsWith('radon-'),
        ),
        ...[...radonPairs].flatMap(([asset, node]) => {
          const gamma = mockScene.devices.find(
            (p) => p.deviceId === assetIds.get(asset),
          );
          return gamma
            ? [
                {
                  ...gamma,
                  deviceId: `radon-${node}`,
                  x: gamma.x + 22,
                  y: gamma.y + 22,
                },
              ]
            : [];
        }),
      ],
    },
  },
  ...plans.map((plan): MapDefinition => {
    const [left, top, right, bottom] = plan.crop;
    const w = right - left;
    const h = bottom - top;
    const devices: DevicePlacement[] = [];
    for (const pin of plan.pins) {
      const id = assetIds.get(pin.asset);
      if (!id) continue;
      const x = pin.x - left + 120;
      const y = pin.y - top + 90;
      const labelDx = pin.x - left > w * 0.6 ? -163 : 22;
      devices.push({
        deviceId: id,
        x,
        y,
        labelStyle: 'badge',
        labelDx,
        labelDy: -22,
      });
      const node = radonPairs.get(pin.asset);
      if (node !== undefined)
        devices.push({
          deviceId: `radon-${node}`,
          x,
          y,
          labelStyle: 'badge',
          labelDx,
          labelDy: 31,
        });
    }
    // Preserve installation anchors while keeping live captions readable.
    const occupied: { x: number; y: number }[] = [];
    for (const pin of devices) {
      const preferredX = pin.x + (pin.labelDx ?? 22);
      const preferredY = pin.y + (pin.labelDy ?? -22);
      let chosen = { x: preferredX, y: preferredY };
      outer: for (const dx of [0, preferredX < pin.x ? 185 : -185]) {
        for (const dy of [0, -53, 53, -106, 106, -159, 159]) {
          const candidate = { x: preferredX + dx, y: preferredY + dy };
          if (
            candidate.x < 5 ||
            candidate.x + 140 > w + 235 ||
            candidate.y < 5 ||
            candidate.y + 48 > h + 175
          )
            continue;
          if (
            occupied.every(
              (o) =>
                candidate.x + 145 <= o.x ||
                o.x + 145 <= candidate.x ||
                candidate.y + 53 <= o.y ||
                o.y + 53 <= candidate.y,
            )
          ) {
            chosen = candidate;
            break outer;
          }
        }
      }
      occupied.push(chosen);
      pin.labelDx = chosen.x - pin.x;
      pin.labelDy = chosen.y - pin.y;
    }
    return {
      id: plan.id,
      name: plan.name,
      building: plan.building,
      floor: plan.floor ?? undefined,
      version: 1,
      scene: {
        width: w + 240,
        height: h + 180,
        backgroundColor: '#f1f5f9',
        backgroundImage: {
          src: `${import.meta.env.BASE_URL}floorplans/${plan.id}.png`,
          x: 120,
          y: 90,
          width: w,
          height: h,
        },
        objects: [],
        devices,
      },
    };
  }),
];

export function mapById(id: string): MapDefinition {
  return mapDefinitions.find((m) => m.id === id) ?? mapDefinitions[0];
}

export function deviceMapId(deviceId: string): string | undefined {
  return mapDefinitions.find(
    (m) =>
      m.id !== 'site' && m.scene.devices.some((p) => p.deviceId === deviceId),
  )?.id;
}

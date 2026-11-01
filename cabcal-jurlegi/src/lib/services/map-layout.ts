import type {
  DevicePlacement,
  MapDefinition,
  FactoryScene,
} from '../types/scene';

export const MAP_STORAGE_KEY = 'cabcal-floorplan-layouts-v2';
export interface StoredLayout {
  version: number;
  devices: DevicePlacement[];
}
export type MapLayouts = Record<string, StoredLayout>;

/** Old site coordinates must never be applied to cropped floorplan coordinates. */
export function restoreMapScene(
  map: MapDefinition,
  raw: unknown,
): FactoryScene {
  const scene = structuredClone(map.scene);
  if (!raw || typeof raw !== 'object') return scene;
  const layout = raw as StoredLayout;
  if (layout.version !== map.version || !Array.isArray(layout.devices))
    return scene;
  const allowedIds = new Set(map.scene.devices.map((d) => d.deviceId));
  const seen = new Set<string>();
  const valid: DevicePlacement[] = [];
  for (const p of layout.devices) {
    if (
      !p ||
      !allowedIds.has(p.deviceId) ||
      seen.has(p.deviceId) ||
      !Number.isFinite(p.x) ||
      !Number.isFinite(p.y)
    )
      return scene;
    seen.add(p.deviceId);
    valid.push({
      deviceId: p.deviceId,
      x: Math.max(0, Math.min(scene.width, p.x)),
      y: Math.max(0, Math.min(scene.height, p.y)),
      labelStyle: ['badge', 'text', 'compact'].includes(p.labelStyle ?? '')
        ? p.labelStyle
        : 'badge',
      ...(Number.isFinite(p.labelDx) ? { labelDx: p.labelDx } : {}),
      ...(Number.isFinite(p.labelDy) ? { labelDy: p.labelDy } : {}),
    });
  }
  scene.devices = valid;
  return scene;
}

export function readMapLayouts(storage: Pick<Storage, 'getItem'>): MapLayouts {
  try {
    const parsed: unknown = JSON.parse(
      storage.getItem(MAP_STORAGE_KEY) ?? '{}',
    );
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as MapLayouts)
      : {};
  } catch {
    return {};
  }
}

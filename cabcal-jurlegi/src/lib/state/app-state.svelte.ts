import type { Device } from '../types/device';
import type { DevicePlacement, FactoryScene } from '../types/scene';
import type { DeviceDataSource, HistoryQuery } from '../services/data-source';
import { HttpDeviceDataSource } from '../services/http-data-source';
import { mockDevices } from '../data/mock';
import { mapById, deviceMapId } from '../data/floorplans/maps';
import { mergeInstalledDevices } from '../data/floorplans/inventory';
import {
  MAP_STORAGE_KEY,
  readMapLayouts,
  restoreMapScene,
  type MapLayouts,
} from '../services/map-layout';

// Singleton data source — HTTP first, with mock data fallback.
// Set VITE_API_BASE to point at a remote backend (e.g. http://192.168.1.10:3000).
const apiBase = import.meta.env.VITE_API_BASE ?? '';
const ds: DeviceDataSource = new HttpDeviceDataSource(apiBase);

const ACTIVE_MAP_KEY = 'cabcal-active-map-v2';
const localLayouts: MapLayouts = loadLayouts();
function loadLayouts(): MapLayouts {
  try {
    return readMapLayouts(localStorage);
  } catch {
    return {};
  }
}
function initialMapId(): string {
  try {
    return mapById(localStorage.getItem(ACTIVE_MAP_KEY) ?? 'site').id;
  } catch {
    return 'site';
  }
}
const startingMap = initialMapId();

// --- Reactive state container ---
// Svelte 5 does not allow reassigning exported $state variables from other modules.
// We wrap all mutable state in a single exported object.

class AppState {
  devices: Device[] = $state(mergeInstalledDevices(mockDevices));
  dataMode: 'mock' | 'live' = $state('mock');
  devicesReady = $state(false);
  devicesLoading = $state(false);
  dataRefreshFailed = $state(false);
  dataUpdatedAt: string | null = $state(null);
  activeMapId = $state(startingMap);
  scene: FactoryScene = $state(
    restoreMapScene(mapById(startingMap), localLayouts[startingMap]),
  );
  selectedDeviceId: string | null = $state(null);
  editMode = $state(false);
  /** Device placement selected inside edit mode (for inspector / keyboard ops). */
  editSelectionId: string | null = $state(null);
  /** Device currently being placed (clicked from panel, then click map). */
  placingDeviceId: string | null = $state(null);
  /** Unsaved local edits to scene placements. */
  sceneDirty = $state(false);
  snapToGrid = $state(true);
  gridSize = $state(10);
  viewMode: '2d' | '3d' = $state('2d');
  currentRoute: string = $state('/map');
}

export const appState = new AppState();

// Placement undo stack (device placements only — building geometry is mock-authored).
const undoStack: DevicePlacement[][] = [];
const redoStack: DevicePlacement[][] = [];
const MAX_UNDO = 50;

function clonePlacements(list: DevicePlacement[]): DevicePlacement[] {
  return list.map((p) => ({ ...p }));
}

function persistLocalScene(): boolean {
  const id = appState.activeMapId;
  localLayouts[id] = {
    version: mapById(id).version,
    devices: clonePlacements(appState.scene.devices),
  };
  try {
    localStorage.setItem(MAP_STORAGE_KEY, JSON.stringify(localLayouts));
    localStorage.setItem(ACTIVE_MAP_KEY, id);
    return true;
  } catch (err) {
    console.warn('Failed to persist map layout locally', err);
    return false;
  }
}

export function switchMap(id: string) {
  const next = mapById(id);
  if (next.id === appState.activeMapId) return;
  persistLocalScene();
  appState.editMode = false;
  appState.placingDeviceId = null;
  appState.editSelectionId = null;
  appState.selectedDeviceId = null;
  undoStack.length = 0;
  redoStack.length = 0;
  appState.activeMapId = next.id;
  appState.scene = restoreMapScene(next, localLayouts[next.id]);
  appState.sceneDirty = false;
  persistLocalScene();
}

export function mapDevices() {
  const allowed = new Set(
    mapById(appState.activeMapId).scene.devices.map((p) => p.deviceId),
  );
  return appState.devices.filter((d) => allowed.has(d.id));
}

function pushUndo() {
  undoStack.push(clonePlacements(appState.scene.devices));
  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
}

function markDirty() {
  appState.sceneDirty = true;
  persistLocalScene();
}

export function snapValue(v: number): number {
  if (!appState.snapToGrid) return Math.round(v);
  const g = appState.gridSize || 1;
  return Math.round(v / g) * g;
}

// --- Mutations ---

export function selectDevice(id: string | null) {
  appState.selectedDeviceId = id;
  if (id && appState.editMode) appState.editSelectionId = id;
}

export function setEditSelection(id: string | null) {
  appState.editSelectionId = id;
}

export function toggleEditMode() {
  if (appState.activeMapId === 'site' || appState.viewMode !== '2d') return;
  appState.editMode = !appState.editMode;
  appState.selectedDeviceId = null;
  if (!appState.editMode) {
    appState.editSelectionId = null;
    appState.selectedDeviceId = null;
    appState.placingDeviceId = null;
  }
}

export function startPlacing(deviceId: string) {
  if (!appState.editMode || deviceMapId(deviceId) !== appState.activeMapId)
    return;
  appState.placingDeviceId = deviceId;
  appState.editSelectionId = null;
}

export function cancelPlacing() {
  appState.placingDeviceId = null;
}

export function setEditMode(on: boolean) {
  if (on === appState.editMode) return;
  toggleEditMode();
}

export function setViewMode(mode: '2d' | '3d') {
  appState.viewMode = mode;
  if (mode === '3d' && appState.editMode) {
    // Map editing is 2D-only; leave a consistent state when jumping to 3D.
    appState.editMode = false;
    appState.editSelectionId = null;
    appState.placingDeviceId = null;
    appState.selectedDeviceId = null;
  }
}

export function setSnapToGrid(on: boolean) {
  appState.snapToGrid = on;
}

export function navigate(route: string) {
  appState.currentRoute = route;
  window.location.hash = route;
}

let loadingDevices = false;
export async function loadDevices() {
  if (loadingDevices) return;
  loadingDevices = true;
  appState.devicesLoading = true;
  try {
    const remote = await ds.getDevices();
    if (!Array.isArray(remote)) throw new Error('Invalid device response');
    appState.devices = mergeInstalledDevices(remote);
    appState.dataMode = 'live';
    appState.dataUpdatedAt = new Date().toISOString();
    appState.dataRefreshFailed = false;
  } catch (err) {
    appState.dataRefreshFailed = true;
    console.warn('Device refresh failed; retaining previous readings', err);
  } finally {
    loadingDevices = false;
    appState.devicesLoading = false;
    appState.devicesReady = true;
  }
}

// The legacy /scene API cannot persist images/multiple floors. Phase 1 uses
// packaged geometry with versioned per-map edits in this browser only.
export async function saveScene() {
  if (!persistLocalScene())
    throw new Error('浏览器存储不可用，布局仅保留在当前会话');
  appState.sceneDirty = false;
  return false; // Phase 1 saves layouts on this browser only.
}

export function resetPlacements() {
  pushUndo();
  appState.scene.devices = clonePlacements(
    mapById(appState.activeMapId).scene.devices,
  );
  appState.editSelectionId = null;
  appState.selectedDeviceId = null;
  appState.placingDeviceId = null;
  markDirty();
}

// Paired gamma/radon records share one physical installation anchor.
function moveInstallation(deviceId: string, x: number, y: number) {
  const defaults = mapById(appState.activeMapId).scene.devices;
  const anchor = defaults.find((p) => p.deviceId === deviceId);
  if (!anchor) return;
  const paired = new Set(
    defaults
      .filter((p) => p.x === anchor.x && p.y === anchor.y)
      .map((p) => p.deviceId),
  );
  for (const p of appState.scene.devices) {
    if (paired.has(p.deviceId)) {
      p.x = Math.max(0, Math.min(appState.scene.width, x));
      p.y = Math.max(0, Math.min(appState.scene.height, y));
    }
  }
}

export function moveDevice(deviceId: string, x: number, y: number) {
  moveInstallation(deviceId, x, y);
  markDirty();
}

/** Snapshot current placements so a drag can be undone as one step. */
export function beginPlacementChange() {
  pushUndo();
}

export function removeDevicePlacement(deviceId: string) {
  pushUndo();
  appState.scene.devices = appState.scene.devices.filter(
    (d) => d.deviceId !== deviceId,
  );
  if (appState.editSelectionId === deviceId) appState.editSelectionId = null;
  if (appState.selectedDeviceId === deviceId) appState.selectedDeviceId = null;
  markDirty();
}

export function addDevicePlacement(deviceId: string, x: number, y: number) {
  if (deviceMapId(deviceId) !== appState.activeMapId) return;
  pushUndo();
  const existing = appState.scene.devices.find((d) => d.deviceId === deviceId);
  if (existing) {
    existing.x = x;
    existing.y = y;
  } else {
    appState.scene.devices = [
      ...appState.scene.devices,
      {
        ...mapById(appState.activeMapId).scene.devices.find(
          (p) => p.deviceId === deviceId,
        )!,
        x,
        y,
      },
    ];
  }
  moveInstallation(deviceId, x, y);
  appState.editSelectionId = deviceId;
  appState.placingDeviceId = null;
  markDirty();
}

export function updatePlacement(
  deviceId: string,
  patch: Partial<Omit<DevicePlacement, 'deviceId'>>,
) {
  const placement = appState.scene.devices.find((d) => d.deviceId === deviceId);
  if (!placement) return;
  pushUndo();
  Object.assign(placement, patch);
  if (patch.x !== undefined || patch.y !== undefined)
    moveInstallation(deviceId, placement.x, placement.y);
  markDirty();
}

export function setPlacementLabelStyle(
  deviceId: string,
  labelStyle: DevicePlacement['labelStyle'],
) {
  updatePlacement(deviceId, { labelStyle });
}

export function nudgeSelectedPlacement(dx: number, dy: number) {
  const id = appState.editSelectionId;
  if (!id) return;
  const placement = appState.scene.devices.find((d) => d.deviceId === id);
  if (!placement) return;
  pushUndo();
  moveInstallation(id, placement.x + dx, placement.y + dy);
  markDirty();
}

export function undoPlacement() {
  if (undoStack.length === 0) return;
  redoStack.push(clonePlacements(appState.scene.devices));
  appState.scene.devices = undoStack.pop()!;
  persistLocalScene();
  appState.sceneDirty = true;
}

export function redoPlacement() {
  if (redoStack.length === 0) return;
  undoStack.push(clonePlacements(appState.scene.devices));
  appState.scene.devices = redoStack.pop()!;
  persistLocalScene();
  appState.sceneDirty = true;
}

export function canUndo() {
  return undoStack.length > 0;
}

export function canRedo() {
  return redoStack.length > 0;
}

export async function getHistory(
  deviceId: string,
  metric: string,
  query: HistoryQuery,
) {
  return ds.getHistory(deviceId, metric, query);
}

export { ds as dataSource };

import type { Device } from '../types/device';
import type { DevicePlacement, FactoryScene } from '../types/scene';
import type { DeviceDataSource, HistoryQuery } from '../services/data-source';
import { HttpDeviceDataSource } from '../services/http-data-source';
import { mockDevices, mockScene } from '../data/mock';

// Singleton data source — HTTP first, with mock data fallback.
// Set VITE_API_BASE to point at a remote backend (e.g. http://192.168.1.10:3000).
const apiBase = import.meta.env.VITE_API_BASE ?? '';
const ds: DeviceDataSource = new HttpDeviceDataSource(apiBase);

const SCENE_STORAGE_KEY = 'cabcal-factory-scene-v1';

// --- Reactive state container ---
// Svelte 5 does not allow reassigning exported $state variables from other modules.
// We wrap all mutable state in a single exported object.

class AppState {
  devices: Device[] = $state(mockDevices);
  scene: FactoryScene = $state<FactoryScene>(loadLocalScene() ?? mockScene);
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

function loadLocalScene(): FactoryScene | null {
  try {
    const raw = localStorage.getItem(SCENE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as FactoryScene;
    if (!parsed || !Array.isArray(parsed.devices) || !Array.isArray(parsed.objects)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function persistLocalScene() {
  try {
    localStorage.setItem(SCENE_STORAGE_KEY, JSON.stringify(appState.scene));
  } catch (err) {
    console.warn('Failed to persist scene locally', err);
  }
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
  if (id) appState.editSelectionId = id;
}

export function setEditSelection(id: string | null) {
  appState.editSelectionId = id;
}

export function toggleEditMode() {
  appState.editMode = !appState.editMode;
  if (!appState.editMode) {
    appState.editSelectionId = null;
    appState.selectedDeviceId = null;
    appState.placingDeviceId = null;
  }
}

export function startPlacing(deviceId: string) {
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
  }
}

export function setSnapToGrid(on: boolean) {
  appState.snapToGrid = on;
}

export function navigate(route: string) {
  appState.currentRoute = route;
  window.location.hash = route;
}

export async function loadDevices() {
  try {
    const remote = await ds.getDevices();
    if (remote && remote.length > 0) {
      appState.devices = remote;
    }
  } catch (err) {
    console.warn('Backend unavailable, using mock devices', err);
  }
}

export async function loadScene() {
  try {
    const remote = await ds.getScene();
    if (remote && remote.objects && remote.objects.length > 0) {
      appState.scene = remote;
      appState.sceneDirty = false;
      persistLocalScene();
      return;
    }
  } catch (err) {
    console.warn('Backend unavailable, using local/mock scene', err);
  }
  // Keep whatever local overlay the user already saved.
  if (loadLocalScene()) {
    appState.sceneDirty = true;
  }
}

export async function saveScene() {
  persistLocalScene();
  try {
    await ds.updateScene(appState.scene);
    appState.sceneDirty = false;
    return true;
  } catch (err) {
    console.warn('Backend save failed; scene kept in localStorage', err);
    // Still treat as saved locally — Phase 1 allows lightweight persistence.
    appState.sceneDirty = false;
    return false;
  }
}

/** Restore mock scene placements (keeps building geometry). */
export function resetPlacements() {
  pushUndo();
  appState.scene.devices = clonePlacements(mockScene.devices);
  appState.editSelectionId = null;
  markDirty();
}

export function moveDevice(deviceId: string, x: number, y: number) {
  const placement = appState.scene.devices.find((d) => d.deviceId === deviceId);
  if (!placement) return;
  placement.x = x;
  placement.y = y;
  markDirty();
}

/** Snapshot current placements so a drag can be undone as one step. */
export function beginPlacementChange() {
  pushUndo();
}

export function removeDevicePlacement(deviceId: string) {
  pushUndo();
  appState.scene.devices = appState.scene.devices.filter((d) => d.deviceId !== deviceId);
  if (appState.editSelectionId === deviceId) appState.editSelectionId = null;
  if (appState.selectedDeviceId === deviceId) appState.selectedDeviceId = null;
  markDirty();
}

export function addDevicePlacement(deviceId: string, x: number, y: number) {
  pushUndo();
  const existing = appState.scene.devices.find((d) => d.deviceId === deviceId);
  if (existing) {
    existing.x = x;
    existing.y = y;
  } else {
    appState.scene.devices = [
      ...appState.scene.devices,
      { deviceId, x, y, labelStyle: 'badge' },
    ];
  }
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
  placement.x = Math.max(0, Math.min(appState.scene.width, placement.x + dx));
  placement.y = Math.max(0, Math.min(appState.scene.height, placement.y + dy));
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

export async function getHistory(deviceId: string, metric: string, query: HistoryQuery) {
  return ds.getHistory(deviceId, metric, query);
}

export { ds as dataSource };

import type { Device } from '../types/device';
import type { FactoryScene } from '../types/scene';
import type { DeviceDataSource } from '../services/data-source';
import { MockDeviceDataSource } from '../services/mock-data-source';

// Singleton data source - swap this for a real backend implementation later.
const ds: DeviceDataSource = new MockDeviceDataSource();

// --- Reactive state container ---
// Svelte 5 does not allow reassigning exported $state variables from other modules.
// We wrap all mutable state in a single exported object.

class AppState {
  devices: Device[] = $state([]);
  scene: FactoryScene = $state<FactoryScene>({
    width: 1200,
    height: 800,
    objects: [],
    devices: [],
  });
  selectedDeviceId: string | null = $state(null);
  editMode = $state(false);
  viewMode: '2d' | '3d' = $state('2d');
  currentRoute: string = $state('/map');
}

export const appState = new AppState();

// --- Mutations ---

export function selectDevice(id: string | null) {
  appState.selectedDeviceId = id;
}

export function toggleEditMode() {
  appState.editMode = !appState.editMode;
}

export function setViewMode(mode: '2d' | '3d') {
  appState.viewMode = mode;
}

export function navigate(route: string) {
  appState.currentRoute = route;
  window.location.hash = route;
}

export async function loadDevices() {
  appState.devices = await ds.getDevices();
}

export async function loadScene() {
  appState.scene = await ds.getScene();
}

export async function saveScene() {
  await ds.updateScene(appState.scene);
}

export function moveDevice(deviceId: string, x: number, y: number) {
  const placement = appState.scene.devices.find((d) => d.deviceId === deviceId);
  if (placement) {
    placement.x = x;
    placement.y = y;
  }
}

export function removeDevicePlacement(deviceId: string) {
  appState.scene.devices = appState.scene.devices.filter((d) => d.deviceId !== deviceId);
}

export function addDevicePlacement(deviceId: string, x: number, y: number) {
  const existing = appState.scene.devices.find((d) => d.deviceId === deviceId);
  if (existing) {
    existing.x = x;
    existing.y = y;
  } else {
    appState.scene.devices = [...appState.scene.devices, { deviceId, x, y }];
  }
}

export async function getHistory(deviceId: string, metric: string, range: string) {
  return ds.getHistory(deviceId, metric, range as any);
}

export { ds as dataSource };

// Scene and map types shared between 2D and 3D views.

export interface Point {
  x: number;
  y: number;
}

export interface SceneObject {
  id: string;
  label: string;
  kind: 'wall' | 'machine' | 'area' | 'other';
  x: number;
  y: number;
  width: number;
  height: number;
  fill?: string;
  stroke?: string;
}

export interface DevicePlacement {
  deviceId: string;
  x: number;
  y: number;
}

export interface FactoryScene {
  width: number;
  height: number;
  objects: SceneObject[];
  devices: DevicePlacement[];
}

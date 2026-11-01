// Scene and map types shared between 2D and 3D views.

export interface Point {
  x: number;
  y: number;
}

export interface SceneObject {
  id: string;
  label: string;
  kind: 'building' | 'wall' | 'machine' | 'area' | 'other';
  shape?: 'rect' | 'polygon';
  // Rect geometry
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  // Polygon geometry
  points?: [number, number][];
  frontPoints?: [number, number][];
  // 2.5D Facade (front edge)
  facadeHeight?: number;
  facadeFill?: string;
  // Styling
  fill?: string;
  stroke?: string;
  labelColor?: string;
  labelFontSize?: number;
  labelX?: number;
  labelY?: number;
  targetMapId?: string;
}

export interface DevicePlacement {
  deviceId: string;
  x: number;
  y: number;
  labelStyle?: 'badge' | 'text' | 'compact';
  labelDx?: number;
  labelDy?: number;
}

export interface FactoryScene {
  width: number;
  height: number;
  backgroundColor?: string;
  backgroundImage?: {
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
  };
  objects: SceneObject[];
  devices: DevicePlacement[];
}

export interface MapDefinition {
  id: string;
  name: string;
  building: string;
  floor?: number;
  version: number;
  scene: FactoryScene;
}

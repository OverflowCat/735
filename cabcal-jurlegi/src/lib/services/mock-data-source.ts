import type { Device } from '../types/device';
import type { FactoryScene } from '../types/scene';
import type { HistoricalPoint } from '../types/device';
import type { DeviceDataSource, HistoryQuery } from './data-source';
import { mockDevices, mockScene, getMockHistory } from '../data/mock';

export class MockDeviceDataSource implements DeviceDataSource {
  private devices: Device[] = structuredClone(mockDevices);
  private scene: FactoryScene = structuredClone(mockScene);

  async getDevices(): Promise<Device[]> {
    return structuredClone(this.devices);
  }

  async getDevice(id: string): Promise<Device | undefined> {
    const d = this.devices.find((d) => d.id === id);
    return d ? structuredClone(d) : undefined;
  }

  async getHistory(
    deviceId: string,
    metric: string,
    query: HistoryQuery,
  ): Promise<HistoricalPoint[]> {
    return getMockHistory(deviceId, metric, query);
  }

  async getScene(): Promise<FactoryScene> {
    return structuredClone(this.scene);
  }

  async updateScene(scene: FactoryScene): Promise<void> {
    this.scene = structuredClone(scene);
  }
}

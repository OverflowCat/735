// HTTP data source that talks to the Rust backend REST API.

import type { Device, HistoricalPoint } from '../types/device';
import type { FactoryScene } from '../types/scene';
import type {
  DeviceDataSource,
  HistoryQuery,
  HistoryRequestOptions,
} from './data-source';

const BASE = '/api/v1';

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${path}`);
  }
  return res.json();
}

export class HttpDeviceDataSource implements DeviceDataSource {
  constructor(private baseUrl: string = '') {}

  private url(path: string): string {
    return `${this.baseUrl}${BASE}${path}`;
  }

  private async get<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(this.url(path), init);
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
    return res.json();
  }

  private async put<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${path}`);
    return res.json();
  }

  async getDevices(): Promise<Device[]> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      return await this.get<Device[]>('/devices', {
        cache: 'no-store',
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }
  }

  async getDevice(id: string): Promise<Device | undefined> {
    try {
      return await this.get<Device>(`/devices/${encodeURIComponent(id)}`);
    } catch {
      return undefined;
    }
  }

  async getHistory(
    deviceId: string,
    metric: string,
    query: HistoryQuery,
    options?: HistoryRequestOptions,
  ): Promise<HistoricalPoint[]> {
    const params = new URLSearchParams({ metric });
    if (query.kind === 'absolute') {
      params.set('start_ms', String(query.startMs));
      params.set('end_ms', String(query.endMs));
    } else {
      params.set('range', query.range);
    }
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (options?.signal?.aborted) controller.abort();
    options?.signal?.addEventListener('abort', abort, { once: true });
    const timeout = setTimeout(abort, 15000);
    try {
      const points = await this.get<HistoricalPoint[]>(
        `/devices/${encodeURIComponent(deviceId)}/history?${params}`,
        { signal: controller.signal, cache: 'no-store' },
      );
      if (!Array.isArray(points)) throw new Error('Invalid history response');
      return points;
    } finally {
      clearTimeout(timeout);
      options?.signal?.removeEventListener('abort', abort);
    }
  }

  async getScene(): Promise<FactoryScene> {
    return this.get<FactoryScene>('/scene');
  }

  async updateScene(scene: FactoryScene): Promise<void> {
    await this.put('/scene', scene);
  }
}

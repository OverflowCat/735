<script lang="ts">
  import { appState, switchMap } from '../../state/app-state.svelte';
  import {
    buildings,
    mapById,
    mapDefinitions,
  } from '../../data/floorplans/maps';
  import FactoryMap from './FactoryMap.svelte';
  import Factory3D from '../three/Factory3D.svelte';
  import DeviceDrawer from '../device/DeviceDrawer.svelte';
  import EditPanel from './EditPanel.svelte';

  const currentMap = $derived(mapById(appState.activeMapId));
  const floors = $derived(
    mapDefinitions.filter((m) => m.building === currentMap.building && m.floor),
  );
  const currentDevices = $derived(
    appState.devices.filter((d) =>
      currentMap.scene.devices.some((p) => p.deviceId === d.id),
    ),
  );

  function buildingSummary(id: string): string {
    const ids = new Set(
      mapDefinitions
        .filter((m) => m.building === id)
        .flatMap((m) => m.scene.devices.map((p) => p.deviceId)),
    );
    const devices = appState.devices.filter((d) => ids.has(d.id));
    const alarms = devices.filter((d) => d.alarms.length > 0).length;
    return `${devices.length} 点位${alarms ? ` · ${alarms} 报警` : ''}`;
  }
</script>

<div class="map-page">
  <nav class="map-navigation" aria-label="区域选择">
    <button
      class:active={currentMap.id === 'site'}
      aria-current={currentMap.id === 'site' ? 'page' : undefined}
      onclick={() => switchMap('site')}>厂区总览</button
    >
    {#each buildings as building}
      <button
        class:active={currentMap.building === building.id}
        aria-current={currentMap.building === building.id ? 'page' : undefined}
        onclick={() => switchMap(building.mapId)}
      >
        {building.name}<small>{buildingSummary(building.id)}</small>
      </button>
    {/each}
  </nav>

  <div class="map-heading">
    <div class="map-title">
      {#if currentMap.id !== 'site'}
        <button class="back-button" onclick={() => switchMap('site')}
          >← 总览</button
        >
      {/if}
      <strong>{currentMap.name}</strong>
      {#if currentMap.id === 'site'}
        <span>厂房点位 / 悬浮列表 · 点击设备查看测量详情</span>
      {:else}
        <span
          >{currentDevices.filter((d) => d.type === 'gamma').length} 个 γ · {currentDevices.filter(
            (d) => d.type === 'radon',
          ).length} 个氡</span
        >
      {/if}
    </div>
    {#if floors.length > 0}
      <div class="floor-tabs" role="group" aria-label="水冶厂楼层">
        {#each floors as floor}
          <button
            class:active={floor.id === currentMap.id}
            aria-pressed={floor.id === currentMap.id}
            onclick={() => switchMap(floor.id)}>{floor.floor} 楼</button
          >
        {/each}
      </div>
    {/if}
    <span class="data-indicator" class:demo={appState.dataMode === 'mock'}>
      {appState.dataMode === 'mock' ? '演示数据 · 未连接采集服务' : '现场数据'}
    </span>
  </div>

  <div class="map-content">
    <div class="map-main">
      {#key appState.activeMapId}
        {#if appState.viewMode === '2d'}
          <FactoryMap />
        {:else}
          <Factory3D />
        {/if}
      {/key}
      <DeviceDrawer />
    </div>
    {#if appState.editMode && appState.viewMode === '2d'}
      <EditPanel />
    {/if}
  </div>
  <div class="map-legend" aria-label="点位图例">
    <span><i class="online"></i>在线</span><span
      ><i class="offline"></i>离线 / 未上报</span
    >
    <span><i class="alarm"></i>报警（标注等级）</span>
    <span class="map-help"
      >{currentMap.id === 'site'
        ? '厂区示意图 · 点击建筑进入'
        : '平面图定位 · 滚轮缩放 · 拖动空白平移'}</span
    >
  </div>
</div>

<style>
  .map-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
  }
  .map-navigation {
    display: flex;
    gap: 6px;
    padding: 10px 14px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    overflow-x: auto;
    flex-shrink: 0;
  }
  .map-navigation button {
    display: flex;
    align-items: center;
    gap: 10px;
    white-space: nowrap;
    padding: 9px 12px;
  }
  small {
    font-size: 11px;
    opacity: 0.65;
  }
  .map-heading {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding: 9px 14px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }
  .map-title {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .map-title span {
    color: var(--text-secondary);
    font-size: 12px;
  }
  .map-title strong {
    font-size: 14px;
  }
  .back-button {
    font-size: 12px;
    padding: 4px 8px;
  }
  .floor-tabs {
    display: flex;
    gap: 4px;
  }
  .floor-tabs button {
    padding: 5px 13px;
  }
  .data-indicator {
    margin-left: auto;
    color: #6ee7b7;
    font-size: 12px;
  }
  .data-indicator.demo {
    color: #fbbf24;
  }
  .map-content {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-height: 0;
  }
  .map-main {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    position: relative;
  }
  .map-legend {
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    padding: 7px 14px;
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    color: var(--text-secondary);
    font-size: 11px;
    flex-shrink: 0;
  }
  .map-legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .map-legend i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }
  .online {
    background: #10b981;
  }
  .offline {
    background: #94a3b8;
  }
  .alarm {
    background: #ef4444;
  }
  .map-help {
    margin-left: auto;
  }
  @media (max-width: 900px) {
    small {
      display: none;
    }
    .map-title span {
      display: none;
    }
  }
</style>

<script lang="ts">
  import { appState } from '../../state/app-state.svelte';
  import { mapById } from '../../data/floorplans/maps';
  import FactoryMap from './FactoryMap.svelte';
  import Factory3D from '../three/Factory3D.svelte';
  import DeviceDrawer from '../device/DeviceDrawer.svelte';
  import EditPanel from './EditPanel.svelte';

  const currentMap = $derived(mapById(appState.activeMapId));
</script>

<div class="map-page" role="region" aria-label={currentMap.name}>
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
</style>

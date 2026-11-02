<script lang="ts">
  import Location from 'carbon-icons-svelte/lib/Location.svelte';
  import CheckmarkFilled from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import WarningFilled from 'carbon-icons-svelte/lib/WarningFilled.svelte';
  import WifiOff from 'carbon-icons-svelte/lib/WifiOff.svelte';
  import Floorplan from 'carbon-icons-svelte/lib/Floorplan.svelte';
  import Layers from 'carbon-icons-svelte/lib/Layers.svelte';

  import {
    Button,
    ContentSwitcher,
    Switch,
    Tag,
  } from 'carbon-components-svelte';
  import Edit from 'carbon-icons-svelte/lib/Edit.svelte';
  import Checkmark from 'carbon-icons-svelte/lib/Checkmark.svelte';
  import {
    appState,
    mapDevices,
    setViewMode,
    toggleEditMode,
  } from '../../state/app-state.svelte';
  import { mapById } from '../../data/floorplans/maps';
  import FactoryMap from './FactoryMap.svelte';
  import Factory3D from '../three/Factory3D.svelte';
  import DeviceDrawer from '../device/DeviceDrawer.svelte';
  import EditPanel from './EditPanel.svelte';
  import MapNavigation from './MapNavigation.svelte';

  const currentMap = $derived(mapById(appState.activeMapId));
  const devices = $derived(mapDevices());
  const online = $derived(devices.filter((d) => d.status === 'online').length);
  const alarms = $derived(devices.filter((d) => d.alarms.length > 0).length);
</script>

<div class="map-page" role="region" aria-label={currentMap.name}>
  <div class="page-heading">
    <div class="heading-copy">
      <div class="eyebrow">实时监测 / 工厂地图</div>
      <h1>{currentMap.id === 'site' ? '厂区监测地图' : currentMap.name}</h1>
    </div>
    <div class="map-summary">
      <span
        ><Location size={16} /><strong>{devices.length}</strong> 监测点位</span
      ><span><CheckmarkFilled size={16} /><strong>{online}</strong> 在线</span
      ><Tag icon={WarningFilled} type={alarms ? 'red' : 'gray'} size="sm"
        >{alarms} 报警</Tag
      >
    </div>
    <div class="nav-controls">
      <div class="view-toggle">
        <ContentSwitcher
          size="sm"
          selectedIndex={appState.viewMode === '2d' ? 0 : 1}
          aria-label="地图视图"
          on:change={(e) => setViewMode(e.detail === 0 ? '2d' : '3d')}
        >
          <Switch text="2D"
            ><span class="mode-label"><Floorplan size={16} />2D</span></Switch
          ><Switch text="3D"
            ><span class="mode-label"><Layers size={16} />3D</span></Switch
          >
        </ContentSwitcher>
      </div>
      {#if appState.viewMode === '2d'}
        <Button
          size="small"
          kind={appState.editMode ? 'primary' : 'tertiary'}
          icon={appState.editMode ? Checkmark : Edit}
          disabled={currentMap.id === 'site'}
          title={currentMap.id === 'site'
            ? '进入建筑平面图后编辑设备位置'
            : '编辑当前平面图'}
          on:click={toggleEditMode}
          >{appState.editMode ? '退出编辑' : '编辑模式'}</Button
        >
      {/if}
    </div>
  </div>
  <MapNavigation />
  <div class="map-content">
    <div class="map-main">
      {#key appState.activeMapId}
        {#if appState.viewMode === '2d'}<FactoryMap />{:else}<Factory3D />{/if}
      {/key}
      <DeviceDrawer />
    </div>
    {#if appState.editMode && appState.viewMode === '2d'}<EditPanel />{/if}
  </div>
  <div class="map-legend" aria-label="点位图例">
    <span
      ><span class="legend-icon online"><CheckmarkFilled size={14} /></span
      >在线</span
    ><span
      ><span class="legend-icon offline"><WifiOff size={14} /></span>离线 /
      未上报</span
    ><span
      ><span class="legend-icon alarm"><WarningFilled size={14} /></span
      >报警（标注等级）</span
    >
    <span class="map-help"
      >{appState.editMode
        ? '拖动点位调整布局 · Ctrl+Z 撤销'
        : '点击设备查看详情 · 滚轮缩放 · Shift + 拖动平移'}</span
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
  .page-heading {
    display: flex;
    align-items: center;
    gap: 32px;
    padding: 16px 24px;
    flex-shrink: 0;
    background: var(--bg-primary);
  }
  .eyebrow {
    color: var(--text-muted);
    font-size: 11px;
    line-height: 16px;
    margin-bottom: 4px;
  }
  h1 {
    font-size: 24px;
    line-height: 32px;
    font-weight: 400;
    margin: 0;
  }
  .map-summary {
    display: flex;
    align-items: center;
    gap: 24px;
    color: var(--text-secondary);
    font-size: 12px;
  }
  .map-summary > span {
    display: flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .map-summary strong {
    color: var(--text-primary);
    font: 20px var(--font-mono);
  }
  .nav-controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .view-toggle {
    width: 152px;
  }
  .view-toggle :global(.bx--content-switcher-btn) {
    min-width: 0;
    padding: 0 16px;
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
    gap: 24px;
    min-height: 32px;
    padding: 8px 24px;
    background: var(--bg-primary);
    color: var(--text-secondary);
    font-size: 11px;
    flex-shrink: 0;
  }
  .map-legend span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .mode-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .legend-icon {
    display: flex;
    align-items: center;
  }
  .online {
    color: var(--status-online);
  }
  .offline {
    color: var(--status-offline);
  }
  .alarm {
    color: var(--alarm-l2);
  }
  .map-help {
    margin-left: auto;
    color: var(--text-muted);
  }
  @media (max-width: 1000px) {
    .map-summary {
      display: none;
    }
  }
  @media (max-width: 600px) {
    .page-heading {
      gap: 12px;
      padding: 12px;
      flex-wrap: wrap;
    }
    h1 {
      font-size: 20px;
    }
    .nav-controls {
      gap: 8px;
    }
    .map-legend {
      padding: 8px 12px;
      gap: 12px;
    }
    .map-help {
      display: none;
    }
  }
</style>

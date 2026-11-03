<script lang="ts">
  import Floorplan from 'carbon-icons-svelte/lib/Floorplan.svelte';
  import Layers from 'carbon-icons-svelte/lib/Layers.svelte';

  import {
    Button,
    ContentSwitcher,
    Switch,
    SkeletonPlaceholder,
    SkeletonText,
  } from 'carbon-components-svelte';
  import Edit from 'carbon-icons-svelte/lib/Edit.svelte';
  import Checkmark from 'carbon-icons-svelte/lib/Checkmark.svelte';
  import {
    appState,
    setViewMode,
    toggleEditMode,
  } from '../../state/app-state.svelte';
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
      <div
        class="nav-controls"
        class:drawer-open={appState.selectedDeviceId !== null}
      >
        {#if !appState.editMode}
          <div class="view-toggle">
            <ContentSwitcher
              size="sm"
              selectedIndex={appState.viewMode === '2d' ? 0 : 1}
              aria-label="地图视图"
              on:change={(e) => setViewMode(e.detail === 0 ? '2d' : '3d')}
            >
              <Switch text="2D"
                ><span class="mode-label"><Floorplan size={16} />2D</span
                ></Switch
              ><Switch text="3D"
                ><span class="mode-label"><Layers size={16} />3D</span></Switch
              >
            </ContentSwitcher>
          </div>
        {/if}
        {#if appState.viewMode === '2d' && currentMap.id !== 'site'}
          <Button
            size="small"
            kind={appState.editMode ? 'primary' : 'tertiary'}
            icon={appState.editMode ? Checkmark : Edit}
            aria-label={appState.editMode ? '退出编辑' : '编辑模式'}
            title="编辑当前平面图"
            on:click={toggleEditMode}
            ><span class="edit-button-label"
              >{appState.editMode ? '退出编辑' : '编辑模式'}</span
            ></Button
          >
        {/if}
      </div>

      {#key appState.activeMapId}
        {#if appState.viewMode === '2d'}<FactoryMap />{:else}<Factory3D />{/if}
      {/key}
      {#if !appState.devicesReady}
        <div
          class="map-loading"
          role="status"
          aria-label="正在加载设备数据"
          aria-busy="true"
        >
          <SkeletonPlaceholder width="100%" height="100%" />
          <div class="map-loading-label">
            <SkeletonText heading width="180px" />
            <SkeletonText width="240px" />
          </div>
        </div>
      {/if}
      <DeviceDrawer />
    </div>
    {#if appState.editMode && appState.viewMode === '2d'}<EditPanel />{/if}
  </div>
</div>

<style>
  .map-loading {
    position: absolute;
    inset: 0;
    z-index: 12;
    background: var(--bg-primary);
  }
  .map-loading-label {
    position: absolute;
    left: 24px;
    top: 24px;
  }
  .map-page {
    flex: 1;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
    min-height: 0;
    position: relative;
  }
  .nav-controls {
    position: absolute;
    top: 16px;
    right: 16px;
    z-index: 15;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px;
    background: var(--bg-primary);
    box-shadow: var(--shadow);
  }
  .view-toggle {
    width: 144px;
  }
  .nav-controls.drawer-open {
    right: calc(var(--sidebar-width) + 16px);
  }
  @media (max-width: 800px) {
    .nav-controls.drawer-open {
      display: none;
    }
  }
  .view-toggle :global(.bx--content-switcher-btn) {
    min-width: 0;
    padding: 0 12px;
  }
  .view-toggle :global(.bx--content-switcher--selected) {
    background: var(--accent);
    color: #ffffff;
  }
  .mode-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
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
  @media (max-width: 600px) {
    .nav-controls {
      top: 8px;
      right: 8px;
    }
    .map-content {
      flex-direction: column;
    }
    .map-content :global(.edit-panel) {
      width: 100%;
      max-height: 45%;
      border-left: 0;
      border-top: 1px solid var(--border);
    }
    .view-toggle {
      width: 144px;
    }
    .edit-button-label {
      display: none;
    }
    .nav-controls :global(.bx--btn) {
      width: 32px;
      min-width: 32px;
      padding: 0;
      justify-content: center;
    }
    .nav-controls :global(.bx--btn__icon) {
      position: static;
      margin: 0;
    }
  }
</style>

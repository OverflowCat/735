<script lang="ts">
  import { appState } from '../../state/app-state.svelte';
  import FactoryMap from './FactoryMap.svelte';
  import Factory3D from '../three/Factory3D.svelte';
  import DeviceDrawer from '../device/DeviceDrawer.svelte';
  import EditPanel from './EditPanel.svelte';
</script>

<div class="map-page">
  <div class="map-main">
    {#if appState.viewMode === '2d'}
      <FactoryMap />
    {:else}
      <Factory3D />
    {/if}
    <DeviceDrawer />
  </div>
  {#if appState.editMode && appState.viewMode === '2d'}
    <EditPanel />
  {/if}
</div>

<style>
  .map-page {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-width: 0;
  }

  .map-main {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-width: 0;
    position: relative;
  }
</style>

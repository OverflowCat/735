<script lang="ts">
  import { appState } from '../../state/app-state.svelte';
  import FactoryMap from './FactoryMap.svelte';
  import Factory3D from '../three/Factory3D.svelte';
  import DeviceDrawer from '../device/DeviceDrawer.svelte';
</script>

<div class="map-page">
  {#if appState.viewMode === '2d'}
    <FactoryMap />
  {:else}
    <Factory3D />
  {/if}
  <DeviceDrawer />
</div>

<style>
  .map-page {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
</style>

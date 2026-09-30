<script lang="ts">
  import { onMount } from 'svelte';
  import { appState, navigate, loadDevices, loadScene } from './lib/state/app-state.svelte';
  import NavBar from './lib/components/common/NavBar.svelte';
  import MapPage from './lib/components/map/MapPage.svelte';
  import OverviewPage from './lib/components/overview/OverviewPage.svelte';

  async function init() {
    await Promise.all([loadDevices(), loadScene()]);
  }

  function syncHash() {
    const hash = window.location.hash.replace('#', '') || '/map';
    navigate(hash);
  }

  onMount(() => {
    syncHash();
    window.addEventListener('hashchange', syncHash);
    init();
    return () => window.removeEventListener('hashchange', syncHash);
  });
</script>

<NavBar />
<main>
  {#if appState.currentRoute === '/map'}
    <MapPage />
  {:else if appState.currentRoute === '/overview'}
    <OverviewPage />
  {:else}
    <MapPage />
  {/if}
</main>

<style>
  main {
    flex: 1;
    display: flex;
    overflow: hidden;
  }
</style>

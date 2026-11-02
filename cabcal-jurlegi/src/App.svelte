<script lang="ts">
  import { onMount } from 'svelte';
  import {
    appState,
    navigate,
    loadDevices,
  } from './lib/state/app-state.svelte';
  import NavBar from './lib/components/common/NavBar.svelte';
  import MapPage from './lib/components/map/MapPage.svelte';
  import OverviewPage from './lib/components/overview/OverviewPage.svelte';

  function syncHash() {
    const hash = window.location.hash.replace('#', '') || '/map';
    navigate(hash);
  }

  onMount(() => {
    syncHash();
    window.addEventListener('hashchange', syncHash);
    void loadDevices();
    const refreshTimer = window.setInterval(() => {
      if (!document.hidden) void loadDevices();
    }, 5000);
    function refreshOnReturn() {
      if (!document.hidden) void loadDevices();
    }
    window.addEventListener('focus', refreshOnReturn);
    document.addEventListener('visibilitychange', refreshOnReturn);
    return () => {
      window.clearInterval(refreshTimer);
      window.removeEventListener('hashchange', syncHash);
      window.removeEventListener('focus', refreshOnReturn);
      document.removeEventListener('visibilitychange', refreshOnReturn);
    };
  });
</script>

<NavBar />
<main id="main-content" tabindex="-1">
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

<script lang="ts">
  import { onMount } from 'svelte';
  import {
    appState,
    navigate,
    loadDevices,
  } from './lib/state/app-state.svelte';
  import { SkipToContent } from 'carbon-components-svelte';
  import SideBar from './lib/components/common/SideBar.svelte';
  import MapPage from './lib/components/map/MapPage.svelte';
  import OverviewPage from './lib/components/overview/OverviewPage.svelte';
  import QueryPage from './lib/components/overview/QueryPage.svelte';

  let windowWidth = $state(window.innerWidth);
  let mobileNavOpen = $state(false);
  let sidebarCollapsed = $state(readSidebarPreference());
  const mobile = $derived(windowWidth < 900);
  const sidebarExpanded = $derived(mobile ? mobileNavOpen : !sidebarCollapsed);

  function readSidebarPreference() {
    try {
      return localStorage.getItem('cabcal-sidebar-collapsed') === 'true';
    } catch {
      return false;
    }
  }

  function toggleSidebar() {
    if (mobile) mobileNavOpen = !mobileNavOpen;
    else {
      sidebarCollapsed = !sidebarCollapsed;
      try {
        localStorage.setItem(
          'cabcal-sidebar-collapsed',
          String(sidebarCollapsed),
        );
      } catch {
        // The navigation still works when browser storage is unavailable.
      }
    }
  }

  function closeMobileNav() {
    mobileNavOpen = false;
  }

  function syncHash() {
    const hash = window.location.hash.replace('#', '') || '/map';
    navigate(hash);
  }

  onMount(() => {
    syncHash();
    window.addEventListener('hashchange', syncHash);
    // TEMP(dev-only): memory-leak test hook, removed after diagnostics.
    if (import.meta.env.DEV) (window as any).__tick = () => loadDevices();
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

<svelte:window
  bind:innerWidth={windowWidth}
  onkeydown={(event) => {
    if (event.key === 'Escape') closeMobileNav();
  }}
/>

<SkipToContent
  href="#main-content"
  on:click={(event) => {
    event.preventDefault();
    document.getElementById('main-content')?.focus();
  }}>跳转到主要内容</SkipToContent
>
<div
  class="app-workspace"
  style:--navigation-width={mobile || !sidebarExpanded ? '48px' : '208px'}
>
  {#if mobile && sidebarExpanded}
    <button
      class="navigation-backdrop"
      aria-label="关闭导航"
      tabindex="-1"
      onclick={closeMobileNav}
    ></button>
  {/if}
  <SideBar
    expanded={sidebarExpanded}
    ontoggle={toggleSidebar}
    onselect={closeMobileNav}
  />
  <main id="main-content" tabindex="-1" inert={mobile && sidebarExpanded}>
    {#if appState.currentRoute === '/overview'}
      <OverviewPage />
    {:else if appState.currentRoute === '/query'}
      <QueryPage />
    {:else}
      <MapPage />
    {/if}
  </main>
</div>

<style>
  .app-workspace {
    flex: 1;
    min-height: 0;
    display: flex;
    padding-left: var(--navigation-width);
  }
  main {
    flex: 1;
    display: flex;
    overflow: hidden;
    min-width: 0;
    position: relative;
  }
  .navigation-backdrop {
    position: fixed;
    inset: 0;
    z-index: 5999;
    border: 0;
    background: #00000080;
  }
</style>

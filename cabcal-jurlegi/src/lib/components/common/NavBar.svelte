<script lang="ts">
  import { appState, navigate, toggleEditMode, setViewMode } from '../../state/app-state.svelte';

  const isMap = $derived(appState.currentRoute === '/map');
</script>

<nav class="navbar">
  <div class="nav-brand">
    <span class="brand-icon">⚙</span>
    <span class="brand-text">工厂辐射监测系统</span>
  </div>

  <div class="nav-links">
    <button
      class:active={isMap}
      onclick={() => navigate('/map')}
    >
      工厂地图
    </button>
    <button
      class:active={appState.currentRoute === '/overview'}
      onclick={() => navigate('/overview')}
    >
      监测总览
    </button>
  </div>

  {#if isMap}
    <div class="nav-controls">
      <div class="view-toggle">
        <button
          class:active={appState.viewMode === '2d'}
          onclick={() => setViewMode('2d')}
        >
          2D
        </button>
        <button
          class:active={appState.viewMode === '3d'}
          onclick={() => setViewMode('3d')}
        >
          3D
        </button>
      </div>
      {#if appState.viewMode === '2d'}
        <button
          class:active={appState.editMode}
          onclick={toggleEditMode}
        >
          {appState.editMode ? '退出编辑' : '编辑模式'}
        </button>
      {/if}
    </div>
  {/if}
</nav>

<style>
  .navbar {
    height: var(--nav-height);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 16px;
    gap: 20px;
    flex-shrink: 0;
    z-index: 100;
  }

  .nav-brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 600;
    font-size: 15px;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .brand-icon {
    font-size: 18px;
    color: var(--accent);
  }

  .nav-links {
    display: flex;
    gap: 4px;
  }

  .nav-controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .view-toggle {
    display: flex;
    gap: 0;
  }

  .view-toggle button {
    border-radius: 0;
  }

  .view-toggle button:first-child {
    border-radius: var(--radius) 0 0 var(--radius);
  }

  .view-toggle button:last-child {
    border-radius: 0 var(--radius) var(--radius) 0;
    border-left: 0;
  }
</style>

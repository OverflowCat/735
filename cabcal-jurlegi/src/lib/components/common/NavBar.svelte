<script lang="ts">
  import {
    appState,
    navigate,
    toggleEditMode,
    setViewMode,
  } from '../../state/app-state.svelte';
  import MapNavigation from '../map/MapNavigation.svelte';

  const isMap = $derived(appState.currentRoute === '/map');
  const dataLabel = $derived(
    appState.dataMode === 'mock'
      ? '演示数据'
      : appState.dataRefreshFailed
        ? '刷新失败'
        : '现场数据',
  );
  const dataTitle = $derived(
    appState.dataMode === 'mock'
      ? '演示数据 · 未连接采集服务，自动重试中'
      : `${appState.dataRefreshFailed ? '刷新失败 · 保留上次读数，自动重试中' : '每 5 秒刷新'} · 上次同步 ${appState.dataUpdatedAt ? new Date(appState.dataUpdatedAt).toLocaleTimeString('zh-CN') : '—'}`,
  );
</script>

<header class="navbar">
  <div class="nav-brand" title="工厂辐射监测系统">
    <span class="brand-icon" aria-hidden="true">735</span>
    <span class="brand-text">辐射监测</span>
  </div>
  <nav class="nav-links" aria-label="主导航">
    <button
      class:active={isMap}
      aria-current={isMap ? 'page' : undefined}
      onclick={() => navigate('/map')}>工厂地图</button
    >
    <button
      class:active={appState.currentRoute === '/overview'}
      aria-current={appState.currentRoute === '/overview' ? 'page' : undefined}
      onclick={() => navigate('/overview')}>监测总览</button
    >
  </nav>
  {#if isMap}
    <MapNavigation />
    <div class="nav-controls">
      <span
        class="data-indicator"
        class:demo={appState.dataMode === 'mock'}
        class:stale={appState.dataRefreshFailed}
        title={dataTitle}
        ><i aria-hidden="true"></i><span>{dataLabel}</span></span
      >
      <div class="view-toggle">
        <button
          class:active={appState.viewMode === '2d'}
          onclick={() => setViewMode('2d')}>2D</button
        >
        <button
          class:active={appState.viewMode === '3d'}
          onclick={() => setViewMode('3d')}>3D</button
        >
      </div>
      {#if appState.viewMode === '2d'}
        <button
          class:active={appState.editMode}
          disabled={appState.activeMapId === 'site'}
          title={appState.activeMapId === 'site'
            ? '进入建筑平面图后编辑设备位置'
            : '编辑当前平面图'}
          onclick={toggleEditMode}
          >{appState.editMode ? '退出编辑' : '编辑模式'}</button
        >
      {/if}
    </div>
  {/if}
</header>

<style>
  .navbar {
    height: var(--nav-height);
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    padding: 0 14px;
    gap: 14px;
    flex-shrink: 0;
    min-width: 0;
    z-index: 100;
  }
  .nav-brand {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 8px;
    font-weight: 650;
    font-size: 15px;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .brand-icon {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border: 1px solid #60a5fa55;
    border-radius: 7px;
    background: #3b82f612;
    color: #93c5fd;
    font: 600 11px var(--font-mono);
    letter-spacing: 0;
  }
  .nav-links {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    padding-right: 14px;
    border-right: 1px solid #ffffff15;
  }
  .nav-links button {
    padding: 6px 9px;
    border: 0;
    border-radius: 5px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .nav-links button.active {
    background: #ffffff0c;
    color: var(--text-primary);
    font-weight: 600;
  }
  .nav-links button:hover {
    color: var(--text-primary);
  }
  .nav-controls {
    margin-left: auto;
    display: flex;
    align-items: center;
    flex-shrink: 0;
    gap: 10px;
  }
  .nav-controls button {
    padding: 5px 9px;
    font-size: 12px;
    white-space: nowrap;
  }
  .nav-controls button:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .data-indicator {
    display: flex;
    align-items: center;
    gap: 5px;
    color: #9bb8ab;
    font-size: 10px;
    white-space: nowrap;
  }
  .data-indicator i {
    width: 5px;
    height: 5px;
    border-radius: 50%;
    background: #34d399;
  }
  .data-indicator.demo,
  .data-indicator.stale {
    color: #fbbf24;
  }
  .data-indicator.demo i,
  .data-indicator.stale i {
    background: #fbbf24;
  }
  .view-toggle {
    display: flex;
    padding: 2px;
    border: 1px solid #ffffff15;
    border-radius: 6px;
    background: var(--bg-primary);
  }
  .view-toggle button {
    padding: 3px 7px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font: 500 11px/18px var(--font-mono);
  }
  .view-toggle button.active {
    background: #334155;
    color: #f1f5f9;
  }
  @media (max-width: 1250px) {
    .navbar {
      gap: 10px;
      padding: 0 10px;
    }
    .brand-text {
      display: none;
    }
    .nav-links {
      padding-right: 10px;
    }
    .data-indicator span {
      display: none;
    }
  }
  @media (max-width: 700px) {
    .nav-brand {
      display: none;
    }
    .navbar {
      gap: 6px;
      padding: 0 6px;
    }
    .nav-links {
      padding-right: 6px;
    }
    .nav-links button {
      padding: 6px;
      font-size: 11px;
    }
    .nav-controls {
      gap: 6px;
    }
    .data-indicator {
      display: none;
    }
  }
</style>

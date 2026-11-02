<script lang="ts">
  import { appState, switchMap } from '../../state/app-state.svelte';
  import {
    buildings,
    mapById,
    mapDefinitions,
  } from '../../data/floorplans/maps';

  const currentMap = $derived(mapById(appState.activeMapId));
  const floors = $derived(
    mapDefinitions.filter((m) => m.building === currentMap.building && m.floor),
  );

  function buildingSummary(id: string) {
    const ids = new Set(
      mapDefinitions
        .filter((m) => m.building === id)
        .flatMap((m) => m.scene.devices.map((p) => p.deviceId)),
    );
    const devices = appState.devices.filter((d) => ids.has(d.id));
    return {
      count: devices.length,
      alarms: devices.filter((d) => d.alarms.length > 0).length,
    };
  }
</script>

<nav class="map-navigation" aria-label="区域选择">
  <button
    class:active={currentMap.id === 'site'}
    aria-current={currentMap.id === 'site' ? 'page' : undefined}
    onclick={() => switchMap('site')}>厂区总览</button
  >
  {#each buildings as building}
    {@const summary = buildingSummary(building.id)}
    <button
      class:active={currentMap.building === building.id}
      aria-current={currentMap.building === building.id ? 'page' : undefined}
      title={`${building.name} · ${summary.count} 点位${summary.alarms ? ` · ${summary.alarms} 报警` : ''}`}
      onclick={() => switchMap(building.mapId)}
    >
      {building.name}<small
        >{summary.count}<span class="sr-only"> 点位</span></small
      >
      {#if summary.alarms}<span class="alarm-count">{summary.alarms} 报警</span
        >{/if}
    </button>
  {/each}
</nav>
{#if floors.length > 0}
  <div class="floor-tabs" role="group" aria-label="水冶厂楼层">
    {#each floors as floor}
      <button
        class:active={floor.id === currentMap.id}
        aria-pressed={floor.id === currentMap.id}
        onclick={() => switchMap(floor.id)}>{floor.floor} 楼</button
      >
    {/each}
  </div>
{/if}

<style>
  .map-navigation {
    display: flex;
    align-self: stretch;
    align-items: stretch;
    gap: 2px;
    min-width: 90px;
    flex: 1;
    overflow-x: auto;
    scrollbar-width: thin;
  }
  .map-navigation button {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    gap: 6px;
    padding: 0 10px;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--text-secondary);
    font-size: 13px;
    white-space: nowrap;
  }
  .map-navigation button:hover {
    background: #ffffff06;
    color: var(--text-primary);
  }
  .map-navigation button.active {
    background: linear-gradient(0deg, #3b82f619, transparent);
    color: #bfdbfe;
    font-weight: 650;
  }
  .map-navigation button.active::after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 10px;
    right: 10px;
    height: 3px;
    border-radius: 3px 3px 0 0;
    background: #60a5fa;
  }
  small {
    padding: 0 5px;
    border-radius: 4px;
    background: #ffffff09;
    color: var(--text-muted);
    font: 10px/18px var(--font-mono);
  }
  .active small {
    background: #60a5fa20;
    color: #bfdbfe;
  }
  .alarm-count {
    color: #fbbf24;
    font-size: 10px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  .floor-tabs {
    display: flex;
    flex-shrink: 0;
    gap: 2px;
    padding: 3px;
    background: var(--bg-primary);
    border: 1px solid #ffffff12;
    border-radius: 6px;
  }
  .floor-tabs button {
    padding: 3px 7px;
    border: 0;
    border-radius: 4px;
    background: transparent;
    color: var(--text-muted);
    font-size: 12px;
    white-space: nowrap;
  }
  .floor-tabs button.active {
    background: #334155;
    color: var(--text-primary);
  }
  @media (max-width: 1250px) {
    small {
      display: none;
    }
    .map-navigation button {
      padding: 0 9px;
    }
  }
</style>

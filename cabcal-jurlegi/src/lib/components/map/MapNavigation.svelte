<script lang="ts">
  import Map from 'carbon-icons-svelte/lib/Map.svelte';
  import Building from 'carbon-icons-svelte/lib/Building.svelte';

  import { Button, Tag } from 'carbon-components-svelte';
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

<div class="region-bar">
  <nav class="map-navigation" aria-label="区域选择">
    <Button
      kind="ghost"
      size="field"
      icon={Map}
      aria-current={currentMap.id === 'site' ? 'page' : undefined}
      on:click={() => switchMap('site')}>厂区总览</Button
    >
    {#each buildings as building}
      {@const summary = buildingSummary(building.id)}
      <Button
        kind="ghost"
        size="field"
        aria-current={currentMap.building === building.id ? 'page' : undefined}
        icon={Building}
        title={`${building.name} · ${summary.count} 点位${summary.alarms ? ` · ${summary.alarms} 报警` : ''}`}
        on:click={() => switchMap(building.mapId)}
      >
        {building.name}<span class="region-count"
          >{summary.count}<span class="sr-only"> 点位</span></span
        >
        {#if summary.alarms}<Tag type="red" size="sm">{summary.alarms} 报警</Tag
          >{/if}
      </Button>
    {/each}
  </nav>
  {#if floors.length > 0}
    <div class="floor-tabs" role="group" aria-label="水冶厂楼层">
      {#each floors as floor}
        <Button
          size="small"
          kind={floor.id === currentMap.id ? 'primary' : 'ghost'}
          aria-pressed={floor.id === currentMap.id}
          on:click={() => switchMap(floor.id)}>{floor.floor} 楼</Button
        >
      {/each}
    </div>
  {/if}
</div>

<style>
  .region-bar {
    display: flex;
    min-height: 48px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
    gap: 16px;
    padding: 0 24px;
  }
  .map-navigation {
    display: flex;
    align-items: stretch;
    flex: 1;
    overflow-x: auto;
    min-width: 0;
  }
  .map-navigation :global(.bx--btn) {
    color: var(--text-secondary);
    padding: 0 40px 0 16px;
    white-space: nowrap;
    flex-shrink: 0;
    max-width: none;
    min-height: 48px;
    border-bottom: 2px solid transparent;
  }
  .map-navigation :global([aria-current='page']) {
    border-bottom-color: #78a9ff;
    color: #f4f4f4;
    background: #393939;
  }
  .region-count {
    margin-left: 8px;
    color: var(--text-muted);
    font: 12px var(--font-mono);
  }
  .floor-tabs {
    display: flex;
    align-items: center;
    gap: 1px;
    flex-shrink: 0;
  }
  .floor-tabs :global(.bx--btn) {
    padding: 0 12px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
  @media (max-width: 900px) {
    .region-bar {
      padding: 0 12px;
      gap: 8px;
      flex-wrap: wrap;
    }
    .floor-tabs {
      margin-bottom: 8px;
    }
  }
</style>

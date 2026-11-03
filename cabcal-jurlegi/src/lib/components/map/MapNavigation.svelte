<script lang="ts">
  import { SideNavItems, SideNavLink, Tag } from 'carbon-components-svelte';
  import MapBoundary from 'carbon-icons-svelte/lib/MapBoundary.svelte';
  import Mountain from 'carbon-icons-svelte/lib/Mountain.svelte';
  import DrillDown from 'carbon-icons-svelte/lib/DrillDown.svelte';
  import Layers from 'carbon-icons-svelte/lib/Layers.svelte';
  import Filter from 'carbon-icons-svelte/lib/Filter.svelte';
  import Chemistry from 'carbon-icons-svelte/lib/Chemistry.svelte';
  import Floorplan from 'carbon-icons-svelte/lib/Floorplan.svelte';
  import { appState, switchMap, navigate } from '../../state/app-state.svelte';
  import {
    buildings,
    mapById,
    mapDefinitions,
  } from '../../data/floorplans/maps';

  let { expanded, onselect }: { expanded: boolean; onselect: () => void } =
    $props();
  const areaIcons = {
    c19: Mountain,
    c35: DrillDown,
    c3: Layers,
    filter: Filter,
    hydromet: Chemistry,
  };
  const currentMap = $derived(mapById(appState.activeMapId));
  const isMap = $derived(appState.currentRoute !== '/overview');

  function buildingSummary(id: string) {
    const ids = new Set(
      mapDefinitions
        .filter((map) => map.building === id)
        .flatMap((map) =>
          map.scene.devices.map((placement) => placement.deviceId),
        ),
    );
    const devices = appState.devices.filter((device) => ids.has(device.id));
    return {
      count: devices.length,
      alarms: devices.filter((device) => device.alarms.length > 0).length,
    };
  }

  function choose(id: string) {
    switchMap(id);
    navigate('/map');
    onselect();
  }
</script>

<div
  class="map-navigation"
  class:collapsed={!expanded}
  role="group"
  aria-label="厂区与楼层"
>
  {#if expanded}<p class="section-label">监测区域</p>{:else}<div
      class="section-divider"
    ></div>{/if}
  <SideNavItems>
    <SideNavLink
      href="#/map"
      icon={MapBoundary}
      text="厂区总览"
      title="厂区总览"
      aria-label="厂区总览"
      isSelected={isMap && currentMap.id === 'site'}
      on:click={(event) => {
        event.preventDefault();
        choose('site');
      }}
    />
    {#each buildings as building}
      {@const summary = buildingSummary(building.id)}
      {@const floors = mapDefinitions.filter(
        (map) => map.building === building.id && map.floor,
      )}
      {@const active = isMap && currentMap.building === building.id}
      <SideNavLink
        href="#/map"
        icon={areaIcons[building.id as keyof typeof areaIcons]}
        isSelected={active}
        title={`${building.name} · ${summary.count} 点位${summary.alarms ? ` · ${summary.alarms} 报警` : ''}`}
        aria-label={building.name}
        data-area={building.id}
        on:click={(event) => {
          event.preventDefault();
          choose(active ? currentMap.id : building.mapId);
        }}
      >
        {building.name}<span class="region-count"
          >{summary.count}<span class="sr-only"> 点位</span></span
        >
        {#if expanded && summary.alarms}<Tag slot="badge" type="red" size="sm"
            >{summary.alarms} 报警</Tag
          >{/if}
      </SideNavLink>
      {#if active && floors.length > 0 && expanded}
        <li class="floor-navigation">
          <ul class="floor-tabs" aria-label={`${building.name}楼层`}>
            {#each floors as floor}
              <SideNavLink
                href="#/map"
                icon={Floorplan}
                title={`${floor.floor} 楼`}
                aria-label={`${floor.floor} 楼`}
                isSelected={floor.id === currentMap.id}
                on:click={(event) => {
                  event.preventDefault();
                  choose(floor.id);
                }}>{floor.floor} 楼</SideNavLink
              >
            {/each}
          </ul>
        </li>
      {/if}
    {/each}
  </SideNavItems>
</div>

<style>
  .map-navigation {
    padding-top: 16px;
  }
  .section-label {
    color: var(--text-muted);
    font-size: 13px;
    margin: 0 16px 8px;
    line-height: 16px;
  }
  .section-divider {
    margin: 0 12px 8px;
    height: 1px;
    background: var(--border);
  }
  .region-count {
    margin-left: 8px;
    color: var(--text-muted);
    font: 13px var(--font-mono);
  }
  .floor-navigation {
    list-style: none;
  }
  .floor-tabs {
    padding: 4px 0 4px 24px;
    margin: 0;
    list-style: none;
  }
  .floor-tabs :global(.bx--side-nav__link) {
    min-height: 44px;
    font-size: 15px;
  }
  .floor-tabs :global(.bx--side-nav__icon) {
    margin-right: 12px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
</style>

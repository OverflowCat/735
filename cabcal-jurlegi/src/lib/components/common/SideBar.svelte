<script lang="ts">
  import {
    SideNav,
    SideNavItems,
    SideNavLink,
    Button,
  } from 'carbon-components-svelte';
  import Map from 'carbon-icons-svelte/lib/Map.svelte';
  import Dashboard from 'carbon-icons-svelte/lib/Dashboard.svelte';
  import ChevronLeft from 'carbon-icons-svelte/lib/ChevronLeft.svelte';
  import ChevronRight from 'carbon-icons-svelte/lib/ChevronRight.svelte';
  import Location from 'carbon-icons-svelte/lib/Location.svelte';
  import CheckmarkFilled from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import WifiOff from 'carbon-icons-svelte/lib/WifiOff.svelte';
  import WarningFilled from 'carbon-icons-svelte/lib/WarningFilled.svelte';
  import { appState, mapDevices } from '../../state/app-state.svelte';
  import { mapById } from '../../data/floorplans/maps';
  import MapNavigation from '../map/MapNavigation.svelte';

  let {
    expanded,
    ontoggle,
    onselect,
  }: { expanded: boolean; ontoggle: () => void; onselect: () => void } =
    $props();
  const currentMap = $derived(mapById(appState.activeMapId));
  const devices = $derived(mapDevices());
  const online = $derived(
    devices.filter((device) => device.status === 'online').length,
  );
  const alarms = $derived(
    devices.filter((device) => device.alarms.length > 0).length,
  );
</script>

<div
  id="app-sidebar"
  class="app-sidebar"
  class:collapsed={!expanded}
  style:--side-width={expanded ? '256px' : '48px'}
>
  <SideNav fixed rail={!expanded} isOpen ariaLabel="主导航" border>
    <div class="sidebar-scroll">
      <SideNavItems>
        <SideNavLink
          href="#/map"
          text="工厂地图"
          icon={Map}
          title="工厂地图"
          aria-label="工厂地图"
          large
          isSelected={appState.currentRoute !== '/overview'}
          on:click={onselect}
        />
        <SideNavLink
          href="#/overview"
          text="监测总览"
          icon={Dashboard}
          title="监测总览"
          aria-label="监测总览"
          large
          isSelected={appState.currentRoute === '/overview'}
          on:click={onselect}
        />
      </SideNavItems>
      <MapNavigation {expanded} {onselect} />
    </div>
    {#if expanded && appState.currentRoute !== '/overview'}
      <section class="area-summary" aria-label="当前区域状态">
        <h1>{currentMap.name}</h1>
        <div class="summary-line">
          <span><Location size={14} />监测点位</span><strong
            >{devices.length}</strong
          >
        </div>
        <div class="summary-line">
          <span><CheckmarkFilled size={14} />在线</span><strong>{online}</strong
          >
        </div>
        <div class="summary-line">
          <span><WifiOff size={14} />离线 / 故障 / 未上报</span><strong
            >{devices.length - online}</strong
          >
        </div>
        <div class="summary-line" class:alarm={alarms > 0}>
          <span><WarningFilled size={14} />报警设备</span><strong
            >{alarms}</strong
          >
        </div>
      </section>
    {/if}
    <div class="sidebar-footer">
      <Button
        kind="ghost"
        size="field"
        icon={expanded ? ChevronLeft : ChevronRight}
        iconDescription={expanded ? '收起侧栏' : '展开侧栏'}
        aria-expanded={expanded}
        aria-controls="app-sidebar"
        on:click={ontoggle}
      />
      {#if expanded}<span>收起导航</span>{/if}
    </div>
  </SideNav>
</div>

<style>
  .app-sidebar {
    position: fixed;
    top: 48px;
    bottom: 0;
    left: 0;
    width: var(--side-width);
    z-index: 6000;
  }
  .app-sidebar :global(.bx--side-nav),
  .app-sidebar :global(.bx--side-nav:hover) {
    position: absolute;
    inset: 0;
    width: 100%;
    min-width: 0;
    max-width: none;
    height: 100%;
    transform: none;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .sidebar-scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    overflow-x: hidden;
    padding-top: 8px;
  }
  .app-sidebar :global(.bx--side-nav__items) {
    padding: 0;
  }
  .app-sidebar :global(.bx--side-nav__icon) {
    flex-shrink: 0;
  }
  .collapsed :global(.bx--side-nav__link-text),
  .collapsed :global(.bx--side-nav__link-badge) {
    display: none;
  }
  .collapsed :global(.bx--side-nav__link) {
    padding: 0 16px;
    min-width: 48px;
  }
  .collapsed :global(.bx--side-nav__icon) {
    margin-right: 0;
  }
  .area-summary {
    padding: 20px 16px 16px;
    border-top: 1px solid #393939;
  }
  h1 {
    font-size: 14px;
    line-height: 20px;
    font-weight: 600;
    margin: 0 0 16px;
  }
  .summary-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    line-height: 28px;
    color: var(--text-secondary);
  }
  .summary-line span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .summary-line strong {
    font: 12px var(--font-mono);
  }
  .alarm {
    color: var(--alarm-l2);
  }
  .sidebar-footer {
    border-top: 1px solid #393939;
    display: flex;
    align-items: center;
    min-height: 48px;
    flex-shrink: 0;
  }
  .sidebar-footer span {
    font-size: 12px;
    color: var(--text-muted);
  }
  .sidebar-footer :global(.bx--btn) {
    width: 48px;
    height: 48px;
  }
  @media (max-height: 700px) {
    .area-summary {
      display: none;
    }
  }
</style>

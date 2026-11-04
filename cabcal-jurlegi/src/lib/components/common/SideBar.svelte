<script lang="ts">
  import {
    SideNav,
    SideNavItems,
    SideNavLink,
    Button,
    SkeletonText,
    Tag,
    InlineLoading,
  } from 'carbon-components-svelte';
  import Map from 'carbon-icons-svelte/lib/Map.svelte';
  import Dashboard from 'carbon-icons-svelte/lib/Dashboard.svelte';
  import Menu from 'carbon-icons-svelte/lib/Menu.svelte';
  import ChartScatter from 'carbon-icons-svelte/lib/ChartScatter.svelte';
  import Renew from 'carbon-icons-svelte/lib/Renew.svelte';
  import Connect from 'carbon-icons-svelte/lib/Connect.svelte';
  import InformationFilled from 'carbon-icons-svelte/lib/InformationFilled.svelte';
  import Location from 'carbon-icons-svelte/lib/Location.svelte';
  import CheckmarkFilled from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import WifiOff from 'carbon-icons-svelte/lib/WifiOff.svelte';
  import WarningFilled from 'carbon-icons-svelte/lib/WarningFilled.svelte';
  import {
    appState,
    mapDevices,
    loadDevices,
  } from '../../state/app-state.svelte';
  import { mapById } from '../../data/floorplans/maps';
  import MapNavigation from '../map/MapNavigation.svelte';

  let {
    expanded,
    ontoggle,
    onselect,
  }: { expanded: boolean; ontoggle: () => void; onselect: () => void } =
    $props();
  const currentMap = $derived(mapById(appState.activeMapId));
  const dataLabel = $derived(
    appState.dataMode === 'mock'
      ? '演示数据'
      : appState.dataRefreshFailed
        ? '刷新失败'
        : '现场数据',
  );
  const dataTitle = $derived(
    !appState.devicesReady
      ? '正在连接采集服务'
      : appState.dataMode === 'mock'
        ? '未连接采集服务，自动重试中'
        : `${appState.dataRefreshFailed ? '刷新失败，保留上次读数' : '每 5 秒刷新'} · 上次同步 ${appState.dataUpdatedAt ? new Date(appState.dataUpdatedAt).toLocaleTimeString('zh-CN') : '—'}`,
  );
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
  style:--side-width={expanded ? '208px' : '48px'}
>
  <SideNav fixed rail={!expanded} isOpen ariaLabel="主导航" border>
    <div class="sidebar-brand">
      <Button
        kind="ghost"
        size="field"
        icon={Menu}
        iconDescription={expanded ? '收起侧栏' : '展开侧栏'}
        aria-expanded={expanded}
        aria-controls="app-sidebar"
        on:click={ontoggle}
      />
      {#if expanded}<img
          class="brand-logo"
          src="/cnnmc_logo.svg"
          alt="中核测控 CNNMC"
        />{/if}
    </div>
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
        <SideNavLink
          href="#/query"
          text="数据查询"
          icon={ChartScatter}
          title="数据查询"
          aria-label="数据查询"
          large
          isSelected={appState.currentRoute === '/query'}
          on:click={onselect}
        />
      </SideNavItems>
      <MapNavigation {expanded} {onselect} />
    </div>
    {#if expanded && appState.currentRoute !== '/overview'}
      <section class="area-summary" aria-label="当前区域状态">
        <h1>{currentMap.name}</h1>
        <div class="summary-line">
          <span><Location size={18} />监测点位</span><strong
            >{#if appState.devicesReady}{devices.length}{:else}<SkeletonText
                width="24px"
              />{/if}</strong
          >
        </div>
        <div class="summary-line">
          <span><CheckmarkFilled size={18} />在线</span><strong
            >{#if appState.devicesReady}{online}{:else}<SkeletonText
                width="24px"
              />{/if}</strong
          >
        </div>
        <div class="summary-line">
          <span title="离线、故障或未上报"
            ><WifiOff size={18} />离线 / 异常</span
          ><strong
            >{#if appState.devicesReady}{devices.length -
                online}{:else}<SkeletonText width="24px" />{/if}</strong
          >
        </div>
        <div class="summary-line" class:alarm={alarms > 0}>
          <span><WarningFilled size={18} />报警设备</span><strong
            >{#if appState.devicesReady}{alarms}{:else}<SkeletonText
                width="24px"
              />{/if}</strong
          >
        </div>
      </section>
    {/if}
    <div class="sidebar-footer" title={dataTitle}>
      <Button
        kind="ghost"
        size="field"
        icon={Renew}
        iconDescription="刷新监测数据"
        disabled={appState.devicesLoading}
        on:click={() => void loadDevices()}
      />
      {#if expanded}
        <div class="data-indicator" role="status">
          {#if !appState.devicesReady}<SkeletonText width="88px" />
          {:else if appState.devicesLoading}<InlineLoading
              description="正在刷新"
            />
          {:else}<Tag
              icon={appState.dataMode === 'mock'
                ? InformationFilled
                : appState.dataRefreshFailed
                  ? WarningFilled
                  : Connect}
              type={appState.dataMode === 'mock'
                ? 'purple'
                : appState.dataRefreshFailed
                  ? 'red'
                  : 'green'}>{dataLabel}</Tag
            >{/if}
        </div>
      {/if}
    </div>
  </SideNav>
</div>

<style>
  .app-sidebar {
    position: fixed;
    top: 0;
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
    background: var(--bg-secondary);
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
    width: 24px;
    height: 24px;
    margin-right: 12px;
  }
  .app-sidebar :global(.bx--side-nav__icon svg),
  .sidebar-brand :global(svg),
  .sidebar-footer :global(.bx--btn__icon) {
    width: 24px;
    height: 24px;
  }
  .app-sidebar :global(.bx--side-nav__link) {
    min-height: 48px;
    padding: 0 12px;
  }
  .app-sidebar :global(.bx--side-nav__link-text) {
    font-size: 16px;
    line-height: 24px;
  }
  .sidebar-brand {
    display: flex;
    align-items: center;
    flex-shrink: 0;
    min-height: 56px;
    background: var(--bg-secondary);
    border-bottom: 1px solid var(--border);
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 600;
    white-space: nowrap;
  }
  .sidebar-brand :global(.bx--btn) {
    width: 48px;
    height: 56px;
    color: var(--text-primary);
  }
  .sidebar-brand :global(.bx--btn:hover) {
    background: var(--bg-tertiary);
  }
  .sidebar-brand :global(.bx--btn:focus) {
    box-shadow: inset 0 0 0 2px var(--accent);
  }
  .brand-logo {
    height: 44px;
    width: auto;
    max-width: 152px;
    margin: 0 4px 0 4px;
    flex-shrink: 0;
    object-fit: contain;
  }
  .data-indicator {
    min-width: 0;
    padding-right: 8px;
  }
  .collapsed :global(.bx--side-nav__link-text),
  .collapsed :global(.bx--side-nav__link-badge) {
    display: none;
  }
  .collapsed :global(.bx--side-nav__link) {
    padding: 0 12px;
    min-width: 48px;
  }
  .collapsed :global(.bx--side-nav__icon) {
    margin-right: 0;
  }
  .area-summary {
    padding: 20px 16px 16px;
    border-top: 1px solid var(--border);
  }
  h1 {
    font-size: 16px;
    line-height: 24px;
    font-weight: 600;
    margin: 0 0 16px;
  }
  .summary-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 14px;
    line-height: 28px;
    color: var(--text-secondary);
  }
  .summary-line span {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .summary-line strong {
    font: 14px var(--font-mono);
  }
  .alarm {
    color: var(--alarm-l2);
  }
  .sidebar-footer {
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    min-height: 48px;
    flex-shrink: 0;
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

<script lang="ts">
  import Map from 'carbon-icons-svelte/lib/Map.svelte';
  import Dashboard from 'carbon-icons-svelte/lib/Dashboard.svelte';
  import Location from 'carbon-icons-svelte/lib/Location.svelte';
  import Connect from 'carbon-icons-svelte/lib/Connect.svelte';
  import InformationFilled from 'carbon-icons-svelte/lib/InformationFilled.svelte';
  import WarningFilled from 'carbon-icons-svelte/lib/WarningFilled.svelte';

  import {
    Header,
    HeaderNav,
    HeaderNavItem,
    HeaderUtilities,
    HeaderGlobalAction,
    Tag,
    SkipToContent,
  } from 'carbon-components-svelte';
  import Renew from 'carbon-icons-svelte/lib/Renew.svelte';
  import { appState, loadDevices } from '../../state/app-state.svelte';

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

<div class="navbar">
  <Header
    companyName="735"
    platformName="辐射监测"
    href="#/map"
    uiShellAriaLabel="735 工厂辐射监测系统"
  >
    <span slot="platform" class="brand-platform">辐射监测</span>
    <SkipToContent
      slot="skipToContent"
      href="#main-content"
      on:click={(event) => {
        event.preventDefault();
        document.getElementById('main-content')?.focus();
      }}>跳转到主要内容</SkipToContent
    >
    <HeaderNav aria-label="主导航">
      <HeaderNavItem
        href="#/map"
        text="工厂地图"
        icon={Map}
        isSelected={appState.currentRoute === '/map'}
      />
      <HeaderNavItem
        href="#/overview"
        text="监测总览"
        icon={Dashboard}
        isSelected={appState.currentRoute === '/overview'}
      />
    </HeaderNav>
    <HeaderUtilities>
      <div class="station-label">
        <Location size={16} />新疆站点 <span>STATION-01</span>
      </div>
      <div class="data-indicator" title={dataTitle} role="status">
        <Tag
          icon={appState.dataMode === 'mock'
            ? InformationFilled
            : appState.dataRefreshFailed
              ? WarningFilled
              : Connect}
          type={appState.dataMode === 'mock'
            ? 'purple'
            : appState.dataRefreshFailed
              ? 'red'
              : 'green'}
          size="sm">{dataLabel}</Tag
        >
      </div>
      <HeaderGlobalAction
        icon={Renew}
        iconDescription="刷新监测数据"
        on:click={() => void loadDevices()}
      />
    </HeaderUtilities>
  </Header>
</div>

<style>
  .navbar {
    height: 48px;
    flex-shrink: 0;
  }
  .navbar :global(.bx--header__nav) {
    display: block;
  }
  .station-label {
    display: flex;
    align-items: center;
    gap: 12px;
    color: #c6c6c6;
    font-size: 12px;
    padding: 0 16px;
    border-left: 1px solid #393939;
  }
  .station-label span {
    color: #8d8d8d;
    font-family: var(--font-mono);
  }
  .data-indicator {
    display: flex;
    align-items: center;
    padding-right: 16px;
  }
  @media (max-width: 800px) {
    .station-label {
      display: none;
    }
  }
  @media (max-width: 520px) {
    .brand-platform {
      display: none;
    }
    .navbar :global(.bx--header__action) {
      width: 32px;
      min-width: 32px;
      padding: 6px;
    }
    .navbar :global(.bx--header__name) {
      padding: 0 12px;
      font-size: 12px;
    }
    .navbar :global(.bx--header__menu-item) {
      padding: 0 6px;
      font-size: 12px;
    }
    .data-indicator {
      padding-right: 4px;
    }
  }
</style>

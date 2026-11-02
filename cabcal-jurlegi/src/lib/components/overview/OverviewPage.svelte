<script lang="ts">
  import Dashboard from 'carbon-icons-svelte/lib/Dashboard.svelte';
  import CheckmarkFilled from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import WifiOff from 'carbon-icons-svelte/lib/WifiOff.svelte';
  import Time from 'carbon-icons-svelte/lib/Time.svelte';
  import ErrorFilled from 'carbon-icons-svelte/lib/ErrorFilled.svelte';
  import WarningFilled from 'carbon-icons-svelte/lib/WarningFilled.svelte';
  import DataBase from 'carbon-icons-svelte/lib/DataBase.svelte';
  import ChartMultitype from 'carbon-icons-svelte/lib/ChartMultitype.svelte';
  import ArrowRight from 'carbon-icons-svelte/lib/ArrowRight.svelte';
  import Location from 'carbon-icons-svelte/lib/Location.svelte';
  import Activity from 'carbon-icons-svelte/lib/Activity.svelte';
  import Chemistry from 'carbon-icons-svelte/lib/Chemistry.svelte';

  import { untrack } from 'svelte';
  import {
    Tile,
    Tag,
    Search,
    DataTable,
    Select,
    SelectItem,
    Checkbox,
    Button,
    InlineLoading,
    InlineNotification,
  } from 'carbon-components-svelte';
  import Analytics from 'carbon-icons-svelte/lib/Analytics.svelte';
  import DeviceDrawer from '../device/DeviceDrawer.svelte';
  import {
    appState,
    dataSource,
    selectDevice,
  } from '../../state/app-state.svelte';
  import { relativeQuery, type HistoryQuery } from '../../services/data-source';
  import type { HistoricalPoint, Device } from '../../types/device';
  import { deviceSn, deviceStatusLabel } from '../../types/device';
  import ComparisonChart from '../charts/ComparisonChart.svelte';
  import TimeRangePicker from '../charts/TimeRangePicker.svelte';

  const totalDevices = $derived(appState.devices.length);
  const onlineCount = $derived(
    appState.devices.filter((d) => d.status === 'online').length,
  );
  const offlineCount = $derived(
    appState.devices.filter((d) => d.status === 'offline' && !d.unreported)
      .length,
  );
  const unreportedCount = $derived(
    appState.devices.filter((d) => d.unreported).length,
  );
  const faultCount = $derived(
    appState.devices.filter((d) => d.status === 'fault').length,
  );
  const alarmCount = $derived(
    appState.devices.filter((d) => d.alarms.length > 0).length,
  );

  let searchQuery = $state('');
  const filteredDevices = $derived(
    appState.devices.filter((d) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        deviceSn(d).toLowerCase().includes(q) ||
        d.id.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.type.includes(q)
      );
    }),
  );

  let compareMetric = $state<string>('0102060301');
  let compareQuery = $state<HistoryQuery>(relativeQuery('1h'));
  let selectedForCompare = $state<string[]>([]);
  let compareData = $state<
    { deviceId: string; name: string; points: HistoricalPoint[] }[]
  >([]);
  let compareLoading = $state(false);

  const metricOptions = [
    {
      value: '0102060301',
      label: 'γ剂量率实时值',
      unit: 'nGy/h',
      types: ['gamma'],
    },
    {
      value: '0102060302',
      label: '氡及子体浓度实时值',
      unit: 'Bq/m³',
      types: ['radon'],
    },
  ];

  const currentMetricOption = $derived(
    metricOptions.find((m) => m.value === compareMetric)!,
  );
  const compatibleDevices = $derived(
    appState.devices.filter((d) => currentMetricOption?.types.includes(d.type)),
  );

  function toggleCompareDevice(id: string) {
    const idx = selectedForCompare.indexOf(id);
    if (idx >= 0) {
      selectedForCompare.splice(idx, 1);
    } else if (selectedForCompare.length < 6) {
      selectedForCompare.push(id);
    }
    selectedForCompare = [...selectedForCompare];
  }

  let compareError = $state(false);

  function onRangeChange(q: HistoryQuery) {
    compareQuery = q;
  }

  $effect(() => {
    const ids = [...selectedForCompare];
    const metric = compareMetric;
    const query = compareQuery;
    const controller = new AbortController();
    untrack(() => {
      compareData = [];
      compareError = false;
      compareLoading = ids.length > 0;
      if (ids.length) {
        void Promise.all(
          ids.map(async (id) => ({
            deviceId: id,
            name: deviceSn(appState.devices.find((d) => d.id === id) ?? { id }),
            points: await dataSource.getHistory(id, metric, query, {
              signal: controller.signal,
            }),
          })),
        )
          .then((results) => {
            if (!controller.signal.aborted) compareData = results;
          })
          .catch(() => {
            if (!controller.signal.aborted) compareError = true;
          })
          .finally(() => {
            if (!controller.signal.aborted) compareLoading = false;
          });
      }
    });
    return () => controller.abort();
  });

  const headers = [
    { key: 'sn' as const, value: '资产编号 / SN' },
    { key: 'type' as const, value: '监测类型' },
    { key: 'status' as const, value: '设备状态' },
    { key: 'reading' as const, value: '最新测量值' },
    { key: 'alarm' as const, value: '报警状态' },
  ];
  const tableRows = $derived(
    filteredDevices.map((d) => ({
      id: d.id,
      sn: deviceSn(d),
      type: typeLabel(d.type),
      status: deviceStatusLabel(d),
      reading: metricValue(d),
      alarm: Math.max(0, ...d.alarms.map((a) => a.level)),
    })),
  );
  function typeLabel(t: string): string {
    if (t === 'gamma') return 'γ剂量率';
    return '空气测氡';
  }

  function metricValue(d: Device): string {
    const m = d.metrics[0];
    if (!m) return '-';
    return `${m.value.toFixed(1)} ${m.unit}`;
  }
</script>

<div class="overview-shell">
  <div class="overview">
    <div class="page-title">
      <div>
        <p class="eyebrow">实时监测 / 监测总览</p>
        <h1>监测总览</h1>
        <p class="page-description">设备运行状态、最新测量值与历史趋势。</p>
      </div>
      <Tag type="outline" icon={Location}>STATION-01 · 新疆站点</Tag>
    </div>
    <div class="summary-row">
      {#each [{ label: '设备总数', icon: Dashboard, value: totalDevices, status: '' }, { label: '在线', icon: CheckmarkFilled, value: onlineCount, status: 'online' }, { label: '离线', icon: WifiOff, value: offlineCount, status: 'offline' }, { label: '未上报', icon: Time, value: unreportedCount, status: 'unreported' }, { label: '故障', icon: ErrorFilled, value: faultCount, status: 'fault' }, { label: '报警设备', icon: WarningFilled, value: alarmCount, status: 'alarm' }] as stat}
        <Tile
          ><div class="summary-card {stat.status}">
            <div class="summary-value">{stat.value}</div>
            <div class="summary-label"><stat.icon size={16} />{stat.label}</div>
          </div></Tile
        >
      {/each}
    </div>

    <section class="list-section" aria-label="设备列表">
      <div class="section-heading">
        <div>
          <h2>
            <DataBase size={20} />设备列表
            <span class="count">{filteredDevices.length}</span>
          </h2>
          <p>选择资产编号，查看设备详情与历史数据。</p>
        </div>
        <Search
          size="lg"
          labelText="搜索设备"
          placeholder="搜索 SN、编号、名称…"
          closeButtonLabelText="清除搜索"
          class="search-input"
          bind:value={searchQuery}
        />
      </div>
      <div class="table-wrapper">
        <DataTable
          {headers}
          rows={tableRows}
          size="medium"
          sortable
          zebra
          tableHeaderTranslateWithId={(id) =>
            id === 'columnSortAscending' ? '升序排列' : '降序排列'}
        >
          <svelte:fragment slot="cell" let:row let:cell>
            {#if cell.key === 'sn'}
              <Button
                kind="ghost"
                size="small"
                icon={ArrowRight}
                on:click={() => selectDevice(String(row.id))}
                ><span class="mono">{cell.value}</span></Button
              >
            {:else if cell.key === 'status'}
              <Tag
                size="sm"
                icon={cell.value === '在线'
                  ? CheckmarkFilled
                  : cell.value === '故障'
                    ? ErrorFilled
                    : cell.value === '离线'
                      ? WifiOff
                      : Time}
                type={cell.value === '在线'
                  ? 'green'
                  : cell.value === '故障'
                    ? 'red'
                    : 'gray'}>{cell.value}</Tag
              >
            {:else if cell.key === 'alarm'}
              {#if cell.value}<Tag
                  size="sm"
                  icon={WarningFilled}
                  type={cell.value === 2 ? 'red' : 'magenta'}
                  >{cell.value === 2 ? '二级报警' : '一级报警'}</Tag
                >{:else}<span class="muted">无报警</span>{/if}
            {:else if cell.key === 'type'}<span class="icon-label"
                >{#if cell.value === 'γ剂量率'}<Activity
                    size={16}
                  />{:else}<Chemistry size={16} />{/if}{cell.value}</span
              >
            {:else}<span class:mono={cell.key === 'reading'}>{cell.value}</span
              >{/if}
          </svelte:fragment>
        </DataTable>
        {#if !filteredDevices.length}<div class="empty-state">
            未找到匹配设备，请调整搜索条件。
          </div>{/if}
      </div>
    </section>

    <section class="compare-section" aria-label="设备对比">
      <div class="section-heading">
        <div>
          <h2><ChartMultitype size={20} />设备趋势对比</h2>
          <p>选择相同监测类型的设备，对比历史测量趋势。</p>
        </div>
        <Tag type="blue">已选 {selectedForCompare.length} / 6</Tag>
      </div>
      <div class="comparison-layout">
        <div class="compare-controls">
          <Select
            id="compare-metric"
            labelText="监测指标"
            bind:selected={compareMetric}
            on:update={() => {
              selectedForCompare = [];
            }}
          >
            {#each metricOptions as opt}<SelectItem
                value={opt.value}
                text={opt.label}
              />{/each}
          </Select>
          <div
            class="device-selector"
            role="group"
            aria-label="选择对比设备，最多6台"
          >
            <p class="field-label">选择设备（最多 6 台）</p>
            {#each compatibleDevices as d}
              <Checkbox
                labelText={deviceSn(d)}
                title={d.name}
                checked={selectedForCompare.includes(d.id)}
                disabled={selectedForCompare.length >= 6 &&
                  !selectedForCompare.includes(d.id)}
                on:change={() => toggleCompareDevice(d.id)}
              />
            {/each}
          </div>
        </div>
        <div class="comparison-main">
          <TimeRangePicker query={compareQuery} onchange={onRangeChange} />
          <div class="chart-area">
            {#if compareLoading}<div class="empty-state">
                <InlineLoading description="正在加载对比数据…" />
              </div>
            {:else if compareError}<InlineNotification
                kind="error"
                title="历史数据暂不可用"
                subtitle="请调整时间范围或重新选择设备以重试。"
                hideCloseButton
              />
            {:else if compareData.length === 0}<div class="empty-state">
                <Analytics size={40} />
                <h3>选择设备，开始对比</h3>
                <p>最多同时显示 6 台设备的历史趋势。</p>
              </div>
            {:else}<ComparisonChart
                series={compareData}
                unit={currentMetricOption?.unit || ''}
              />{/if}
          </div>
        </div>
      </div>
    </section>
  </div>
  <DeviceDrawer />
</div>

<style>
  .overview-shell {
    flex: 1;
    display: flex;
    min-width: 0;
    overflow: hidden;
    position: relative;
  }
  .overview {
    flex: 1;
    overflow-y: auto;
    padding: 24px 32px 48px;
    min-width: 0;
  }
  .page-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    gap: 16px;
  }
  .eyebrow {
    font-size: 12px;
    color: var(--text-muted);
    margin: 0 0 8px;
  }
  h1 {
    font-size: 32px;
    font-weight: 300;
    margin: 0;
    line-height: 40px;
  }
  .page-description {
    color: var(--text-secondary);
    font-size: 14px;
    margin: 8px 0 0;
  }
  .summary-row {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 2px;
    margin-bottom: 24px;
  }
  .summary-row :global(.bx--tile) {
    padding: 20px 24px;
  }
  .summary-value {
    font: 36px/44px var(--font-mono);
    color: var(--text-primary);
  }
  .summary-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 16px;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .online .summary-label {
    color: var(--status-online);
  }
  .fault .summary-label,
  .alarm .summary-label {
    color: var(--alarm-l2);
  }
  .icon-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .list-section,
  .compare-section {
    background: var(--bg-secondary);
    margin-bottom: 24px;
  }
  .section-heading {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 24px;
    padding: 20px 24px;
  }
  .section-heading h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0;
    font-size: 20px;
    line-height: 28px;
    font-weight: 400;
  }
  .section-heading p {
    margin: 4px 0 0;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .count {
    color: var(--text-muted);
    margin-left: 8px;
    font: 14px var(--font-mono);
  }
  .section-heading :global(.bx--search) {
    max-width: 320px;
  }
  .table-wrapper {
    overflow: auto;
    max-height: 420px;
  }
  .table-wrapper :global(.bx--data-table th) {
    white-space: nowrap;
  }
  .table-wrapper :global(.bx--data-table td:first-child) {
    padding-left: 12px;
  }
  .muted {
    color: var(--text-muted);
    font-size: 12px;
  }
  .comparison-layout {
    display: grid;
    grid-template-columns: 256px minmax(0, 1fr);
    border-top: 1px solid var(--border);
  }
  .compare-controls {
    padding: 24px;
    border-right: 1px solid var(--border);
  }
  .field-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 24px 0 12px;
  }
  .device-selector {
    max-height: 280px;
    overflow-y: auto;
  }
  .comparison-main {
    padding: 24px;
    min-width: 0;
  }
  .chart-area {
    height: 320px;
    margin-top: 24px;
  }
  .empty-state {
    min-height: 160px;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 12px;
    color: var(--text-muted);
    font-size: 14px;
    padding: 24px;
    text-align: center;
  }
  .empty-state h3 {
    margin: 0;
    color: var(--text-primary);
    font-size: 16px;
    font-weight: 400;
  }
  .empty-state p {
    margin: 0;
    font-size: 12px;
  }
  @media (max-width: 1000px) {
    .overview {
      padding: 24px 16px;
    }
    .summary-row {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .summary-row :global(.bx--tile) {
      padding: 16px;
    }
  }
  @media (max-width: 650px) {
    .page-title {
      align-items: flex-start;
      flex-direction: column;
    }
    .section-heading {
      align-items: stretch;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
    }
    .section-heading :global(.bx--search) {
      max-width: none;
    }
    .comparison-layout {
      grid-template-columns: 1fr;
    }
    .compare-controls {
      border-right: 0;
      border-bottom: 1px solid var(--border);
      padding: 16px;
    }
    .device-selector {
      max-height: 150px;
    }
    .comparison-main {
      padding: 16px;
    }
    .summary-value {
      font-size: 28px;
    }
  }
</style>

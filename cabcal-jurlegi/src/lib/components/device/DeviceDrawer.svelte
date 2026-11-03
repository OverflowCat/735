<script lang="ts">
  import Activity from 'carbon-icons-svelte/lib/Activity.svelte';
  import ChartLine from 'carbon-icons-svelte/lib/ChartLine.svelte';
  import WarningFilled from 'carbon-icons-svelte/lib/WarningFilled.svelte';
  import CheckmarkFilled from 'carbon-icons-svelte/lib/CheckmarkFilled.svelte';
  import ErrorFilled from 'carbon-icons-svelte/lib/ErrorFilled.svelte';
  import WifiOff from 'carbon-icons-svelte/lib/WifiOff.svelte';
  import Time from 'carbon-icons-svelte/lib/Time.svelte';
  import Information from 'carbon-icons-svelte/lib/Information.svelte';
  import Chemistry from 'carbon-icons-svelte/lib/Chemistry.svelte';

  import {
    Button,
    Tag,
    Tile,
    InlineNotification,
  } from 'carbon-components-svelte';
  import Close from 'carbon-icons-svelte/lib/Close.svelte';
  import Launch from 'carbon-icons-svelte/lib/Launch.svelte';
  import { untrack } from 'svelte';
  import {
    appState,
    selectDevice,
    dataSource,
    openQueryBoard,
  } from '../../state/app-state.svelte';
  import { relativeQuery, type HistoryQuery } from '../../services/data-source';
  import { loadHistoryBatches } from '../../services/history-batches';
  import type { Device } from '../../types/device';
  import type { HistoricalPoint } from '../../types/device';
  import { deviceSn, deviceStatusLabel } from '../../types/device';
  import { displayUnit, formatMetric } from '../../utils/format';
  import TrendChart from '../charts/TrendChart.svelte';
  import ChartSkeleton from '../charts/ChartSkeleton.svelte';
  import TimeRangePicker from '../charts/TimeRangePicker.svelte';

  const device = $derived(
    appState.devices.find((d) => d.id === appState.selectedDeviceId) as
      Device | undefined,
  );
  let historyQuery = $state<HistoryQuery>(relativeQuery('1h'));
  let history = $state<HistoricalPoint[]>([]);
  let loading = $state(false);
  let historyError = $state(false);
  let completedBatches = $state(0);
  let totalBatches = $state(0);
  let retry = $state(0);
  const historyDeviceId = $derived(device?.id);
  const historyMetric = $derived(device?.metrics[0]?.metric);

  async function loadHistory(
    id: string,
    metric: string,
    query: HistoryQuery,
    controller: AbortController,
  ) {
    history = [];
    historyError = false;
    completedBatches = 0;
    totalBatches = 0;
    loading = true;
    try {
      await loadHistoryBatches(
        dataSource,
        id,
        metric,
        query,
        controller.signal,
        (batch) => {
          history = batch.points;
          completedBatches = batch.completed;
          totalBatches = batch.total;
        },
      );
    } catch {
      if (!controller.signal.aborted) historyError = true;
    } finally {
      if (!controller.signal.aborted) loading = false;
    }
  }

  function onRangeChange(q: HistoryQuery) {
    historyQuery = q;
  }

  $effect(() => {
    const id = historyDeviceId;
    const metric = historyMetric;
    const query = historyQuery;
    void retry;
    const controller = new AbortController();
    untrack(() => {
      if (id && metric) void loadHistory(id, metric, query, controller);
      else {
        history = [];
        loading = false;
        historyError = false;
        completedBatches = 0;
        totalBatches = 0;
      }
    });
    return () => controller.abort();
  });

  function close() {
    selectDevice(null);
  }

  function typeLabel(t: string): string {
    if (t === 'gamma') return 'γ剂量率监测仪';
    return '空气测氡仪';
  }

  function alarmLabel(level: number): string {
    return level === 2 ? '二级报警' : '一级报警';
  }
</script>

<svelte:window
  onkeydown={(e) => {
    if (e.key === 'Escape' && device) close();
  }}
/>

{#if device}
  <aside class="drawer" aria-label={`设备详情 ${deviceSn(device)}`}>
    <div class="drawer-header">
      <div>
        <p class="eyebrow">设备详情</p>
        <h2 class="title-sn">{deviceSn(device)}</h2>
        <p class="title-name">{device.name}</p>
      </div>
      <Button
        class="close-btn"
        kind="ghost"
        size="small"
        icon={Close}
        iconDescription="关闭设备详情"
        on:click={close}
      />
    </div>
    <div class="drawer-body">
      <section class="info-section" aria-label="设备信息">
        <div class="info-row">
          <span class="info-label"><Information size={16} />设备编号</span><span
            class="info-value mono">{device.id}</span
          >
        </div>
        <div class="info-row">
          <span class="info-label"
            >{#if device.type === 'gamma'}<Activity
                size={16}
              />{:else}<Chemistry size={16} />{/if}设备类型</span
          ><span class="info-value">{typeLabel(device.type)}</span>
        </div>
        <div class="info-row">
          <span class="info-label"><CheckmarkFilled size={16} />设备状态</span
          ><Tag
            icon={device.status === 'online'
              ? CheckmarkFilled
              : device.status === 'fault'
                ? ErrorFilled
                : device.unreported
                  ? Time
                  : WifiOff}
            type={device.status === 'online'
              ? 'green'
              : device.status === 'fault'
                ? 'red'
                : 'gray'}
            size="sm">{deviceStatusLabel(device)}</Tag
          >
        </div>
        <div class="info-row">
          <span class="info-label"><Time size={16} />最后更新</span><span
            class="info-value"
            >{device.lastUpdate
              ? new Date(device.lastUpdate).toLocaleString('zh-CN')
              : '暂无上报'}</span
          >
        </div>
      </section>
      <section class="section">
        <h3><Activity size={16} />实时监测数据</h3>
        {#if device.metrics.length === 0}<InlineNotification
            kind="info"
            title="暂无上报数据"
            subtitle="已登记安装位置，等待设备上报。"
            hideCloseButton
            lowContrast
          />{/if}
        {#each device.metrics as m}
          {@const d = formatMetric(m.value, m.unit)}
          <Tile class="metric-card">
            <div class="metric-header">
              <span>{m.name}</span>
              {#if m.alarm !== false}<Tag
                  type={m.alarm.level === 2 ? 'red' : 'magenta'}
                  size="sm">{alarmLabel(m.alarm.level)}</Tag
                >{/if}
            </div>
            <div
              class="metric-value"
              class:alarm-l2={m.alarm !== false && m.alarm.level === 2}
              class:alarm-l1={m.alarm !== false && m.alarm.level === 1}
            >
              {d.value} <span class="metric-unit">{d.unit}</span>
            </div>
            {#if m.alarm !== false}
              <div class="alarm-info">
                <p>原因：{m.alarm.reason}</p>
                <p>
                  阈值：{m.alarm.threshold.low} ~ {m.alarm.threshold.up}
                  {displayUnit(m.unit)}
                </p>
                {#if m.alarm.action}<p>
                    联动动作：{m.alarm.action === 'vent_start'
                      ? '启动通风'
                      : m.alarm.action}
                  </p>{/if}
              </div>
            {/if}
          </Tile>
        {/each}
      </section>
      {#if device.alarms.length > 0}
        <section class="section">
          <h3><WarningFilled size={16} />报警信息</h3>
          {#each device.alarms as alarm}<InlineNotification
              kind={alarm.level === 2 ? 'error' : 'warning'}
              title={alarmLabel(alarm.level)}
              subtitle={alarm.reason}
              hideCloseButton
            />{/each}
        </section>
      {/if}
      <section class="section">
        <div class="section-title-row">
          <h3><ChartLine size={16} />历史趋势</h3>
          <Button
            class="expand-btn"
            kind="ghost"
            size="small"
            icon={Launch}
            iconDescription="在新窗口打开数据查询"
            title="在数据查询中打开该设备的历史数据"
            aria-label="在数据查询中打开该设备的历史数据"
            on:click={() => {
              if (device && historyMetric)
                openQueryBoard({
                  deviceId: device.id,
                  metric: historyMetric,
                  query: historyQuery,
                  granule: 'raw',
                });
            }}
          />
        </div>
        <TimeRangePicker query={historyQuery} onchange={onRangeChange} />
        {#if loading && history.length === 0}
          <div class="chart-container"><ChartSkeleton /></div>
        {:else if history.length > 0}
          <div class="chart-container">
            <TrendChart
              {history}
              unit={device.metrics[0]?.unit || ''}
              alarmThresholds={device.metrics[0]?.alarm !== false
                ? (
                    device.metrics[0]?.alarm as {
                      threshold: { low: number; up: number };
                    }
                  )?.threshold
                : undefined}
            />
          </div>
        {/if}
        <div class="history-status" role="status" aria-live="polite">
          {#if loading}
            {completedBatches === 0
              ? '正在加载最近时段…'
              : `已载入 ${history.length} 条 · 第 ${completedBatches}/${totalBatches} 批，继续加载更早数据…`}
          {:else if historyError}
            {history.length
              ? `已保留 ${history.length} 条数据 · 后续加载失败`
              : '历史数据暂不可用'}
            <Button kind="ghost" size="small" on:click={() => retry++}
              >重试</Button
            >
          {:else if history.length > 0}已载入 {history.length} 条
          {:else}暂无历史数据{/if}
        </div>
      </section>
    </div>
  </aside>
{/if}

<style>
  .drawer {
    width: var(--sidebar-width);
    height: 100%;
    background: var(--bg-primary);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
    z-index: 20;
  }
  .drawer-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding: 24px 16px 24px 24px;
    border-bottom: 1px solid var(--border);
  }
  .eyebrow {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 8px;
  }
  .title-sn {
    font: 24px/32px var(--font-mono);
    margin: 0;
    overflow-wrap: anywhere;
  }
  .title-name {
    font-size: 14px;
    color: var(--text-secondary);
    margin: 8px 0 0;
  }
  .drawer-body {
    flex: 1;
    overflow-y: auto;
  }
  .info-section {
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
  }
  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    min-height: 36px;
    gap: 16px;
    font-size: 12px;
  }
  .info-label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text-muted);
    flex-shrink: 0;
  }
  .info-value {
    text-align: right;
    overflow-wrap: anywhere;
  }
  .section {
    padding: 24px;
    border-bottom: 1px solid var(--border);
  }
  .section-title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 16px;
  }
  .section-title-row h3 {
    margin: 0;
  }
  .section h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 0 0 16px;
    font-size: 16px;
    line-height: 24px;
    font-weight: 600;
  }
  .metric-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    font-size: 12px;
    color: var(--text-secondary);
  }
  .metric-value {
    font: 40px/56px var(--font-mono);
    margin-top: 12px;
  }
  .metric-unit {
    font: 14px var(--font-sans);
    color: var(--text-secondary);
  }
  .alarm-l1 {
    color: var(--alarm-l1);
  }
  .alarm-l2 {
    color: var(--alarm-l2);
  }
  .alarm-info {
    font-size: 12px;
    line-height: 20px;
    color: var(--text-secondary);
    border-top: 1px solid var(--border);
    margin-top: 16px;
    padding-top: 12px;
  }
  .alarm-info p {
    margin: 0;
  }
  .section :global(.bx--inline-notification) {
    width: 100%;
    max-width: none;
    margin: 0 0 8px;
  }
  .history-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    font-size: 12px;
    line-height: 20px;
    color: var(--text-muted);
    margin-top: 16px;
  }
  .chart-container {
    height: 240px;
    margin-top: 16px;
  }
  @media (max-width: 1000px) {
    .drawer {
      position: absolute;
      right: 0;
      top: 0;
      width: min(432px, 100%);
      box-shadow: var(--shadow-lg);
    }
  }
</style>

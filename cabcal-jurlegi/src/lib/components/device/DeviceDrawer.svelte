<script lang="ts">
  import { untrack } from 'svelte';
  import {
    appState,
    selectDevice,
    dataSource,
  } from '../../state/app-state.svelte';
  import { relativeQuery, type HistoryQuery } from '../../services/data-source';
  import { loadHistoryBatches } from '../../services/history-batches';
  import type { Device } from '../../types/device';
  import type { HistoricalPoint } from '../../types/device';
  import { deviceSn, deviceStatusLabel } from '../../types/device';
  import TrendChart from '../charts/TrendChart.svelte';
  import TimeRangePicker from '../charts/TimeRangePicker.svelte';

  const device = $derived(
    appState.devices.find((d) => d.id === appState.selectedDeviceId) as
      | Device
      | undefined,
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

{#if device}
  <aside class="drawer">
    <div class="drawer-header">
      <h3>
        <span class="title-sn">{deviceSn(device)}</span>
        <span class="title-name">{device.name}</span>
      </h3>
      <button class="close-btn" onclick={close}>✕</button>
    </div>

    <div class="drawer-body">
      <section class="info-section">
        <div class="info-row">
          <span class="info-label">设备编号</span>
          <span class="info-value mono">{device.code}</span>
        </div>
        <div class="info-row">
          <span class="info-label">设备类型</span>
          <span class="info-value">{typeLabel(device.type)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">设备状态</span>
          <span class="badge {device.status}">
            {deviceStatusLabel(device)}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">最后更新</span>
          <span class="info-value"
            >{device.lastUpdate
              ? new Date(device.lastUpdate).toLocaleString('zh-CN')
              : '暂无上报'}</span
          >
        </div>
      </section>

      <section class="section">
        <h4>实时监测数据</h4>
        {#if device.metrics.length === 0}
          <p class="empty-data">已登记安装位置，暂无上报数据。</p>
        {/if}
        {#each device.metrics as m}
          <div class="metric-card" class:alarm={m.alarm !== false}>
            <div class="metric-header">
              <span class="metric-name">{m.name}</span>
              {#if m.alarm !== false}
                <span class="badge alarm-l{m.alarm.level}"
                  >{alarmLabel(m.alarm.level)}</span
                >
              {/if}
            </div>
            <div
              class="metric-value"
              class:alarm-l2={m.alarm !== false && m.alarm.level === 2}
              class:alarm-l1={m.alarm !== false && m.alarm.level === 1}
            >
              {m.value.toFixed(1)}
              <span class="metric-unit">{m.unit}</span>
            </div>
            {#if m.alarm !== false}
              <div class="alarm-info">
                <p>原因: {m.alarm.reason}</p>
                <p>
                  阈值: {m.alarm.threshold.low} ~ {m.alarm.threshold.up}
                  {m.unit}
                </p>
                {#if m.alarm.action}
                  <p>
                    联动动作: {m.alarm.action === 'vent_start'
                      ? '启动通风'
                      : m.alarm.action}
                  </p>
                {/if}
              </div>
            {/if}
          </div>
        {/each}
      </section>

      {#if device.alarms.length > 0}
        <section class="section">
          <h4>报警信息</h4>
          {#each device.alarms as alarm}
            <div class="alarm-detail alarm-l{alarm.level}-bg">
              <span class="badge alarm-l{alarm.level}"
                >{alarmLabel(alarm.level)}</span
              >
              <p>{alarm.reason}</p>
            </div>
          {/each}
        </section>
      {/if}

      <section class="section">
        <h4>历史趋势</h4>
        <TimeRangePicker query={historyQuery} onchange={onRangeChange} />
        <div class="history-status" role="status" aria-live="polite">
          {#if loading}
            {completedBatches === 0
              ? '正在加载最近时段…'
              : `已载入 ${completedBatches}/${totalBatches} 批 · ${history.length} 条，继续加载更早数据…`}
          {:else if historyError}
            {history.length
              ? `已保留 ${history.length} 条数据 · 后续加载失败`
              : '历史数据暂不可用'}
            <button class="small" onclick={() => retry++}>重试</button>
          {:else if history.length > 0}
            已载入 {history.length} 条 · 完整时段
          {:else}
            暂无历史数据
          {/if}
        </div>
        {#if history.length > 0}
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
      </section>
    </div>
  </aside>
{/if}

<style>
  .drawer {
    width: var(--sidebar-width);
    height: 100%;
    background: var(--bg-secondary);
    border-left: 1px solid var(--border);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    flex-shrink: 0;
  }

  .drawer-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .drawer-header h3 {
    font-size: 18px;
    font-weight: 700;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .title-sn {
    font-family: var(--font-mono);
    font-size: 18px;
    font-weight: 700;
    color: var(--text-primary);
  }

  .title-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--text-secondary);
    font-size: 19px;
    padding: 4px 8px;
    line-height: 1;
  }

  .close-btn:hover {
    color: var(--text-primary);
    background: var(--bg-tertiary);
  }

  .drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 0;
  }

  .info-section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .info-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 0;
  }

  .info-label {
    font-size: 14px;
    color: var(--text-secondary);
  }

  .info-value {
    font-size: 15px;
    font-weight: 500;
  }

  .info-value.mono {
    font-family: var(--font-mono);
    font-size: 14px;
  }

  .section {
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .section h4 {
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 10px;
    color: var(--text-secondary);
  }

  .metric-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 10px 12px;
    margin-bottom: 8px;
  }

  .metric-card.alarm {
    border-color: var(--alarm-l2);
  }

  .metric-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 6px;
  }

  .metric-name {
    font-size: 13px;
    color: var(--text-secondary);
  }

  .metric-value {
    font-size: 30px;
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1.2;
  }

  .metric-value.alarm-l2 {
    color: var(--alarm-l2);
  }

  .metric-value.alarm-l1 {
    color: var(--alarm-l1);
  }

  .metric-unit {
    font-size: 15px;
    font-weight: 400;
    color: var(--text-secondary);
    margin-left: 4px;
  }

  .alarm-info {
    margin-top: 8px;
    padding: 8px;
    background: var(--alarm-l2-bg);
    border-radius: var(--radius);
    font-size: 13px;
    color: var(--text-secondary);
  }

  .alarm-info p {
    margin: 2px 0;
  }

  .alarm-detail {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-radius: var(--radius);
    margin-bottom: 6px;
  }

  .alarm-detail p {
    font-size: 13px;
    color: var(--text-secondary);
    margin: 0;
  }

  .alarm-l1-bg {
    background: var(--alarm-l1-bg);
  }

  .alarm-l2-bg {
    background: var(--alarm-l2-bg);
  }

  .history-status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 6px 0;
    color: var(--text-muted);
    font-size: 12px;
  }

  .chart-container {
    height: 220px;
  }
</style>

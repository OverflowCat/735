<script lang="ts">
  import { appState, selectDevice, getHistory } from '../../state/app-state.svelte';
  import {
    relativeQuery,
    type HistoryQuery,
  } from '../../services/data-source';
  import type { Device } from '../../types/device';
  import type { HistoricalPoint } from '../../types/device';
  import TrendChart from '../charts/TrendChart.svelte';
  import TimeRangePicker from '../charts/TimeRangePicker.svelte';

  const device = $derived(appState.devices.find((d) => d.id === appState.selectedDeviceId) as Device | undefined);
  let historyQuery = $state<HistoryQuery>(relativeQuery('1h'));
  let history = $state<HistoricalPoint[]>([]);
  let loading = $state(false);

  async function loadHistory() {
    if (!device || !device.metrics[0]) return;
    loading = true;
    history = await getHistory(device.id, device.metrics[0].metric, historyQuery);
    loading = false;
  }

  function onRangeChange(q: HistoryQuery) {
    historyQuery = q;
    void loadHistory();
  }

  $effect(() => {
    if (device) {
      loadHistory();
    }
  });

  function close() {
    selectDevice(null);
  }

  function statusLabel(s: string): string {
    if (s === 'online') return '在线';
    if (s === 'offline') return '离线';
    return '故障';
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
      <h3>{device.name}</h3>
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
            {statusLabel(device.status)}
          </span>
        </div>
        <div class="info-row">
          <span class="info-label">最后更新</span>
          <span class="info-value">{new Date(device.lastUpdate).toLocaleString('zh-CN')}</span>
        </div>
      </section>

      <section class="section">
        <h4>实时监测数据</h4>
        {#each device.metrics as m}
          <div class="metric-card" class:alarm={m.alarm !== false}>
            <div class="metric-header">
              <span class="metric-name">{m.name}</span>
              {#if m.alarm !== false}
                <span class="badge alarm-l{m.alarm.level}">{alarmLabel(m.alarm.level)}</span>
              {/if}
            </div>
            <div class="metric-value" class:alarm-l2={m.alarm !== false && m.alarm.level === 2} class:alarm-l1={m.alarm !== false && m.alarm.level === 1}>
              {m.value.toFixed(1)}
              <span class="metric-unit">{m.unit}</span>
            </div>
            {#if m.alarm !== false}
              <div class="alarm-info">
                <p>原因: {m.alarm.reason}</p>
                <p>阈值: {m.alarm.threshold.low} ~ {m.alarm.threshold.up} {m.unit}</p>
                {#if m.alarm.action}
                  <p>联动动作: {m.alarm.action === 'vent_start' ? '启动通风' : m.alarm.action}</p>
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
              <span class="badge alarm-l{alarm.level}">{alarmLabel(alarm.level)}</span>
              <p>{alarm.reason}</p>
            </div>
          {/each}
        </section>
      {/if}

      <section class="section">
        <h4>历史趋势</h4>
        <TimeRangePicker query={historyQuery} onchange={onRangeChange} />
        {#if loading}
          <div class="loading">加载中...</div>
        {:else}
          <div class="chart-container">
            <TrendChart
              {history}
              unit={device.metrics[0]?.unit || ''}
              alarmThresholds={device.metrics[0]?.alarm !== false
                ? (device.metrics[0]?.alarm as { threshold: { low: number; up: number } })?.threshold
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
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .drawer-header h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
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
    font-size: 13px;
    color: var(--text-secondary);
  }

  .info-value {
    font-size: 14px;
  }

  .info-value.mono {
    font-family: var(--font-mono);
    font-size: 13px;
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

  .loading {
    text-align: center;
    padding: 20px;
    color: var(--text-muted);
    font-size: 14px;
  }

  .chart-container {
    height: 220px;
  }
</style>

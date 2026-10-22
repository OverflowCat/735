<script lang="ts">
  import { appState, getHistory } from '../../state/app-state.svelte';
  import {
    relativeQuery,
    type HistoryQuery,
  } from '../../services/data-source';
  import type { HistoricalPoint, Device } from '../../types/device';
  import { deviceSn } from '../../types/device';
  import ComparisonChart from '../charts/ComparisonChart.svelte';
  import TimeRangePicker from '../charts/TimeRangePicker.svelte';

  const totalDevices = $derived(appState.devices.length);
  const onlineCount = $derived(appState.devices.filter((d) => d.status === 'online').length);
  const offlineCount = $derived(appState.devices.filter((d) => d.status === 'offline').length);
  const faultCount = $derived(appState.devices.filter((d) => d.status === 'fault').length);
  const alarmCount = $derived(appState.devices.filter((d) => d.alarms.length > 0).length);

  let searchQuery = $state('');
  const filteredDevices = $derived(
    appState.devices.filter((d) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        deviceSn(d).toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.name.toLowerCase().includes(q) ||
        d.type.includes(q)
      );
    }),
  );

  let compareMetric = $state<string>('0102060301');
  let compareQuery = $state<HistoryQuery>(relativeQuery('1h'));
  let selectedForCompare = $state<string[]>([]);
  let compareData = $state<{ deviceId: string; name: string; points: HistoricalPoint[] }[]>([]);
  let compareLoading = $state(false);

  const metricOptions = [
    { value: '0102060301', label: 'γ剂量率实时值', unit: 'nGy/h', types: ['gamma'] },
    { value: '0102060302', label: '氡及子体浓度实时值', unit: 'Bq/m³', types: ['radon'] },
  ];

  const currentMetricOption = $derived(metricOptions.find((m) => m.value === compareMetric)!);
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

  async function loadComparison() {
    if (selectedForCompare.length === 0) {
      compareData = [];
      return;
    }
    compareLoading = true;
    const results = await Promise.all(
      selectedForCompare.map(async (id) => {
        const device = appState.devices.find((d) => d.id === id);
        const points = await getHistory(id, compareMetric, compareQuery);
        return { deviceId: id, name: deviceSn(device ?? { id, code: id }), points };
      }),
    );
    compareData = results;
    compareLoading = false;
  }

  function onRangeChange(q: HistoryQuery) {
    compareQuery = q;
  }

  $effect(() => {
    void compareMetric;
    void compareQuery;
    void selectedForCompare.length;
    loadComparison();
  });

  function statusLabel(s: string): string {
    if (s === 'online') return '在线';
    if (s === 'offline') return '离线';
    return '故障';
  }

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

<div class="overview">
  <div class="summary-row">
    <div class="summary-card">
      <div class="summary-value">{totalDevices}</div>
      <div class="summary-label">设备总数</div>
    </div>
    <div class="summary-card online">
      <div class="summary-value">{onlineCount}</div>
      <div class="summary-label">在线</div>
    </div>
    <div class="summary-card offline">
      <div class="summary-value">{offlineCount}</div>
      <div class="summary-label">离线</div>
    </div>
    <div class="summary-card fault">
      <div class="summary-value">{faultCount}</div>
      <div class="summary-label">故障</div>
    </div>
    <div class="summary-card alarm">
      <div class="summary-value">{alarmCount}</div>
      <div class="summary-label">报警设备</div>
    </div>
  </div>

  <div class="split-row">
    <div class="section list-section">
      <div class="section-header">
        <h3>设备列表</h3>
        <input
          type="text"
          placeholder="搜索 SN、编号..."
          bind:value={searchQuery}
          class="search-input"
        />
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>SN</th>
              <th>类型</th>
              <th>状态</th>
              <th>最新数据</th>
              <th>报警</th>
            </tr>
          </thead>
          <tbody>
            {#each filteredDevices as d}
              <tr>
                <td class="mono sn">{deviceSn(d)}</td>
                <td>{typeLabel(d.type)}</td>
                <td>
                  <span class="badge {d.status}">{statusLabel(d.status)}</span>
                </td>
                <td>{metricValue(d)}</td>
                <td>
                  {#if d.alarms.length > 0}
                    {#each d.alarms as alarm}
                      <span class="badge alarm-l{alarm.level}">
                        {alarm.level === 2 ? '二级' : '一级'}
                      </span>
                    {/each}
                  {:else}
                    <span class="no-alarm">无</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>

    <div class="section compare-section">
      <div class="section-header">
        <h3>设备对比</h3>
        <span class="compare-count">{selectedForCompare.length}/6</span>
      </div>
      <div class="compare-controls">
        <div class="control-row">
          <div class="control-group">
            <label for="compare-metric">指标</label>
            <select id="compare-metric" bind:value={compareMetric}>
              {#each metricOptions as opt}
                <option value={opt.value}>{opt.label}</option>
              {/each}
            </select>
          </div>
          <!-- svelte-ignore a11y_label_has_associated_control -->
          <div class="control-group">
            <label>时间范围</label>
            <TimeRangePicker query={compareQuery} onchange={onRangeChange} />
          </div>
        </div>
        <!-- svelte-ignore a11y_label_has_associated_control -->
        <div class="control-group">
          <label>选择设备（最多6台）</label>
          <div class="device-selector">
            {#each compatibleDevices as d}
              <button
                class:active={selectedForCompare.includes(d.id)}
                class="small sn-btn"
                title={d.name}
                onclick={() => toggleCompareDevice(d.id)}
              >
                {deviceSn(d)}
              </button>
            {/each}
          </div>
        </div>
      </div>
      <div class="chart-area">
        {#if compareLoading}
          <div class="loading">加载中...</div>
        {:else if compareData.length === 0}
          <div class="loading">请选择设备进行对比</div>
        {:else}
          <ComparisonChart
            series={compareData}
            unit={currentMetricOption?.unit || ''}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  .overview {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }

  .summary-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .summary-card {
    flex: 1;
    min-width: 110px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 10px 12px;
    text-align: center;
  }

  .summary-card.online { border-left: 4px solid var(--status-online); }
  .summary-card.offline { border-left: 4px solid var(--status-offline); }
  .summary-card.fault { border-left: 4px solid var(--status-fault); }
  .summary-card.alarm { border-left: 4px solid var(--alarm-l2); }

  .summary-value {
    font-size: 32px;
    font-weight: 700;
    font-family: var(--font-mono);
    line-height: 1.15;
    color: var(--text-primary);
  }

  .summary-label {
    font-size: 14px;
    color: var(--text-secondary);
    margin-top: 2px;
    font-weight: 500;
  }

  .split-row {
    display: flex;
    gap: 12px;
    align-items: stretch;
    min-width: 0;
    flex: 1;
  }

  .section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .list-section {
    flex: 1.05;
    max-height: calc(100vh - 220px);
  }

  .compare-section {
    flex: 1;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border-bottom: 1px solid var(--border);
    gap: 8px;
    flex-shrink: 0;
  }

  .section-header h3 {
    font-size: 17px;
    font-weight: 700;
    margin: 0;
    color: var(--text-primary);
  }

  .compare-count {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    color: var(--accent);
    background: var(--accent-bg);
    padding: 2px 10px;
    border-radius: 999px;
  }

  .search-input {
    width: 200px;
    font-size: 15px;
    padding: 5px 10px;
  }

  .table-wrapper {
    flex: 1;
    overflow-y: auto;
    min-height: 200px;
  }

  .sn {
    font-family: var(--font-mono);
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .no-alarm {
    color: var(--text-secondary);
    font-size: 14px;
  }

  .compare-controls {
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    border-bottom: 1px solid var(--border);
    flex-shrink: 0;
  }

  .control-row {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  .control-group label {
    font-size: 14px;
    color: var(--text-secondary);
    font-weight: 500;
  }

  .device-selector {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .sn-btn {
    font-family: var(--font-mono);
    font-size: 14px;
    font-weight: 600;
    padding: 5px 10px;
    letter-spacing: 0.01em;
  }

  .chart-area {
    flex: 1;
    min-height: 320px;
    padding: 8px;
  }

  .loading {
    text-align: center;
    padding: 32px;
    color: var(--text-secondary);
    font-size: 16px;
    font-weight: 500;
  }

  @media (max-width: 1100px) {
    .split-row {
      flex-direction: column;
    }
    .list-section {
      max-height: 340px;
    }
    .chart-area {
      min-height: 280px;
    }
  }
</style>

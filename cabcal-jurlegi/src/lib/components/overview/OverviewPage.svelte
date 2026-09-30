<script lang="ts">
  import { appState, getHistory } from '../../state/app-state.svelte';
  import { TIME_RANGE_LABELS, type TimeRange } from '../../services/data-source';
  import type { HistoricalPoint, Device } from '../../types/device';
  import ComparisonChart from '../charts/ComparisonChart.svelte';

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
        d.name.toLowerCase().includes(q) ||
        d.code.toLowerCase().includes(q) ||
        d.type.includes(q)
      );
    }),
  );

  let compareMetric = $state<string>('0102060301');
  let compareRange = $state<TimeRange>('1h');
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
        const points = await getHistory(id, compareMetric, compareRange);
        return { deviceId: id, name: device?.name || id, points };
      }),
    );
    compareData = results;
    compareLoading = false;
  }

  $effect(() => {
    void compareMetric;
    void compareRange;
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

  <div class="section">
    <div class="section-header">
      <h3>设备列表</h3>
      <input
        type="text"
        placeholder="搜索设备名称、编号..."
        bind:value={searchQuery}
        class="search-input"
      />
    </div>
    <div class="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>设备名称</th>
            <th>编号</th>
            <th>类型</th>
            <th>状态</th>
            <th>最新数据</th>
            <th>报警</th>
          </tr>
        </thead>
        <tbody>
          {#each filteredDevices as d}
            <tr>
              <td>{d.name}</td>
              <td class="mono">{d.code}</td>
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

  <div class="section">
    <div class="section-header">
      <h3>设备对比</h3>
    </div>
    <div class="compare-controls">
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
        <div class="range-buttons">
          {#each Object.entries(TIME_RANGE_LABELS) as [key, label]}
            <button
              class:active={compareRange === key}
              class="small"
              onclick={() => (compareRange = key as TimeRange)}
            >
              {label}
            </button>
          {/each}
        </div>
      </div>
      <!-- svelte-ignore a11y_label_has_associated_control -->
      <div class="control-group">
        <label>选择设备（最多6台）</label>
        <div class="device-selector">
          {#each compatibleDevices as d}
            <button
              class:active={selectedForCompare.includes(d.id)}
              class="small"
              onclick={() => toggleCompareDevice(d.id)}
            >
              {d.name}
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

<style>
  .overview {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .summary-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
  }

  .summary-card {
    flex: 1;
    min-width: 120px;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 16px;
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
    line-height: 1.2;
  }

  .summary-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin-top: 4px;
  }

  .section {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
  }

  .section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid var(--border);
  }

  .section-header h3 {
    font-size: 14px;
    font-weight: 600;
    margin: 0;
  }

  .search-input {
    width: 240px;
  }

  .table-wrapper {
    max-height: 300px;
    overflow-y: auto;
  }

  .mono {
    font-family: var(--font-mono);
    font-size: 12px;
  }

  .no-alarm {
    color: var(--text-muted);
    font-size: 12px;
  }

  .compare-controls {
    padding: 12px 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 16px;
    border-bottom: 1px solid var(--border);
  }

  .control-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .control-group label {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .range-buttons, .device-selector {
    display: flex;
    gap: 4px;
    flex-wrap: wrap;
  }

  .chart-area {
    height: 350px;
    padding: 12px;
  }

  .loading {
    text-align: center;
    padding: 40px;
    color: var(--text-muted);
    font-size: 13px;
  }
</style>

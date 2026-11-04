<script lang="ts">
  import Download from 'carbon-icons-svelte/lib/Download.svelte';
  import DocumentExport from 'carbon-icons-svelte/lib/DocumentExport.svelte';
  import Activity from 'carbon-icons-svelte/lib/Activity.svelte';
  import Chemistry from 'carbon-icons-svelte/lib/Chemistry.svelte';
  import Analytics from 'carbon-icons-svelte/lib/Analytics.svelte';
  import ChartMultitype from 'carbon-icons-svelte/lib/ChartMultitype.svelte';
  import DataBase from 'carbon-icons-svelte/lib/DataBase.svelte';

  import { untrack } from 'svelte';
  import {
    ContentSwitcher,
    Switch,
    Tile,
    Tag,
    Select,
    SelectItem,
    Checkbox,
    RadioButton,
    Button,
    Search,
    InlineNotification,
    SkeletonText,
  } from 'carbon-components-svelte';
  import {
    appState,
    dataSource,
  } from '../../state/app-state.svelte';
  import { relativeQuery, type HistoryQuery } from '../../services/data-source';
  import {
    AGGREGATE_LABELS,
    type AggregateGranule,
  } from '../../services/data-source';
  import type { HistoricalPoint, Device } from '../../types/device';
  import { deviceSn } from '../../types/device';
  import { displayUnit } from '../../utils/format';
  import { aggregatePoints } from '../../services/aggregate';
  import TrendChart from '../charts/TrendChart.svelte';
  import ComparisonChart from '../charts/ComparisonChart.svelte';
  import ChartSkeleton from '../charts/ChartSkeleton.svelte';
  import TimeRangePicker from '../charts/TimeRangePicker.svelte';

  const metricOptions = [
    {
      value: '0102060301',
      label: 'γ剂量率实时值',
      unit: 'nSv/h',
      types: ['gamma'],
    },
    {
      value: '0102060302',
      label: '氡及子体浓度实时值',
      unit: 'Bq/m3',
      types: ['radon'],
    },
  ];

  type Mode = 'single' | 'compare';
  let mode = $state<Mode>('single');

  // Seeded once from the drawer "open in new window" intent.
  let seeded = $state(false);
  const currentMetricOption = $derived(
    metricOptions.find((m) => m.value === metric) ?? metricOptions[0],
  );
  const compatibleDevices = $derived(
    appState.devices.filter((d) => currentMetricOption.types.includes(d.type)),
  );

  let metric = $state(metricOptions[0].value);
  let granule = $state<AggregateGranule>('raw');
  let query = $state<HistoryQuery>(relativeQuery('1h'));

  // single-device mode
  let singleDeviceId = $state<string | null>(null);
  // compare mode
  let selectedForCompare = $state<string[]>([]);

  let searchQuery = $state('');

  let series = $state<
    { deviceId: string; name: string; points: HistoricalPoint[] }[]
  >([]);
  let loading = $state(false);
  let loadError = $state(false);

  function resolveIntent() {
    const intent = appState.queryIntent;
    if (!intent) return;
    metric = intent.metric;
    query = intent.query;
    granule = intent.granule;
    singleDeviceId = intent.deviceId;
    selectedForCompare = [intent.deviceId];
    mode = 'single';
    appState.queryIntent = null;
  }

  $effect(() => {
    if (!seeded) {
      resolveIntent();
      seeded = true;
    }
    // Keep a valid selection when the device list changes.
    if (
      singleDeviceId &&
      !compatibleDevices.some((d) => d.id === singleDeviceId)
    ) {
      singleDeviceId = compatibleDevices[0]?.id ?? null;
    }
  });

  const filteredCompareDevices = $derived(
    compatibleDevices
      .filter((d) => {
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return (
          deviceSn(d).toLowerCase().includes(q) ||
          d.name.toLowerCase().includes(q) ||
          d.id.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => (a.type === b.type ? 0 : a.type === 'gamma' ? -1 : 1)),
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

  const activeIds = $derived(
    mode === 'single'
      ? singleDeviceId
        ? [singleDeviceId]
        : []
      : selectedForCompare,
  );

  function deviceLabel(id: string): string {
    const d = appState.devices.find((x) => x.id === id);
    return d ? `${deviceSn(d)} · ${d.name}` : id;
  }

  $effect(() => {
    const ids = [...activeIds];
    const m = metric;
    const q = query;
    const g = granule;
    const controller = new AbortController();
    untrack(() => {
      series = [];
      loadError = false;
      loading = ids.length > 0;
      if (ids.length) {
        const durMs: Record<string, number> = {
          '15m': 15 * 60 * 1000,
          '1h': 60 * 60 * 1000,
          '24h': 24 * 60 * 60 * 1000,
          '7d': 7 * 24 * 60 * 60 * 1000,
        };
        // Align aggregation buckets to the query window start.
        const startMs =
          q.kind === 'absolute'
            ? q.startMs
            : Date.now() - (durMs[q.range] ?? 3600 * 1000);
        void Promise.all(
          ids.map(async (id) => ({
            deviceId: id,
            name: deviceLabel(id),
            points: aggregatePoints(
              await dataSource.getHistory(id, m, q, {
                signal: controller.signal,
              }),
              g,
              startMs,
            ),
          })),
        )
          .then((results) => {
            if (!controller.signal.aborted) series = results;
          })
          .catch(() => {
            if (!controller.signal.aborted) loadError = true;
          })
          .finally(() => {
            if (!controller.signal.aborted) loading = false;
          });
      }
    });
    return () => controller.abort();
  });

  function exportCsv() {
    const rows: string[][] = [
      ['设备', '时间', `${currentMetricOption.label} (${displayUnit(currentMetricOption.unit)})`],
    ];
    for (const s of series) {
      for (const p of s.points) {
        rows.push([
          s.name,
          new Date(p.timestamp).toLocaleString('zh-CN'),
          String(p.value),
        ]);
      }
    }
    downloadText(toCsv(rows), 'data-query.csv', 'text/csv;charset=utf-8');
  }

  function exportJson() {
    const payload = series.map((s) => ({
      deviceId: s.deviceId,
      name: s.name,
      metric: currentMetricOption.value,
      unit: currentMetricOption.unit,
      aggregate: granule,
      from: query.kind === 'absolute' ? query.startMs : undefined,
      to: query.kind === 'absolute' ? query.endMs : undefined,
      points: s.points,
    }));
    downloadText(
      JSON.stringify(payload, null, 2),
      'data-query.json',
      'application/json;charset=utf-8',
    );
  }

  function toCsv(rows: string[][]): string {
    return rows
      .map((row) =>
        row
          .map((cell) => {
            const s = String(cell);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(','),
      )
      .join('\n');
  }

  function downloadText(text: string, filename: string, type: string) {
    const blob = new Blob(['\uFEFF' + text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function typeLabel(t: string): string {
    return t === 'gamma' ? 'γ剂量率' : '空气测氡';
  }
</script>

<div class="query-shell">
  <div class="query">
    <div class="page-title">
      <div>
        <p class="eyebrow">历史数据 / 数据查询</p>
        <h1>数据查询</h1>
        <p class="page-description">
          按监测类型、聚合粒度与时间范围查询历史测量数据，并支持导出。
        </p>
      </div>
    </div>

    <section class="board" aria-label="数据查询">
      <div class="board-toolbar">
        <div class="mode-switch">
          <ContentSwitcher
            size="sm"
            selectedIndex={mode === 'single' ? 0 : 1}
            on:change={(e) => {
              mode = e.detail === 0 ? 'single' : 'compare';
            }}
          >
            <Switch text="单设备查询"
              ><span class="mode-label"><Activity size={16} />单设备查询</span
              ></Switch
            ><Switch text="设备趋势对比"
              ><span class="mode-label"
                ><ChartMultitype size={16} />设备趋势对比</span
              ></Switch
            >
          </ContentSwitcher>
        </div>
        <div class="toolbar-controls">
          <Select
            id="query-metric"
            labelText="监测指标"
            bind:selected={metric}
            on:update={() => {
              singleDeviceId = null;
              selectedForCompare = [];
            }}
          >
            {#each metricOptions as opt}<SelectItem
                value={opt.value}
                text={opt.label}
              />{/each}
          </Select>
          <Select
            id="query-granule"
            labelText="聚合粒度"
            bind:selected={granule}
          >
            {#each Object.entries(AGGREGATE_LABELS) as [key, label]}<SelectItem
                value={key}
                text={label}
              />{/each}
          </Select>
        </div>
      </div>

      <div class="board-layout">
        <div class="query-controls">
          {#if mode === 'single'}
            <p class="field-label">选择设备</p>
            {#if !appState.devicesReady}<SkeletonText
                paragraph
                lines={6}
              />{:else}
              <div class="device-list" role="radiogroup" aria-label="选择一台设备">
                {#each compatibleDevices as d}
                  <RadioButton
                    labelText={deviceSn(d)}
                    value={d.id}
                    title={d.name}
                    name="query-device"
                    checked={singleDeviceId === d.id}
                    on:change={() => (singleDeviceId = d.id)}
                  />
                {/each}
              </div>
            {/if}
          {:else}
            <p class="field-label">选择对比设备（最多 6 台）</p>
            <Search
              size="sm"
              labelText="搜索设备"
              placeholder="搜索 SN、编号、名称…"
              closeButtonLabelText="清除搜索"
              bind:value={searchQuery}
            />
            {#if !appState.devicesReady}<SkeletonText
                paragraph
                lines={6}
              />{:else}
              <div class="device-list">
                {#each filteredCompareDevices as d}
                  <Checkbox
                    labelText={`${typeLabel(d.type)} · ${deviceSn(d)}`}
                    title={d.name}
                    checked={selectedForCompare.includes(d.id)}
                    disabled={selectedForCompare.length >= 6 &&
                      !selectedForCompare.includes(d.id)}
                    on:change={() => toggleCompareDevice(d.id)}
                  />
                {/each}
              </div>
            {/if}
          {/if}
        </div>

        <div class="query-main">
          <div class="range-and-export">
            <div class="range-wrap">
              <TimeRangePicker {query} onchange={(q) => (query = q)} />
            </div>
            <div class="export-actions" aria-label="导出数据">
              <Button
                kind="tertiary"
                size="small"
                icon={Download}
                iconDescription="导出 CSV"
                disabled={series.length === 0 || loading}
                on:click={exportCsv}
                >CSV</Button
              >
              <Button
                kind="ghost"
                size="small"
                icon={DocumentExport}
                iconDescription="导出 JSON"
                disabled={series.length === 0 || loading}
                on:click={exportJson}
                >JSON</Button
              >
            </div>
          </div>
          <div class="chart-area">
            {#if loading}<ChartSkeleton label="正在加载查询数据" />
            {:else if loadError}<InlineNotification
                kind="error"
                title="历史数据暂不可用"
                subtitle="请调整时间范围或重新选择设备以重试。"
                hideCloseButton
              />
            {:else if series.length === 0}<div class="empty-state">
                <Analytics size={40} />
                <h3>{mode === 'single' ? '选择设备，开始查询' : '选择设备，开始对比'}</h3>
                <p>选择监测指标与设备后显示趋势，可调整聚合粒度与时间范围。</p>
              </div>
            {:else if mode === 'single' && series.length === 1}<TrendChart
                history={series[0].points}
                unit={currentMetricOption.unit}
              />
            {:else}<ComparisonChart
                series={series}
                unit={currentMetricOption.unit}
              />{/if}
          </div>
        </div>
      </div>
    </section>
  </div>
</div>

<style>
  .query-shell {
    flex: 1;
    display: flex;
    min-width: 0;
    overflow: hidden;
    position: relative;
  }
  .query {
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
  .board {
    background: var(--bg-secondary);
  }
  .board-toolbar {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 24px;
    flex-wrap: wrap;
    padding: 20px 24px;
    border-bottom: 1px solid var(--border);
  }
  .mode-switch :global(.bx--content-switcher-btn) {
    min-width: 0;
    padding: 0 14px;
  }
  .mode-switch :global(.bx--content-switcher--selected) {
    background: var(--accent);
    color: #ffffff;
  }
  .mode-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    white-space: nowrap;
  }
  .toolbar-controls {
    display: flex;
    gap: 24px;
  }
  .toolbar-controls :global(.bx--select-input__wrapper) {
    min-width: 220px;
  }
  .board-layout {
    display: grid;
    grid-template-columns: 256px minmax(0, 1fr);
  }
  .query-controls {
    padding: 24px;
    border-right: 1px solid var(--border);
  }
  .field-label {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 12px;
  }
  .query-controls :global(.bx--search) {
    margin-bottom: 12px;
  }
  .device-list {
    max-height: 360px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .query-main {
    padding: 24px;
    min-width: 0;
  }
  .range-and-export {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .range-wrap {
    min-width: 0;
  }
  .export-actions {
    display: flex;
    gap: 4px;
  }
  .chart-area {
    height: 360px;
    margin-top: 24px;
  }
  .empty-state {
    min-height: 200px;
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
    .query {
      padding: 24px 16px;
    }
  }
  @media (max-width: 700px) {
    .page-title {
      align-items: flex-start;
      flex-direction: column;
    }
    .board-layout {
      grid-template-columns: 1fr;
    }
    .query-controls {
      border-right: 0;
      border-bottom: 1px solid var(--border);
      padding: 16px;
    }
    .toolbar-controls {
      width: 100%;
      flex-direction: column;
      gap: 12px;
    }
    .toolbar-controls :global(.bx--select-input__wrapper) {
      min-width: 0;
    }
    .query-main {
      padding: 16px;
    }
  }
</style>

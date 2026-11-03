<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import type { HistoricalPoint } from '../../types/device';
  import { cssVar, themeState } from '../../state/theme.svelte';
  import { displayUnit, formatAxisValue, formatMetricText } from '../../utils/format';

  interface SeriesData {
    deviceId: string;
    name: string;
    points: HistoricalPoint[];
  }

  interface Props {
    series: SeriesData[];
    unit: string;
  }

  const { series, unit }: Props = $props();

  let chartEl = $state<HTMLDivElement | null>(null);
  let chart: echarts.ECharts | null = null;

  const LIGHT_COLORS = [
    '#0f62fe',
    '#007d79',
    '#8e6a00',
    '#da1e28',
    '#8a3ffc',
    '#d02670',
  ];
  const DARK_COLORS = [
    '#78a9ff',
    '#3ddbd9',
    '#f1c21b',
    '#ff8389',
    '#be95ff',
    '#ff7eb6',
  ];

  function buildOption() {
    const colors = themeState.dark ? DARK_COLORS : LIGHT_COLORS;
    const label = cssVar('--chart-label', '#525252');
    const axis = cssVar('--chart-axis', '#525252');
    // Show dates when the window spans more than ~2 days.
    const spanMs = (() => {
      let min = Infinity;
      let max = -Infinity;
      for (const s of series) {
        for (const p of s.points) {
          if (p.timestamp < min) min = p.timestamp;
          if (p.timestamp > max) max = p.timestamp;
        }
      }
      return Number.isFinite(min) && Number.isFinite(max) ? max - min : 0;
    })();
    const showDate = spanMs > 2 * 24 * 60 * 60 * 1000;
    const pad = (n: number) => String(n).padStart(2, '0');
    return {
      grid: { top: 42, right: 16, bottom: 28, left: 56 },
      legend: {
        data: series.map((s) => s.name),
        textStyle: { color: label, fontSize: 14, fontWeight: 600 },
        top: 4,
        itemWidth: 18,
        itemHeight: 10,
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          color: label,
          fontSize: 13,
          formatter: (v: number) => {
            const d = new Date(v);
            const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            return showDate
              ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
              : hm;
          },
        },
        axisLine: { lineStyle: { color: axis } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: displayUnit(unit),
        nameTextStyle: { color: label, fontSize: 13 },
        axisLabel: {
          color: label,
          fontSize: 13,
          formatter: formatAxisValue,
        },
        axisLine: { lineStyle: { color: axis } },
        splitLine: { lineStyle: { color: cssVar('--chart-grid', '#dde1e6') } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: cssVar('--chart-tooltip-bg', '#ffffff'),
        borderColor: cssVar('--chart-tooltip-border', '#c6c6c6'),
        textStyle: { color: cssVar('--text-primary', '#161616'), fontSize: 14 },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const first = params[0];
          const d = new Date(first.value[0]);
          const pad = (n: number) => String(n).padStart(2, '0');
          const time = `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
          const rows = (params as any[]).map(
            (p) =>
              `${p.marker}${p.seriesName}: ${formatMetricText(p.value[1], unit)}`,
          );
          return `${time}<br/>${rows.join('<br/>')}`;
        },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: 'line',
        data: s.points.map((p) => [p.timestamp, p.value]),
        sampling: 'lttb',
        smooth: true,
        symbol: 'none',
        lineStyle: { color: colors[i % colors.length], width: 2 },
      })),
    };
  }

  function refresh() {
    if (chart && series.length > 0) {
      chart.setOption(buildOption(), true);
    }
  }

  onMount(() => {
    if (chartEl) {
      chart = echarts.init(chartEl, undefined, { renderer: 'canvas' });
      refresh();
      const ro = new ResizeObserver(() => chart?.resize());
      ro.observe(chartEl);
      return () => {
        ro.disconnect();
        chart?.dispose();
      };
    }
  });

  $effect(() => {
    void series.length;
    void series.map((s) => s.points.length);
    void themeState.dark;
    refresh();
  });
</script>

<div bind:this={chartEl} class="chart"></div>

<style>
  .chart {
    width: 100%;
    height: 100%;
  }
</style>

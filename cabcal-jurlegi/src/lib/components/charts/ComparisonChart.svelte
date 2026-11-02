<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import type { HistoricalPoint } from '../../types/device';

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

  const COLORS = [
    '#78a9ff',
    '#3ddbd9',
    '#f1c21b',
    '#ff8389',
    '#be95ff',
    '#ff7eb6',
  ];

  function buildOption() {
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
        textStyle: { color: '#c6c6c6', fontSize: 14, fontWeight: 600 },
        top: 4,
        itemWidth: 18,
        itemHeight: 10,
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          color: '#c6c6c6',
          fontSize: 13,
          formatter: (v: number) => {
            const d = new Date(v);
            const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            return showDate
              ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}`
              : hm;
          },
        },
        axisLine: { lineStyle: { color: '#525252' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { color: '#c6c6c6', fontSize: 13 },
        axisLabel: { color: '#c6c6c6', fontSize: 13 },
        axisLine: { lineStyle: { color: '#525252' } },
        splitLine: { lineStyle: { color: '#525252' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#393939',
        borderColor: '#525252',
        textStyle: { color: '#f4f4f4', fontSize: 14 },
      },
      series: series.map((s, i) => ({
        name: s.name,
        type: 'line',
        data: s.points.map((p) => [p.timestamp, p.value]),
        smooth: true,
        symbol: 'none',
        lineStyle: { color: COLORS[i % COLORS.length], width: 2 },
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

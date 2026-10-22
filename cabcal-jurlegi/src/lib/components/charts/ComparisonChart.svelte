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

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

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
        textStyle: { color: '#c4ced8', fontSize: 14, fontWeight: 600 },
        top: 4,
        itemWidth: 18,
        itemHeight: 10,
      },
      xAxis: {
        type: 'time',
        axisLabel: {
          color: '#b8c4d0',
          fontSize: 13,
          formatter: (v: number) => {
            const d = new Date(v);
            const hm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
            return showDate ? `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${hm}` : hm;
          },
        },
        axisLine: { lineStyle: { color: '#4a5a6c' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { color: '#b8c4d0', fontSize: 13 },
        axisLabel: { color: '#b8c4d0', fontSize: 13 },
        axisLine: { lineStyle: { color: '#4a5a6c' } },
        splitLine: { lineStyle: { color: '#2d3a48' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a2028',
        borderColor: '#4a5a6c',
        textStyle: { color: '#f0f4f8', fontSize: 14 },
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

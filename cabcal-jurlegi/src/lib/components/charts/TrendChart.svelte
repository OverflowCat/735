<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import type { HistoricalPoint } from '../../types/device';

  interface Props {
    history: HistoricalPoint[];
    unit: string;
    alarmThresholds?: { low: number; up: number };
  }

  const { history, unit, alarmThresholds }: Props = $props();

  let chartEl = $state<HTMLDivElement | null>(null);
  let chart: echarts.ECharts | null = null;

  function buildOption() {
    const markLineData: any[] = [];
    if (alarmThresholds) {
      markLineData.push({
        yAxis: alarmThresholds.up,
        label: { formatter: `上限 ${alarmThresholds.up}`, position: 'insideEndTop' },
        lineStyle: { color: '#ef4444', type: 'dashed' },
      });
      markLineData.push({
        yAxis: alarmThresholds.low,
        label: { formatter: `下限 ${alarmThresholds.low}`, position: 'insideEndBottom' },
        lineStyle: { color: '#f59e0b', type: 'dashed' },
      });
    }

    return {
      grid: { top: 30, right: 15, bottom: 30, left: 50 },
      xAxis: {
        type: 'time',
        axisLabel: {
          color: '#8b98a8',
          fontSize: 11,
          formatter: (v: number) => {
            const d = new Date(v);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          },
        },
        axisLine: { lineStyle: { color: '#2d3a48' } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: unit,
        nameTextStyle: { color: '#8b98a8', fontSize: 11 },
        axisLabel: { color: '#8b98a8', fontSize: 11 },
        axisLine: { lineStyle: { color: '#2d3a48' } },
        splitLine: { lineStyle: { color: '#1e2630' } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#1a2028',
        borderColor: '#2d3a48',
        textStyle: { color: '#e8edf2', fontSize: 13 },
        formatter: (params: any) => {
          const p = params[0];
          if (!p) return '';
          const d = new Date(p.value[0]);
          const time = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          return `${time}<br/>${p.value[1].toFixed(2)} ${unit}`;
        },
      },
      series: [
        {
          type: 'line',
          data: history.map((p) => [p.timestamp, p.value]),
          smooth: true,
          symbol: 'none',
          lineStyle: { color: '#3b82f6', width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.02)' },
            ]),
          },
          markLine: markLineData.length > 0 ? { data: markLineData, silent: true } : undefined,
        },
      ],
    };
  }

  function refresh() {
    if (chart && history.length > 0) {
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
    void history;
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

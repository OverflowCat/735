<script lang="ts">
  import { onMount } from 'svelte';
  import * as echarts from 'echarts';
  import type { HistoricalPoint } from '../../types/device';
  import { cssVar, cssVarA, themeState } from '../../state/theme.svelte';
  import {
    displayUnit,
    formatAxisValue,
    formatMetricText,
  } from '../../utils/format';

  interface Props {
    history: HistoricalPoint[];
    unit: string;
    alarmThresholds?: { low: number; up: number };
  }

  const { history, unit, alarmThresholds }: Props = $props();

  let chartEl = $state<HTMLDivElement | null>(null);
  let chart: echarts.ECharts | null = null;

  function buildOption() {
    const label = cssVar('--chart-label', '#525252');
    const axis = cssVar('--chart-axis', '#525252');
    const markLineData: any[] = [];
    if (alarmThresholds) {
      markLineData.push({
        yAxis: alarmThresholds.up,
        label: {
          formatter: `上限 ${formatAxisValue(alarmThresholds.up)}`,
          position: 'insideEndTop',
        },
        lineStyle: { color: cssVar('--danger', '#da1e28'), type: 'dashed' },
      });
      markLineData.push({
        yAxis: alarmThresholds.low,
        label: {
          formatter: `下限 ${formatAxisValue(alarmThresholds.low)}`,
          position: 'insideEndBottom',
        },
        lineStyle: { color: cssVar('--warning', '#8e6a00'), type: 'dashed' },
      });
    }

    return {
      grid: { top: 30, right: 15, bottom: 30, left: 50 },
      xAxis: {
        type: 'time',
        axisLabel: {
          color: label,
          fontSize: 11,
          formatter: (v: number) => {
            const d = new Date(v);
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          },
        },
        axisLine: { lineStyle: { color: axis } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: displayUnit(unit),
        nameTextStyle: { color: label, fontSize: 11 },
        axisLabel: {
          color: label,
          fontSize: 11,
          formatter: formatAxisValue,
        },
        axisLine: { lineStyle: { color: axis } },
        splitLine: { lineStyle: { color: cssVar('--chart-grid', '#dde1e6') } },
      },
      tooltip: {
        trigger: 'axis',
        backgroundColor: cssVar('--chart-tooltip-bg', '#ffffff'),
        borderColor: cssVar('--chart-tooltip-border', '#c6c6c6'),
        textStyle: { color: cssVar('--text-primary', '#161616'), fontSize: 13 },
        formatter: (params: any) => {
          const p = params[0];
          if (!p) return '';
          const d = new Date(p.value[0]);
          const time = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
          return `${time}<br/>${formatMetricText(p.value[1], unit)}`;
        },
      },
      series: [
        {
          type: 'line',
          data: history.map((p) => [p.timestamp, p.value]),
          sampling: 'lttb',
          smooth: true,
          symbol: 'none',
          lineStyle: { color: cssVar('--accent', '#0f62fe'), width: 2 },
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: cssVarA('--accent', '#0f62fe', 0.3) },
              { offset: 1, color: cssVarA('--accent', '#0f62fe', 0.02) },
            ]),
          },
          markLine:
            markLineData.length > 0
              ? { data: markLineData, silent: true }
              : undefined,
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

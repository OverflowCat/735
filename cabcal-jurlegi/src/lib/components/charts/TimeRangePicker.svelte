<script lang="ts">
  import Calendar from 'carbon-icons-svelte/lib/Calendar.svelte';

  import { Button, TextInput } from 'carbon-components-svelte';
  import {
    TIME_RANGE_LABELS,
    relativeQuery,
    absoluteQuery,
    type HistoryQuery,
    type TimeRange,
  } from '../../services/data-source';

  interface Props {
    query: HistoryQuery;
    onchange: (q: HistoryQuery) => void;
  }

  let { query, onchange }: Props = $props();

  // Seed once from the incoming query; later prop changes only drive button highlight.
  // svelte-ignore state_referenced_locally
  let customMode = $state(query.kind === 'absolute');
  // Seed custom inputs from the current query (or last hour).
  function seed(q: HistoryQuery): { start: string; end: string } {
    const endMs = q.kind === 'absolute' ? q.endMs : Date.now();
    const startMs = q.kind === 'absolute' ? q.startMs : endMs - 60 * 60 * 1000;
    return { start: toLocalInput(startMs), end: toLocalInput(endMs) };
  }
  // svelte-ignore state_referenced_locally
  let custom = $state(seed(query));

  function toLocalInput(ms: number): string {
    const d = new Date(ms);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function pickRelative(range: TimeRange) {
    customMode = false;
    onchange(relativeQuery(range));
  }

  function enterCustom() {
    customMode = true;
    custom = seed(query);
  }

  function applyCustom() {
    const startMs = new Date(custom.start).getTime();
    const endMs = new Date(custom.end).getTime();
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs)
      return;
    onchange(absoluteQuery(startMs, endMs));
  }

  const activeRelative = $derived(
    query.kind === 'relative' ? query.range : null,
  );
</script>

<div class="range-picker">
  <div class="preset-row" role="group" aria-label="历史时间范围">
    {#each Object.entries(TIME_RANGE_LABELS) as [key, label]}
      <Button
        size="small"
        kind={!customMode && activeRelative === key ? 'primary' : 'ghost'}
        aria-pressed={!customMode && activeRelative === key}
        on:click={() => pickRelative(key as TimeRange)}>{label}</Button
      >
    {/each}
    <Button
      size="small"
      kind={customMode ? 'primary' : 'ghost'}
      icon={Calendar}
      aria-pressed={customMode}
      on:click={enterCustom}>自定义</Button
    >
  </div>
  {#if customMode}
    <div class="custom-row">
      <TextInput
        type="datetime-local"
        labelText="开始"
        size="sm"
        bind:value={custom.start}
      />
      <TextInput
        type="datetime-local"
        labelText="结束"
        size="sm"
        bind:value={custom.end}
      />
      <Button size="small" on:click={applyCustom}>查询</Button>
    </div>
  {/if}
</div>

<style>
  .range-picker {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 1px;
  }
  .preset-row :global(.bx--btn) {
    padding: 0 12px;
  }
  .preset-row :global(.bx--btn:has(.bx--btn__icon)) {
    padding-right: 36px;
  }
  .custom-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 12px;
  }
  .custom-row :global(.bx--form-item) {
    flex: 1;
    min-width: 150px;
  }
</style>

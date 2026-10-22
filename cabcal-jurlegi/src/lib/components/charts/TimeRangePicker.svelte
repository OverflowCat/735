<script lang="ts">
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
    if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs > endMs) return;
    onchange(absoluteQuery(startMs, endMs));
  }

  const activeRelative = $derived(query.kind === 'relative' ? query.range : null);
</script>

<div class="range-picker">
  <div class="preset-row">
    {#each Object.entries(TIME_RANGE_LABELS) as [key, label]}
      <button
        class:active={!customMode && activeRelative === key}
        class="small"
        onclick={() => pickRelative(key as TimeRange)}
      >
        {label}
      </button>
    {/each}
    <button class:active={customMode} class="small" onclick={enterCustom}>自定义</button>
  </div>
  {#if customMode}
    <div class="custom-row">
      <label>
        <span>开始</span>
        <input type="datetime-local" bind:value={custom.start} />
      </label>
      <label>
        <span>结束</span>
        <input type="datetime-local" bind:value={custom.end} />
      </label>
      <button class="small primary" onclick={applyCustom}>查询</button>
    </div>
  {/if}
</div>

<style>
  .range-picker {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .preset-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .custom-row {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 8px;
  }

  .custom-row label {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 13px;
    color: var(--text-secondary);
  }

  .custom-row input {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    color: var(--text-primary);
    font-size: 14px;
    padding: 4px 6px;
    font-family: var(--font-mono);
  }

  button.small {
    padding: 4px 10px;
    font-size: 14px;
    border-radius: var(--radius);
    border: 1px solid var(--border);
    background: var(--bg-card);
    color: var(--text-secondary);
    cursor: pointer;
  }

  button.small:hover {
    color: var(--text-primary);
    border-color: var(--text-secondary);
  }

  button.small.active {
    background: var(--accent, #3b82f6);
    border-color: var(--accent, #3b82f6);
    color: #fff;
  }

  button.small.primary {
    background: var(--accent, #3b82f6);
    border-color: var(--accent, #3b82f6);
    color: #fff;
  }

  button.small.primary:hover {
    opacity: 0.9;
  }
</style>

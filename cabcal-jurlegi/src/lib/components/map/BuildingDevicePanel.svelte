<script lang="ts">
  import DragVertical from 'carbon-icons-svelte/lib/DragVertical.svelte';
  import ArrowRight from 'carbon-icons-svelte/lib/ArrowRight.svelte';

  import { Button, SkeletonText } from 'carbon-components-svelte';
  import Renew from 'carbon-icons-svelte/lib/Renew.svelte';
  import { untrack } from 'svelte';
  import {
    appState,
    selectDevice,
    switchMap,
  } from '../../state/app-state.svelte';
  import { deviceSn, deviceStatusLabel } from '../../types/device';
  import { displayUnit, formatMetric } from '../../utils/format';
  import type { MapDefinition } from '../../types/scene';

  let {
    buildingId,
    name,
    maps,
    anchorX,
    anchorY,
    availableWidth,
    availableHeight,
  }: {
    buildingId: string;
    name: string;
    maps: MapDefinition[];
    anchorX: number;
    anchorY: number;
    availableWidth: number;
    availableHeight: number;
  } = $props();

  const storageKey = untrack(() => `cabcal-building-panel-v1-${buildingId}`);
  function loadOffset() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y))
        return saved;
    } catch {
      /* Storage may be unavailable. */
    }
    return { x: 0, y: 0 };
  }
  let offset = $state<{ x: number; y: number }>(loadOffset());
  let drag = $state<{
    id: number;
    x: number;
    y: number;
    left: number;
    top: number;
  } | null>(null);
  const width = $derived(Math.min(260, Math.max(0, availableWidth - 16)));
  const height = $derived(Math.min(370, Math.max(0, availableHeight - 16)));
  const defaultX = $derived(
    Math.max(8, Math.min(availableWidth - width - 8, anchorX)),
  );
  const defaultY = $derived(
    Math.max(8, Math.min(availableHeight - height - 8, anchorY)),
  );
  const left = $derived(
    Math.max(8, Math.min(availableWidth - width - 8, defaultX + offset.x)),
  );
  const top = $derived(
    Math.max(8, Math.min(availableHeight - height - 8, defaultY + offset.y)),
  );
  const groups = $derived(
    maps.map((map) => ({
      map,
      devices: map.scene.devices.flatMap((p) => {
        const device = appState.devices.find((d) => d.id === p.deviceId);
        return device ? [device] : [];
      }),
    })),
  );
  const count = $derived(
    groups.reduce((total, group) => total + group.devices.length, 0),
  );

  function persist() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(offset));
    } catch {
      /* Keep the panel usable for this session. */
    }
  }
  function position(x: number, y: number) {
    offset = {
      x: Math.max(8, Math.min(availableWidth - width - 8, x)) - defaultX,
      y: Math.max(8, Math.min(availableHeight - height - 8, y)) - defaultY,
    };
  }
  function startDrag(e: PointerEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, left, top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function moveDrag(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    position(drag.left + e.clientX - drag.x, drag.top + e.clientY - drag.y);
  }
  function endDrag(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    const handle = e.currentTarget as HTMLElement;
    if (handle.hasPointerCapture(e.pointerId))
      handle.releasePointerCapture(e.pointerId);
    persist();
  }
  function nudge(e: KeyboardEvent) {
    const delta: Record<string, [number, number]> = {
      ArrowLeft: [-10, 0],
      ArrowRight: [10, 0],
      ArrowUp: [0, -10],
      ArrowDown: [0, 10],
    };
    const step = delta[e.key];
    if (!step) return;
    e.preventDefault();
    position(left + step[0], top + step[1]);
    persist();
  }
</script>

<section
  class="building-device-panel"
  class:dragging={!!drag}
  data-building-panel={buildingId}
  aria-label={`${name}设备列表`}
  style:left={`${left}px`}
  style:top={`${top}px`}
  style:width={`${width}px`}
  style:height={`${height}px`}
>
  <header>
    <button
      class="drag-handle"
      title="拖动标题移动窗口，方向键微调"
      aria-label={`移动${name}设备列表`}
      onpointerdown={startDrag}
      onpointermove={moveDrag}
      onpointerup={endDrag}
      onpointercancel={endDrag}
      onkeydown={nudge}
    >
      <span class="grip" aria-hidden="true"><DragVertical size={20} /></span
      ><strong>{name}</strong><small>{count} 台设备</small>
    </button>
    <Button
      kind="ghost"
      size="small"
      icon={Renew}
      iconDescription={`恢复${name}设备列表位置`}
      on:click={() => {
        offset = { x: 0, y: 0 };
        persist();
      }}
    />
  </header>
  <div
    class="device-scroll"
    role="region"
    aria-label={`${name}设备，滚轮上下浏览`}
  >
    {#each groups as group (group.map.id)}
      <div class="floor-heading">
        <span>{group.map.floor ? `${group.map.floor} 楼` : group.map.name}</span
        >
        <Button
          kind="ghost"
          size="small"
          icon={ArrowRight}
          on:click={() => switchMap(group.map.id)}>查看平面图</Button
        >
      </div>
      {#each group.devices as device (device.id)}
        {@const metric = device.metrics[0]}
        {@const level = Math.max(0, ...device.alarms.map((a) => a.level))}
        <Button
          kind="ghost"
          size="small"
          class={`device-row ${appState.selectedDeviceId === device.id ? 'selected' : ''} ${level > 0 ? 'alarm' : ''}`}
          data-panel-device={device.id}
          on:click={() => selectDevice(device.id)}
          title={`${device.name} · ${deviceSn(device)}`}
        >
          <span class="device-info">
            <span class="device-name"
              >{device.type === 'gamma'
                ? `γ${deviceSn(device).slice(-2)}`
                : `Rn ${device.id.slice(6)}`}
              <small
                >{level
                  ? `${level === 2 ? '二' : '一'}级报警`
                  : deviceStatusLabel(device)}</small
              >
            </span>
            <span class="asset">{deviceSn(device)}</span>
          </span>
          <span class="reading">
            {#if !appState.devicesReady}
              <SkeletonText width="80px" />
            {:else if metric && Number.isFinite(metric.value)}
              {@const d = formatMetric(metric.value, metric.unit)}
              {d.value}
              <small>{d.unit}</small>
            {:else}
              —
              <small
                >{metric
                  ? displayUnit(metric.unit)
                  : device.type === 'gamma'
                    ? 'nSv/h'
                    : 'Bq/m3'}</small
              >
            {/if}
          </span>
        </Button>
      {/each}
    {/each}
  </div>
</section>

<style>
  .building-device-panel {
    position: absolute;
    z-index: 6;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    opacity: 0.75;
    border: 1px solid var(--border);
    border-radius: 0;
    background: var(--bg-secondary);
    box-shadow: var(--shadow-lg);
    color: var(--text-primary);
  }
  .dragging {
    box-shadow: var(--shadow-lg);
  }
  header {
    display: flex;
    flex-shrink: 0;
    border-bottom: 1px solid var(--border);
    background: var(--bg-secondary);
  }
  .drag-handle {
    flex: 1;
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
    border: 0;
    border-radius: 0;
    background: transparent;
    color: var(--text-primary);
    padding: 10px;
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .dragging .drag-handle {
    cursor: grabbing;
  }
  .grip {
    color: var(--text-muted);
    font-size: 21px;
    line-height: 1;
  }
  strong {
    font-size: 14px;
  }
  .drag-handle small {
    margin-left: auto;
    font-size: 11px;
    color: var(--text-muted);
  }
  .device-scroll {
    overflow-y: auto;
    overscroll-behavior: contain;
    min-height: 0;
    flex: 1;
    scrollbar-width: thin;
    scrollbar-color: #a8a8a8 #ffffff;
  }
  .floor-heading {
    display: flex;
    justify-content: space-between;
    align-items: center;
    position: sticky;
    top: 0;
    z-index: 1;
    padding: 6px 12px;
    background: var(--bg-tertiary);
    color: var(--text-secondary);
    font-size: 11px;
  }
  .floor-heading :global(.bx--btn) {
    padding: 0 32px 0 8px;
    min-height: 24px;
    font-size: 11px;
  }
  :global(.device-row) {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    max-width: none;
    min-height: 48px;
    gap: 10px;
    border: 0;
    border-bottom: 1px solid var(--border);
    border-radius: 0;
    padding: 8px 12px;
    background: transparent;
    color: var(--text-primary);
    text-align: left;
  }
  :global(.device-row:hover),
  :global(.device-row.selected) {
    background: var(--bg-tertiary);
  }
  :global(.device-row.alarm) {
    color: var(--warning);
    border-left: 3px solid var(--warning);
  }
  .device-info {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .device-name {
    font-size: 13px;
    font-weight: 650;
  }
  .device-name small {
    font-size: 10px;
    font-weight: 400;
    margin-left: 8px;
    opacity: 0.75;
  }
  .asset {
    color: var(--text-muted);
    font-size: 10px;
    font-family: var(--font-mono);
  }
  .reading {
    font-size: 15px;
    text-align: right;
    font-family: var(--font-mono);
    white-space: nowrap;
  }
  .reading small {
    color: var(--text-secondary);
    font-size: 10px;
  }
</style>

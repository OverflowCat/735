<script lang="ts">
  import { appState, selectDevice, moveDevice, addDevicePlacement, removeDevicePlacement } from '../../state/app-state.svelte';
  import type { Device } from '../../types/device';

  let svgEl = $state<SVGSVGElement | null>(null);
  let dragging = $state<string | null>(null);
  let dragOffset = $state({ x: 0, y: 0 });
  let viewBox = $state({ x: 0, y: 0, w: 1200, h: 800 });
  let isPanning = $state(false);
  let panStart = $state({ x: 0, y: 0 });
  let placingDevice = $state<string | null>(null);

  const unplacedDevices = $derived(
    appState.devices.filter((d) => !appState.scene.devices.find((p) => p.deviceId === d.id))
  );

  function deviceById(id: string): Device | undefined {
    return appState.devices.find((d) => d.id === id);
  }

  function statusColor(status: string): string {
    if (status === 'online') return 'var(--status-online)';
    if (status === 'offline') return 'var(--status-offline)';
    return 'var(--status-fault)';
  }

  function alarmColor(device: Device): string {
    if (device.alarms.length === 0) return '';
    const maxLevel = Math.max(...device.alarms.map((a) => a.level));
    return maxLevel === 2 ? 'var(--alarm-l2)' : 'var(--alarm-l1)';
  }

  function deviceLabel(device: Device): string {
    const metric = device.metrics[0];
    if (!metric) return device.name;
    return `${metric.value.toFixed(1)} ${metric.unit}`;
  }

  function statusLabel(status: string): string {
    if (status === 'online') return '在线';
    if (status === 'offline') return '离线';
    return '故障';
  }

  function alarmLabel(device: Device): string {
    if (device.alarms.length === 0) return '';
    const maxLevel = Math.max(...device.alarms.map((a) => a.level));
    return maxLevel === 2 ? '二级报警' : '一级报警';
  }

  function svgPoint(e: MouseEvent): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 };
    const rect = svgEl.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX + viewBox.x,
      y: (e.clientY - rect.top) * scaleY + viewBox.y,
    };
  }

  function handlePointerDown(e: MouseEvent) {
    if (placingDevice) {
      const pt = svgPoint(e);
      addDevicePlacement(placingDevice, pt.x, pt.y);
      placingDevice = null;
      return;
    }

    const target = (e.target as SVGElement).closest('[data-device]') as SVGElement | null;
    if (target) {
      const id = target.dataset.device!;
      if (appState.editMode) {
        dragging = id;
        const pt = svgPoint(e);
        const placement = appState.scene.devices.find((d) => d.deviceId === id);
        if (placement) {
          dragOffset = { x: pt.x - placement.x, y: pt.y - placement.y };
        }
        e.preventDefault();
      } else {
        selectDevice(id);
      }
    } else if (appState.editMode) {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
    } else {
      selectDevice(null);
    }
  }

  function handlePointerMove(e: MouseEvent) {
    if (dragging) {
      const pt = svgPoint(e);
      moveDevice(dragging, pt.x - dragOffset.x, pt.y - dragOffset.y);
    } else if (isPanning) {
      const rect = svgEl?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      viewBox.x -= (e.clientX - panStart.x) * scaleX;
      viewBox.y -= (e.clientY - panStart.y) * scaleY;
      panStart = { x: e.clientX, y: e.clientY };
    }
  }

  function handlePointerUp() {
    dragging = null;
    isPanning = false;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const pt = svgPoint(e);
    viewBox.x = pt.x - (pt.x - viewBox.x) * factor;
    viewBox.y = pt.y - (pt.y - viewBox.y) * factor;
    viewBox.w *= factor;
    viewBox.h *= factor;
  }

  function startPlacing(deviceId: string) {
    placingDevice = deviceId;
  }

  function cancelPlacing() {
    placingDevice = null;
  }
</script>

<div class="map-container">
  {#if appState.editMode}
    <div class="edit-toolbar">
      <span class="edit-label">编辑模式</span>
      {#if unplacedDevices.length > 0}
        <div class="device-placer">
          <span class="placer-label">放置设备:</span>
          {#each unplacedDevices as d}
            <button class="small" onclick={() => startPlacing(d.id)}>
              {d.name}
            </button>
          {/each}
        </div>
      {/if}
      {#if placingDevice}
        <span class="placing-hint">
          点击地图放置「{deviceById(placingDevice)?.name}」
          <button class="small" onclick={cancelPlacing}>取消</button>
        </span>
      {/if}
    </div>
  {/if}

  <!-- svelte-ignore a11y_no_static_element_interactions -->
  <svg
    bind:this={svgEl}
    class="factory-svg"
    viewBox="{viewBox.x} {viewBox.y} {viewBox.w} {viewBox.h}"
    preserveAspectRatio="xMidYMid meet"
    onpointerdown={handlePointerDown}
    onpointermove={handlePointerMove}
    onpointerup={handlePointerUp}
    onpointerleave={handlePointerUp}
    onwheel={handleWheel}
    class:edit-mode={appState.editMode}
    class:placing={placingDevice !== null}
    role="application"
  >
    <!-- Areas -->
    {#each appState.scene.objects.filter((o) => o.kind === 'area') as obj}
      <rect
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        fill={obj.fill || 'transparent'}
        stroke={obj.stroke || 'var(--border)'}
        stroke-width="1"
        rx="4"
      />
      <text
        x={obj.x + obj.width / 2}
        y={obj.y + 20}
        text-anchor="middle"
        class="area-label"
      >
        {obj.label}
      </text>
    {/each}

    <!-- Walls -->
    {#each appState.scene.objects.filter((o) => o.kind === 'wall') as obj}
      <rect
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        fill="#3a4a5c"
      />
    {/each}

    <!-- Machines -->
    {#each appState.scene.objects.filter((o) => o.kind === 'machine') as obj}
      <rect
        x={obj.x}
        y={obj.y}
        width={obj.width}
        height={obj.height}
        fill={obj.fill || '#555'}
        stroke={obj.stroke || '#777'}
        stroke-width="1"
        rx="3"
      />
      <text
        x={obj.x + obj.width / 2}
        y={obj.y + obj.height / 2 + 4}
        text-anchor="middle"
        class="machine-label"
      >
        {obj.label}
      </text>
    {/each}

    <!-- Devices -->
    {#each appState.scene.devices as placement}
      {@const device = deviceById(placement.deviceId)}
      {#if device}
        <g
          data-device={device.id}
          transform="translate({placement.x}, {placement.y})"
          class="device-marker"
          class:selected={appState.selectedDeviceId === device.id}
          class:dragging={dragging === device.id}
        >
          <circle
            r="28"
            fill={alarmColor(device) || 'var(--bg-card)'}
            stroke={statusColor(device.status)}
            stroke-width="3"
          />
          <text
            text-anchor="middle"
            dominant-baseline="central"
            class="device-type-icon"
            font-size="16"
          >
            {device.type === 'gamma' ? 'γ' : 'Rn'}
          </text>
          <circle
            cx="20"
            cy="-20"
            r="6"
            fill={statusColor(device.status)}
          />
          <text y="-38" text-anchor="middle" class="device-name">
            {device.name}
          </text>
          <text y="42" text-anchor="middle" class="device-value" fill={alarmColor(device) || 'var(--text-primary)'}>
            {deviceLabel(device)}
          </text>
          {#if device.alarms.length > 0}
            <rect x="-24" y="50" width="48" height="18" rx="9" fill={alarmColor(device)} opacity="0.2" />
            <text y="62" text-anchor="middle" class="device-alarm" fill={alarmColor(device)}>
              {alarmLabel(device)}
            </text>
          {/if}
          <text y="-52" text-anchor="middle" class="device-status" fill={statusColor(device.status)}>
            {statusLabel(device.status)}
          </text>
        </g>
      {/if}
    {/each}
  </svg>
</div>

<style>
  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: var(--bg-primary);
  }

  .factory-svg {
    width: 100%;
    height: 100%;
    cursor: default;
  }

  .factory-svg.edit-mode {
    cursor: crosshair;
  }

  .factory-svg.placing {
    cursor: copy;
  }

  .edit-toolbar {
    position: absolute;
    top: 8px;
    left: 8px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow);
    flex-wrap: wrap;
  }

  .edit-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--accent);
    padding: 2px 8px;
    border: 1px solid var(--accent);
    border-radius: var(--radius);
  }

  .device-placer {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }

  .placer-label {
    font-size: 12px;
    color: var(--text-secondary);
  }

  .placing-hint {
    font-size: 12px;
    color: var(--warning);
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .area-label {
    font-size: 11px;
    fill: var(--text-secondary);
    pointer-events: none;
    user-select: none;
  }

  .machine-label {
    font-size: 11px;
    fill: var(--text-secondary);
    pointer-events: none;
    user-select: none;
  }

  .device-marker {
    cursor: pointer;
    transition: transform 0.1s;
  }

  .device-marker:hover {
    filter: brightness(1.2);
  }

  .device-marker.selected circle:first-child {
    stroke-width: 4;
    filter: drop-shadow(0 0 8px var(--accent));
  }

  .device-marker.dragging {
    cursor: grabbing;
  }

  .device-type-icon {
    fill: var(--text-primary);
    font-weight: 700;
    pointer-events: none;
    user-select: none;
  }

  .device-name {
    font-size: 11px;
    fill: var(--text-secondary);
    pointer-events: none;
    user-select: none;
  }

  .device-value {
    font-size: 13px;
    font-weight: 600;
    pointer-events: none;
    user-select: none;
  }

  .device-alarm {
    font-size: 10px;
    font-weight: 600;
    pointer-events: none;
    user-select: none;
  }

  .device-status {
    font-size: 10px;
    font-weight: 500;
    pointer-events: none;
    user-select: none;
  }
</style>

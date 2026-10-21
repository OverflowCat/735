<script lang="ts">
  import {
    appState,
    selectDevice,
    moveDevice,
    addDevicePlacement,
    beginPlacementChange,
    setEditSelection,
    removeDevicePlacement,
    nudgeSelectedPlacement,
    undoPlacement,
    redoPlacement,
    snapValue,
    cancelPlacing,
  } from '../../state/app-state.svelte';
  import type { Device } from '../../types/device';

  let svgEl = $state<SVGSVGElement | null>(null);

  // --- Interaction state ---
  let draggingId = $state<string | null>(null);
  let dragMoved = $state(false);
  let dragUndoPushed = false;
  let dragOffset = $state({ x: 0, y: 0 });
  let dragStartScreen = $state({ x: 0, y: 0 });
  let viewBox = $state({ x: 0, y: 0, w: 1200, h: 800 });
  let isPanning = $state(false);
  let panStart = $state({ x: 0, y: 0 });
  let ghost = $state<{ x: number; y: number } | null>(null);
  let hoverDeviceId = $state<string | null>(null);
  let pointerId = $state<number | null>(null);

  const placingDevice = $derived(appState.placingDeviceId);

  /** Screen pixels before a press counts as a drag rather than a click. */
  const DRAG_THRESHOLD = 4;

  function deviceById(id: string): Device | undefined {
    return appState.devices.find((d) => d.id === id);
  }

  function statusColor(status: string): string {
    if (status === 'online') return '#10b981';
    if (status === 'offline') return '#6b7280';
    return '#ef4444';
  }

  function alarmColor(device: Device): string {
    if (device.alarms.length === 0) return '';
    const maxLevel = Math.max(...device.alarms.map((a) => a.level));
    return maxLevel === 2 ? '#ef4444' : '#f59e0b';
  }

  function deviceValueText(device: Device): string {
    const metric = device.metrics[0];
    if (!metric) return device.name;
    const typeLabel = device.type === 'gamma' ? 'γ' : 'Rn';
    return `${device.code}: ${metric.value}${metric.unit}, ${typeLabel}`;
  }

  function pointsToString(pts?: [number, number][]): string {
    if (!pts || pts.length === 0) return '';
    return pts.map(([x, y]) => `${x},${y}`).join(' ');
  }

  function svgPoint(e: MouseEvent | PointerEvent | WheelEvent): { x: number; y: number } {
    if (!svgEl) return { x: 0, y: 0 };
    const rect = svgEl.getBoundingClientRect();
    const scaleX = viewBox.w / rect.width;
    const scaleY = viewBox.h / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX + viewBox.x,
      y: (e.clientY - rect.top) * scaleY + viewBox.y,
    };
  }

  function clampToScene(x: number, y: number): { x: number; y: number } {
    const w = appState.scene.width || 1200;
    const h = appState.scene.height || 800;
    return {
      x: Math.max(0, Math.min(w, x)),
      y: Math.max(0, Math.min(h, y)),
    };
  }

  function handlePointerDown(e: PointerEvent) {
    if (e.button === 1 || (e.button === 0 && e.shiftKey && !placingDevice && !appState.editMode)) {
      // Middle mouse or Shift+drag pans in monitoring mode.
      startPan(e);
      return;
    }
    if (e.button !== 0) return;

    const pt = svgPoint(e);

    if (placingDevice) {
      const snapped = clampToScene(snapValue(pt.x), snapValue(pt.y));
      addDevicePlacement(placingDevice, snapped.x, snapped.y);
      ghost = null;
      return;
    }

    const target = (e.target as SVGElement).closest('[data-device]') as SVGElement | null;

    if (target) {
      const id = target.dataset.device!;
      if (appState.editMode) {
        draggingId = id;
        dragMoved = false;
        dragUndoPushed = false;
        dragStartScreen = { x: e.clientX, y: e.clientY };
        const placement = appState.scene.devices.find((d) => d.deviceId === id);
        if (placement) {
          dragOffset = { x: pt.x - placement.x, y: pt.y - placement.y };
        }
        setEditSelection(id);
        selectDevice(id);
        pointerId = e.pointerId;
        svgEl?.setPointerCapture(e.pointerId);
        e.preventDefault();
      } else {
        selectDevice(id);
      }
      return;
    }

    // Empty space
    if (appState.editMode) {
      setEditSelection(null);
    }
    selectDevice(null);
    startPan(e);
  }

  function startPan(e: PointerEvent) {
    isPanning = true;
    panStart = { x: e.clientX, y: e.clientY };
    pointerId = e.pointerId;
    svgEl?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: PointerEvent) {
    const pt = svgPoint(e);

    if (placingDevice) {
      ghost = { x: snapValue(pt.x), y: snapValue(pt.y) };
      return;
    }

    if (draggingId) {
      const dx = e.clientX - dragStartScreen.x;
      const dy = e.clientY - dragStartScreen.y;
      if (!dragMoved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
      if (!dragUndoPushed) {
        beginPlacementChange();
        dragUndoPushed = true;
      }
      dragMoved = true;
      const snapped = clampToScene(snapValue(pt.x - dragOffset.x), snapValue(pt.y - dragOffset.y));
      moveDevice(draggingId, snapped.x, snapped.y);
      return;
    }

    if (isPanning) {
      const rect = svgEl?.getBoundingClientRect();
      if (!rect) return;
      const scaleX = viewBox.w / rect.width;
      const scaleY = viewBox.h / rect.height;
      viewBox.x -= (e.clientX - panStart.x) * scaleX;
      viewBox.y -= (e.clientY - panStart.y) * scaleY;
      panStart = { x: e.clientX, y: e.clientY };
      return;
    }

    // Hover highlight for edit affordance
    const target = (e.target as SVGElement).closest?.('[data-device]') as SVGElement | null;
    hoverDeviceId = target?.dataset.device ?? null;
  }

  function handlePointerUp(e: PointerEvent) {
    if (pointerId !== null && svgEl?.hasPointerCapture(pointerId)) {
      svgEl.releasePointerCapture(pointerId);
    }
    pointerId = null;

    if (draggingId) {
      const wasClick = !dragMoved;
      const id = draggingId;
      draggingId = null;
      dragMoved = false;
      if (wasClick && appState.editMode) {
        // Pure click in edit mode = select only (already selected on down).
        setEditSelection(id);
      }
    }
    isPanning = false;
  }

  function handlePointerLeave() {
    ghost = null;
    hoverDeviceId = null;
  }

  function handleWheel(e: WheelEvent) {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
    const pt = svgPoint(e);
    viewBox.x = pt.x - (pt.x - viewBox.x) * factor;
    viewBox.y = pt.y - (pt.y - viewBox.y) * factor;
    viewBox.w *= factor;
    viewBox.h *= factor;
  }

  function handleContextMenu(e: MouseEvent) {
    if (!appState.editMode) return;
    const target = (e.target as SVGElement).closest('[data-device]') as SVGElement | null;
    if (!target) return;
    e.preventDefault();
    const id = target.dataset.device!;
    removeDevicePlacement(id);
    ghost = null;
  }

  function handleKeyDown(e: KeyboardEvent) {
    // Only when map is focused-ish / edit interactions are relevant
    const tag = (e.target as HTMLElement)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

    if (e.key === 'Escape') {
      if (placingDevice) {
        cancelPlacing();
        ghost = null;
        e.preventDefault();
      } else if (appState.editSelectionId) {
        setEditSelection(null);
        e.preventDefault();
      }
      return;
    }

    if (!appState.editMode) return;

    if ((e.key === 'Delete' || e.key === 'Backspace') && appState.editSelectionId) {
      removeDevicePlacement(appState.editSelectionId);
      e.preventDefault();
      return;
    }

    if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
      undoPlacement();
      e.preventDefault();
      return;
    }
    if ((e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) || (e.key === 'y' && (e.ctrlKey || e.metaKey))) {
      redoPlacement();
      e.preventDefault();
      return;
    }

    const step = e.shiftKey ? 1 : appState.gridSize;
    if (e.key === 'ArrowLeft') {
      nudgeSelectedPlacement(-step, 0);
      e.preventDefault();
    } else if (e.key === 'ArrowRight') {
      nudgeSelectedPlacement(step, 0);
      e.preventDefault();
    } else if (e.key === 'ArrowUp') {
      nudgeSelectedPlacement(0, -step);
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      nudgeSelectedPlacement(0, step);
      e.preventDefault();
    }
  }

  // Placing is controlled via appState.placingDeviceId (shared with EditPanel).
</script>

<svelte:window onkeydown={handleKeyDown} />

<div class="map-container" class:edit-mode={appState.editMode}>
  {#if appState.editMode}
    <div class="edit-toolbar">
      <span class="edit-label">编辑模式</span>
      {#if placingDevice}
        <span class="placing-hint">
          点击地图放置「{deviceById(placingDevice)?.name}」· Esc 取消
        </span>
      {:else}
        <span class="edit-tip">拖动设备调位置 · 右键移除 · 点击选中编辑</span>
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
    onpointercancel={handlePointerUp}
    onpointerleave={handlePointerLeave}
    onwheel={handleWheel}
    oncontextmenu={handleContextMenu}
    class:edit-mode={appState.editMode}
    class:placing={placingDevice !== null}
    role="application"
    aria-label="工厂平面图"
  >
    <defs>
      <!-- 柔和立体阴影 -->
      <filter id="building-shadow" x="-10%" y="-10%" width="125%" height="130%">
        <feDropShadow dx="3" dy="6" stdDeviation="4" flood-color="#1e3318" flood-opacity="0.4" />
      </filter>

      <!-- 1. C19 黄色金弧立体立面渐变 -->
      <linearGradient id="c19-facade-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#DCD640" />
        <stop offset="45%" stop-color="#BEB928" />
        <stop offset="100%" stop-color="#8E891C" />
      </linearGradient>

      <!-- 2. C35 银灰色立体立面渐变 -->
      <linearGradient id="c35-facade-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#9AA0A8" />
        <stop offset="60%" stop-color="#7B8087" />
        <stop offset="100%" stop-color="#5E636A" />
      </linearGradient>

      <!-- 3. C3 深琥珀棕立面渐变 -->
      <linearGradient id="c3-facade-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#CE9F3E" />
        <stop offset="100%" stop-color="#9C7326" />
      </linearGradient>

      <!-- 4. 集中过滤厂房 青湖蓝立面渐变 -->
      <linearGradient id="filter-facade-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#46A7B8" />
        <stop offset="50%" stop-color="#3494A5" />
        <stop offset="100%" stop-color="#216D7C" />
      </linearGradient>

      <!-- 5. 水冶厂 银冷青灰立面渐变 -->
      <linearGradient id="hydromet-facade-gradient" x1="0%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stop-color="#A4B3A4" />
        <stop offset="60%" stop-color="#8A998A" />
        <stop offset="100%" stop-color="#6F7D6F" />
      </linearGradient>
    </defs>

    <!-- 厂区草地底板（精准采样 #77A56B） -->
    <rect
      x="0"
      y="0"
      width={appState.scene.width || 1200}
      height={appState.scene.height || 800}
      fill={appState.scene.backgroundColor || '#77A56B'}
    />

    <!-- 编辑网格 -->
    {#if appState.editMode && appState.snapToGrid}
      <g class="edit-grid" pointer-events="none">
        {#each Array.from({ length: Math.floor((appState.scene.width || 1200) / appState.gridSize) + 1 }, (_, i) => i * appState.gridSize) as x}
          <line x1={x} y1="0" x2={x} y2={appState.scene.height || 800} />
        {/each}
        {#each Array.from({ length: Math.floor((appState.scene.height || 800) / appState.gridSize) + 1 }, (_, i) => i * appState.gridSize) as y}
          <line x1="0" y1={y} x2={appState.scene.width || 1200} y2={y} />
        {/each}
      </g>
    {/if}

    <!-- 原图外框装饰暗线 -->
    <rect
      x="2"
      y="2"
      width={(appState.scene.width || 1200) - 4}
      height={(appState.scene.height || 800) - 4}
      fill="none"
      stroke="#5A8050"
      stroke-width="3"
    />

    <!-- 厂房建筑物渲染（2.5D 立体顶面与下部斜面厚度） -->
    {#each appState.scene.objects as obj (obj.id)}
      <g class="building-group" filter="url(#building-shadow)">
        {#if obj.shape === 'polygon' && obj.points}
          <!-- 多边形立面（正面银灰立体斜坡） -->
          {#if obj.frontPoints}
            <polygon
              points={pointsToString(obj.frontPoints)}
              fill={obj.facadeFill || '#7B8087'}
              stroke={obj.stroke || 'rgba(0,0,0,0.35)'}
              stroke-width="1.2"
            />
          {/if}

          <!-- 多边形顶面 -->
          <polygon
            points={pointsToString(obj.points)}
            fill={obj.fill || '#4A4C4D'}
            stroke={obj.stroke || 'rgba(0,0,0,0.4)'}
            stroke-width="1.5"
          />
        {:else if obj.x !== undefined && obj.y !== undefined && obj.width && obj.height}
          <!-- 矩形建筑立体下部立面（圆弧/斜坡屋檐） -->
          {#if obj.facadeHeight && obj.facadeFill}
            <rect
              x={obj.x}
              y={obj.y + obj.height}
              width={obj.width}
              height={obj.facadeHeight}
              fill={obj.facadeFill}
              stroke={obj.stroke || 'rgba(0,0,0,0.3)'}
              stroke-width="1.2"
              rx="1"
            />
          {/if}

          <!-- 矩形建筑顶面 -->
          <rect
            x={obj.x}
            y={obj.y}
            width={obj.width}
            height={obj.height}
            fill={obj.fill || '#3a4a5c'}
            stroke={obj.stroke || 'rgba(0,0,0,0.35)'}
            stroke-width="1.5"
            rx="1"
          />
        {/if}

        <!-- 厂房标牌字体（汉字宋体/仿宋，英文Times/衬线，完全还原原图风格） -->
        <text
          x={obj.labelX ?? (obj.x !== undefined && obj.width ? obj.x + obj.width / 2 : 0)}
          y={obj.labelY ?? (obj.y !== undefined && obj.height ? obj.y + obj.height / 2 : 0)}
          text-anchor="middle"
          dominant-baseline="central"
          fill={obj.labelColor || '#ffffff'}
          font-size={obj.labelFontSize || 28}
          font-weight="bold"
          class="building-title"
          class:serif-cn={/[\u4e00-\u9fa5]/.test(obj.label)}
          class:serif-en={!/[\u4e00-\u9fa5]/.test(obj.label)}
        >
          {obj.label}
        </text>
      </g>
    {/each}

    <!-- 现场监测设备点位与数据标注 -->
    {#each appState.scene.devices as placement (placement.deviceId)}
      {@const device = deviceById(placement.deviceId)}
      {#if device}
        {@const isSel = appState.editSelectionId === device.id || appState.selectedDeviceId === device.id}
        {@const isHover = hoverDeviceId === device.id}
        <g
          data-device={device.id}
          transform="translate({placement.x}, {placement.y})"
          class="device-node"
          class:selected={isSel}
          class:dragging={draggingId === device.id}
          class:hovered={isHover}
          class:edit-mode={appState.editMode}
        >
          <!-- Generous invisible hit target (text labels are hard to grab) -->
          <circle r="22" fill="transparent" class="hit-area" />

          {#if isSel}
            <circle class="select-ring" r="20" />
          {/if}

          {#if placement.labelStyle === 'text'}
            <!-- 原图同款黄色工程技术字体，自然融入草坪 -->
            <g class="text-label-style">
              <!-- 文本读数显示（与图片 1-1: 0.1uSv/h, γ 完全一致） -->
              <text
                x="0"
                y="0"
                fill="#C6ED56"
                font-size="19"
                font-weight="bold"
                class="diagram-text"
              >
                {deviceValueText(device)}
              </text>
            </g>
          {:else if placement.labelStyle === 'compact'}
            <!-- 紧凑指示标（原 badge 行为） -->
            <g class="badge-style" opacity="0.85">
              <circle
                r="12"
                fill="rgba(24, 38, 22, 0.85)"
                stroke={statusColor(device.status)}
                stroke-width="2"
              />
              <text
                text-anchor="middle"
                dominant-baseline="central"
                fill="#ffffff"
                font-size="11"
                font-weight="bold"
              >
                {device.type === 'gamma' ? 'γ' : 'Rn'}
              </text>
            </g>
          {:else}
            <!-- badge / default: marker + short code -->
            <g class="badge-style">
              <circle
                r="13"
                fill="rgba(24, 38, 22, 0.9)"
                stroke={statusColor(device.status)}
                stroke-width="2.5"
              />
              {#if alarmColor(device)}
                <circle r="13" fill="none" stroke={alarmColor(device)} stroke-width="1.5" stroke-dasharray="3 2" />
              {/if}
              <text
                text-anchor="middle"
                dominant-baseline="central"
                fill="#ffffff"
                font-size="11"
                font-weight="bold"
              >
                {device.type === 'gamma' ? 'γ' : 'Rn'}
              </text>
              <text
                y="28"
                text-anchor="middle"
                fill="#e8f5d8"
                font-size="11"
                font-weight="600"
                class="device-caption"
              >
                {device.code}
              </text>
            </g>
          {/if}
        </g>
      {/if}
    {/each}

    <!-- Placement ghost preview -->
    {#if placingDevice && ghost}
      {@const ghostDevice = deviceById(placingDevice)}
      <g
        transform="translate({ghost.x}, {ghost.y})"
        class="placement-ghost"
        pointer-events="none"
      >
        <circle r="18" fill="rgba(56, 189, 248, 0.2)" stroke="#38bdf8" stroke-width="2" stroke-dasharray="4 3" />
        <circle r="3" fill="#38bdf8" />
        {#if ghostDevice}
          <text y="-26" text-anchor="middle" fill="#38bdf8" font-size="12" font-weight="600">
            {ghostDevice.name}
          </text>
        {/if}
      </g>
    {/if}
  </svg>

  {#if appState.editMode}
    <div class="coord-readout" aria-hidden="true">
      {#if ghost}
        {Math.round(ghost.x)}, {Math.round(ghost.y)}
      {:else if appState.editSelectionId}
        {@const p = appState.scene.devices.find((d) => d.deviceId === appState.editSelectionId)}
        {#if p}
          选中 {Math.round(p.x)}, {Math.round(p.y)}
        {/if}
      {:else}
        {appState.scene.width}×{appState.scene.height}
      {/if}
    </div>
  {/if}
</div>

<style>
  .map-container {
    flex: 1;
    position: relative;
    overflow: hidden;
    background: #658c5a;
    display: flex;
    min-width: 0;
  }

  .factory-svg {
    width: 100%;
    height: 100%;
    cursor: default;
    user-select: none;
    touch-action: none;
  }

  .factory-svg.edit-mode {
    cursor: crosshair;
  }

  .factory-svg.placing {
    cursor: copy;
  }

  .building-group {
    cursor: default;
  }

  /* 汉字宋体/仿宋风格 */
  .serif-cn {
    font-family: 'SimSun', 'Songti SC', 'STSong', 'KaiTi', 'SimHei', serif;
    letter-spacing: 2px;
  }

  /* 英文/代号 Times New Roman 衬线风格 */
  .serif-en {
    font-family: 'Times New Roman', 'Georgia', 'SimSun', serif;
    letter-spacing: 1px;
  }

  .building-title {
    pointer-events: none;
    user-select: none;
    filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.3));
  }

  .device-node {
    cursor: pointer;
  }

  .device-node.edit-mode {
    cursor: grab;
  }

  .device-node.edit-mode.dragging {
    cursor: grabbing;
  }

  .device-node .hit-area {
    cursor: inherit;
  }

  .device-node:hover .badge-style circle:first-child {
    filter: brightness(1.2);
  }

  .device-node.hovered {
    filter: brightness(1.15);
  }

  .device-node.selected .diagram-text,
  .device-node.selected text {
    fill: #ffffff !important;
    filter: drop-shadow(0 0 6px #38bdf8) drop-shadow(0 0 10px #38bdf8);
  }

  .device-node.dragging {
    filter: brightness(1.3) drop-shadow(0 4px 10px rgba(0, 0, 0, 0.35));
    cursor: grabbing;
  }

  .select-ring {
    fill: none;
    stroke: #38bdf8;
    stroke-width: 2;
    stroke-dasharray: 5 3;
    pointer-events: none;
    animation: spin-dash 12s linear infinite;
    transform-origin: center;
    transform-box: fill-box;
  }

  @keyframes spin-dash {
    to {
      stroke-dashoffset: -80;
    }
  }

  .device-caption {
    pointer-events: none;
    paint-order: stroke;
    stroke: rgba(20, 40, 16, 0.75);
    stroke-width: 3px;
    font-family: 'Courier New', 'Consolas', monospace;
  }

  .diagram-text {
    font-family: 'Courier New', 'Consolas', 'SimSun', monospace;
    letter-spacing: 0.5px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
  }

  .edit-grid line {
    stroke: rgba(255, 255, 255, 0.08);
    stroke-width: 1;
  }

  .placement-ghost text {
    font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
    paint-order: stroke;
    stroke: rgba(15, 23, 42, 0.8);
    stroke-width: 3px;
    pointer-events: none;
  }

  .edit-toolbar {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 10;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 14px;
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 8px;
    color: #fff;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
    pointer-events: none;
  }

  .edit-label {
    font-size: 13px;
    font-weight: 600;
    color: #38bdf8;
    padding: 2px 8px;
    border: 1px solid #38bdf8;
    border-radius: 4px;
  }

  .edit-tip {
    font-size: 12px;
    color: #94a3b8;
  }

  .placing-hint {
    font-size: 12px;
    color: #f59e0b;
  }

  .coord-readout {
    position: absolute;
    right: 12px;
    bottom: 12px;
    z-index: 5;
    padding: 4px 10px;
    border-radius: 4px;
    background: rgba(15, 23, 42, 0.75);
    color: #94a3b8;
    font-size: 11px;
    font-family: 'Courier New', monospace;
    pointer-events: none;
    border: 1px solid rgba(255, 255, 255, 0.1);
  }
</style>

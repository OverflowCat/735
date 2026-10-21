<script lang="ts">
  import { appState, selectDevice, moveDevice, addDevicePlacement } from '../../state/app-state.svelte';
  import type { Device } from '../../types/device';
  import type { SceneObject } from '../../types/scene';

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
      moveDevice(dragging, Math.round(pt.x - dragOffset.x), Math.round(pt.y - dragOffset.y));
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
    const factor = e.deltaY > 0 ? 1.08 : 0.92;
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
    {#each appState.scene.objects as obj}
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
    {#each appState.scene.devices as placement}
      {@const device = deviceById(placement.deviceId)}
      {#if device}
        <g
          data-device={device.id}
          transform="translate({placement.x}, {placement.y})"
          class="device-node"
          class:selected={appState.selectedDeviceId === device.id}
          class:dragging={dragging === device.id}
        >
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
          {:else}
            <!-- 厂区其它测点的紧凑半透明指示标 -->
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
          {/if}
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
    background: #658c5a;
    display: flex;
  }

  .factory-svg {
    width: 100%;
    height: 100%;
    cursor: default;
    user-select: none;
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
    transition: transform 0.12s ease;
  }

  .device-node:hover {
    filter: brightness(1.25);
  }

  .device-node.selected text {
    fill: #ffffff !important;
    text-shadow: 0 0 8px #38bdf8, 0 0 12px #38bdf8;
  }

  .device-node.dragging {
    cursor: grabbing;
  }

  .diagram-text {
    font-family: 'Courier New', 'Consolas', 'SimSun', monospace;
    letter-spacing: 0.5px;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.45);
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
  }

  .edit-label {
    font-size: 13px;
    font-weight: 600;
    color: #38bdf8;
    padding: 2px 8px;
    border: 1px solid #38bdf8;
    border-radius: 4px;
  }

  .device-placer {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .placer-label {
    font-size: 12px;
    color: #94a3b8;
  }

  .placing-hint {
    font-size: 12px;
    color: #f59e0b;
    display: flex;
    align-items: center;
    gap: 6px;
  }
</style>

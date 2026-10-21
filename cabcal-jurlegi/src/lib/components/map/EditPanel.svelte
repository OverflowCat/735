<script lang="ts">
  import {
    appState,
    removeDevicePlacement,
    updatePlacement,
    setPlacementLabelStyle,
    resetPlacements,
    saveScene,
    setSnapToGrid,
    undoPlacement,
    redoPlacement,
    nudgeSelectedPlacement,
    beginPlacementChange,
    startPlacing,
    cancelPlacing,
  } from '../../state/app-state.svelte';
  import type { Device } from '../../types/device';
  import type { DevicePlacement } from '../../types/scene';

  let saveState = $state<'idle' | 'saving' | 'saved' | 'local'>('idle');

  const unplacedDevices = $derived(
    appState.devices.filter((d) => !appState.scene.devices.find((p) => p.deviceId === d.id))
  );

  const selectedPlacement = $derived(
    appState.editSelectionId
      ? appState.scene.devices.find((p) => p.deviceId === appState.editSelectionId)
      : undefined
  );

  const selectedDevice = $derived(
    appState.editSelectionId
      ? appState.devices.find((d) => d.id === appState.editSelectionId)
      : undefined
  );

  function deviceById(id: string): Device | undefined {
    return appState.devices.find((d) => d.id === id);
  }

  async function handleSave() {
    saveState = 'saving';
    const ok = await saveScene();
    saveState = ok ? 'saved' : 'local';
    setTimeout(() => {
      saveState = 'idle';
    }, 1800);
  }

  function onCoordInput(axis: 'x' | 'y', e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const n = Number(input.value);
    if (!selectedPlacement || Number.isNaN(n)) return;
    updatePlacement(selectedPlacement.deviceId, {
      [axis]: Math.max(0, Math.min(axis === 'x' ? appState.scene.width : appState.scene.height, n)),
    });
  }

  function onLabelStyleChange(e: Event) {
    const select = e.currentTarget as HTMLSelectElement;
    if (!selectedPlacement) return;
    setPlacementLabelStyle(
      selectedPlacement.deviceId,
      select.value as DevicePlacement['labelStyle'],
    );
  }
</script>

<aside class="edit-panel" aria-label="地图编辑面板">
  <header class="panel-header">
    <span class="edit-label">编辑模式</span>
    <span class="dirty-flag" class:dirty={appState.sceneDirty}>
      {appState.sceneDirty ? '未保存' : '已同步'}
    </span>
  </header>

  <section class="panel-section">
    <div class="section-title">
      <span>操作</span>
      <label class="snap-toggle" title="拖动/放置时对齐到网格">
        <input
          type="checkbox"
          checked={appState.snapToGrid}
          onchange={(e) => setSnapToGrid(e.currentTarget.checked)}
        />
        吸附 {appState.gridSize}px
      </label>
    </div>
    <div class="btn-row">
      <button class="small" onclick={handleSave} disabled={saveState === 'saving'}>
        {#if saveState === 'saving'}
          保存中…
        {:else if saveState === 'saved'}
          已保存
        {:else if saveState === 'local'}
          已存本地
        {:else}
          保存布局
        {/if}
      </button>
      <button class="small" onclick={() => undoPlacement()} title="撤销 (Ctrl+Z)">撤销</button>
      <button class="small" onclick={() => redoPlacement()} title="重做 (Ctrl+Shift+Z)">重做</button>
      <button class="small danger" onclick={() => resetPlacements()} title="恢复默认点位">
        重置点位
      </button>
    </div>
  </section>

  <section class="panel-section">
    <div class="section-title">放置设备</div>
    {#if appState.placingDeviceId}
      <div class="placing-hint">
        <span>
          正在放置「{deviceById(appState.placingDeviceId)?.name ?? appState.placingDeviceId}」— 点击地图确定位置
        </span>
        <button class="small" onclick={() => cancelPlacing()}>取消 (Esc)</button>
      </div>
    {:else if unplacedDevices.length > 0}
      <div class="device-list">
        {#each unplacedDevices as d (d.id)}
          <button class="device-chip" onclick={() => startPlacing(d.id)}>
            <span class="chip-type">{d.type === 'gamma' ? 'γ' : 'Rn'}</span>
            <span class="chip-name">{d.name}</span>
          </button>
        {/each}
      </div>
    {:else}
      <p class="empty-hint">全部设备已放置到地图上</p>
    {/if}
  </section>

  <section class="panel-section">
    <div class="section-title">选中点位</div>
    {#if selectedPlacement && selectedDevice}
      {@const p = selectedPlacement}
      {@const d = selectedDevice}
      <div class="inspector">
        <div class="inspector-title">
          <span class="chip-type">{d.type === 'gamma' ? 'γ' : 'Rn'}</span>
          <div>
            <div class="name">{d.name}</div>
            <div class="code">{d.code}</div>
          </div>
        </div>

        <label class="field">
          <span>X</span>
          <input
            type="number"
            value={p.x}
            min="0"
            max={appState.scene.width}
            onchange={(e) => onCoordInput('x', e)}
          />
        </label>
        <label class="field">
          <span>Y</span>
          <input
            type="number"
            value={p.y}
            min="0"
            max={appState.scene.height}
            onchange={(e) => onCoordInput('y', e)}
          />
        </label>

        <label class="field">
          <span>标注样式</span>
          <select value={p.labelStyle ?? 'badge'} onchange={onLabelStyleChange}>
            <option value="badge">指示标</option>
            <option value="text">工程字体</option>
            <option value="compact">紧凑</option>
          </select>
        </label>

        <div class="hint-line">方向键微调 · Delete 移除</div>
        <div class="btn-row">
          <button class="small" onclick={() => nudgeSelectedPlacement(-10, 0)}>←</button>
          <button class="small" onclick={() => nudgeSelectedPlacement(10, 0)}>→</button>
          <button class="small" onclick={() => nudgeSelectedPlacement(0, -10)}>↑</button>
          <button class="small" onclick={() => nudgeSelectedPlacement(0, 10)}>↓</button>
          <button
            class="small danger"
            onclick={() => removeDevicePlacement(p.deviceId)}
          >
            移除点位
          </button>
        </div>
      </div>
    {:else}
      <p class="empty-hint">点击地图上的设备进行选择 / 拖动</p>
    {/if}
  </section>

  <footer class="panel-footer">
    <div>拖空白平移 · 滚轮缩放</div>
    <div>Esc 取消放置 · Ctrl+Z 撤销</div>
  </footer>
</aside>

<style>
  .edit-panel {
    width: 260px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 0;
    background: var(--bg-secondary, #0f172a);
    border-left: 1px solid var(--border, rgba(255, 255, 255, 0.12));
    color: #e2e8f0;
    overflow-y: auto;
    z-index: 5;
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  }

  .edit-label {
    font-size: 14px;
    font-weight: 600;
    color: #38bdf8;
    padding: 2px 8px;
    border: 1px solid #38bdf8;
    border-radius: 4px;
  }

  .dirty-flag {
    font-size: 13px;
    color: #64748b;
  }

  .dirty-flag.dirty {
    color: #f59e0b;
    font-weight: 600;
  }

  .panel-section {
    padding: 12px 14px;
    border-bottom: 1px solid rgba(255, 255, 255, 0.06);
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .section-title {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 13px;
    font-weight: 600;
    color: #94a3b8;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .snap-toggle {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 400;
    text-transform: none;
    letter-spacing: 0;
    color: #94a3b8;
    cursor: pointer;
    user-select: none;
  }

  .btn-row {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .btn-row button {
    font-size: 13px;
  }

  .device-list {
    display: flex;
    flex-direction: column;
    gap: 6px;
    max-height: 180px;
    overflow-y: auto;
  }

  .device-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    padding: 7px 10px;
    background: rgba(56, 189, 248, 0.08);
    border: 1px solid rgba(56, 189, 248, 0.25);
    border-radius: 6px;
    color: #e2e8f0;
    cursor: pointer;
    font-size: 13px;
  }

  .device-chip:hover {
    background: rgba(56, 189, 248, 0.18);
    border-color: #38bdf8;
  }

  .chip-type {
    flex-shrink: 0;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    background: rgba(15, 23, 42, 0.9);
    border: 1.5px solid #10b981;
    font-size: 12px;
    font-weight: 700;
  }

  .chip-name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .placing-hint {
    display: flex;
    flex-direction: column;
    gap: 8px;
    font-size: 13px;
    color: #fbbf24;
    background: rgba(245, 158, 11, 0.1);
    border: 1px dashed rgba(245, 158, 11, 0.45);
    border-radius: 6px;
    padding: 10px;
  }

  .empty-hint {
    margin: 0;
    font-size: 13px;
    color: #64748b;
    line-height: 1.5;
  }

  .inspector {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .inspector-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .inspector-title .name {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
  }

  .inspector-title .code {
    font-size: 12px;
    color: #94a3b8;
  }

  .field {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #94a3b8;
  }

  .field span {
    width: 56px;
    flex-shrink: 0;
  }

  .field input,
  .field select {
    flex: 1;
    min-width: 0;
    padding: 5px 8px;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.15);
    background: rgba(15, 23, 42, 0.8);
    color: #e2e8f0;
    font-size: 13px;
  }

  .field input:focus,
  .field select:focus {
    outline: 1px solid #38bdf8;
  }

  .hint-line {
    font-size: 12px;
    color: #64748b;
  }

  .panel-footer {
    margin-top: auto;
    padding: 10px 14px 14px;
    font-size: 12px;
    color: #64748b;
    display: flex;
    flex-direction: column;
    gap: 4px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }

  :global(.small.danger) {
    border-color: rgba(239, 68, 68, 0.5) !important;
    color: #fca5a5 !important;
  }

  :global(.small.danger:hover) {
    background: rgba(239, 68, 68, 0.2) !important;
    border-color: #ef4444 !important;
  }
</style>

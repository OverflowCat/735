<script lang="ts">
  import SettingsAdjust from 'carbon-icons-svelte/lib/SettingsAdjust.svelte';
  import Location from 'carbon-icons-svelte/lib/Location.svelte';
  import Pin from 'carbon-icons-svelte/lib/Pin.svelte';
  import TrashCan from 'carbon-icons-svelte/lib/TrashCan.svelte';
  import Reset from 'carbon-icons-svelte/lib/Reset.svelte';

  import {
    Button,
    Tag,
    Checkbox,
    NumberInput,
    Select,
    SelectItem,
    InlineNotification,
  } from 'carbon-components-svelte';
  import Save from 'carbon-icons-svelte/lib/Save.svelte';
  import Undo from 'carbon-icons-svelte/lib/Undo.svelte';
  import Redo from 'carbon-icons-svelte/lib/Redo.svelte';
  import ArrowLeft from 'carbon-icons-svelte/lib/ArrowLeft.svelte';
  import ArrowRight from 'carbon-icons-svelte/lib/ArrowRight.svelte';
  import ArrowUp from 'carbon-icons-svelte/lib/ArrowUp.svelte';
  import ArrowDown from 'carbon-icons-svelte/lib/ArrowDown.svelte';
  import {
    appState,
    mapDevices,
    removeDevicePlacement,
    updatePlacement,
    setPlacementLabelStyle,
    resetPlacements,
    saveScene,
    setSnapToGrid,
    undoPlacement,
    redoPlacement,
    nudgeSelectedPlacement,
    startPlacing,
    cancelPlacing,
  } from '../../state/app-state.svelte';
  import type { Device } from '../../types/device';
  import { deviceSn } from '../../types/device';
  import type { DevicePlacement } from '../../types/scene';

  let saveState = $state<'idle' | 'saving' | 'saved' | 'local' | 'error'>(
    'idle',
  );

  const unplacedDevices = $derived(
    mapDevices().filter(
      (d) => !appState.scene.devices.find((p) => p.deviceId === d.id),
    ),
  );

  const selectedPlacement = $derived(
    appState.editSelectionId
      ? appState.scene.devices.find(
          (p) => p.deviceId === appState.editSelectionId,
        )
      : undefined,
  );

  const selectedDevice = $derived(
    appState.editSelectionId
      ? appState.devices.find((d) => d.id === appState.editSelectionId)
      : undefined,
  );

  function deviceById(id: string): Device | undefined {
    return appState.devices.find((d) => d.id === id);
  }

  async function handleSave() {
    saveState = 'saving';
    try {
      const ok = await saveScene();
      saveState = ok ? 'saved' : 'local';
    } catch {
      saveState = 'error';
    }
    setTimeout(() => {
      saveState = 'idle';
    }, 1800);
  }

  function setCoordinate(axis: 'x' | 'y', value: number | null) {
    if (!selectedPlacement || value === null || !Number.isFinite(value)) return;
    updatePlacement(selectedPlacement.deviceId, {
      [axis]: Math.max(
        0,
        Math.min(
          axis === 'x' ? appState.scene.width : appState.scene.height,
          value,
        ),
      ),
    });
  }
</script>

<aside class="edit-panel" aria-label="地图编辑面板">
  <header class="panel-header">
    <div>
      <p class="eyebrow">布局配置</p>
      <h2><SettingsAdjust size={20} />编辑模式</h2>
    </div>
    <Tag type={appState.sceneDirty ? 'magenta' : 'gray'} size="sm"
      >{appState.sceneDirty ? '布局已修改' : '本地布局'}</Tag
    >
  </header>
  <section class="panel-section">
    <Checkbox
      labelText={`吸附网格 · ${appState.gridSize}px`}
      checked={appState.snapToGrid}
      on:check={(e) => setSnapToGrid(e.detail)}
    />
    <div class="btn-row save-row">
      <Button
        size="small"
        icon={Save}
        on:click={handleSave}
        disabled={saveState === 'saving'}
      >
        {saveState === 'saving'
          ? '保存中…'
          : saveState === 'saved'
            ? '已保存'
            : saveState === 'local'
              ? '已存本地'
              : saveState === 'error'
                ? '保存失败'
                : '保存布局'}
      </Button>
      <Button
        kind="ghost"
        size="small"
        icon={Undo}
        iconDescription="撤销 (Ctrl+Z)"
        on:click={() => undoPlacement()}
      />
      <Button
        kind="ghost"
        size="small"
        icon={Redo}
        iconDescription="重做 (Ctrl+Shift+Z)"
        on:click={() => redoPlacement()}
      />
    </div>
    <Button
      icon={Reset}
      kind="danger-ghost"
      size="small"
      on:click={() => resetPlacements()}>重置点位</Button
    >
  </section>
  <section class="panel-section">
    <h3><Pin size={16} />放置设备</h3>
    {#if appState.placingDeviceId}
      <InlineNotification
        kind="info"
        title="点击地图确定位置"
        subtitle={`正在放置 ${deviceSn(deviceById(appState.placingDeviceId) ?? { id: appState.placingDeviceId })}`}
        hideCloseButton
        lowContrast
      />
      <Button kind="ghost" size="small" on:click={() => cancelPlacing()}
        >取消 (Esc)</Button
      >
    {:else if unplacedDevices.length > 0}
      <div class="device-list">
        {#each unplacedDevices as d (d.id)}
          <Button
            class="device-chip"
            kind="tertiary"
            size="small"
            on:click={() => startPlacing(d.id)}
            ><span class="chip-type">{d.type === 'gamma' ? 'γ' : 'Rn'}</span
            ><span class="mono">{deviceSn(d)}</span></Button
          >
        {/each}
      </div>
    {:else}<p class="empty-hint">本层设备已全部放置</p>{/if}
  </section>
  <section class="panel-section">
    <h3><Location size={16} />选中点位</h3>
    {#if selectedPlacement && selectedDevice}
      {@const p = selectedPlacement}
      <div class="inspector">
        <div>
          <p class="selected-name mono">{deviceSn(selectedDevice)}</p>
          <p class="empty-hint">{selectedDevice.name}</p>
        </div>
        <div class="coordinates">
          <NumberInput
            labelText="X 坐标"
            size="sm"
            value={p.x}
            min={0}
            max={appState.scene.width}
            hideSteppers
            invalidText="坐标超出地图范围"
            on:change={(e) => setCoordinate('x', e.detail)}
          />
          <NumberInput
            labelText="Y 坐标"
            size="sm"
            value={p.y}
            min={0}
            max={appState.scene.height}
            hideSteppers
            invalidText="坐标超出地图范围"
            on:change={(e) => setCoordinate('y', e.detail)}
          />
        </div>
        <Select
          labelText="标注样式"
          size="sm"
          selected={p.labelStyle ?? 'badge'}
          on:update={(e) =>
            setPlacementLabelStyle(
              p.deviceId,
              e.detail as DevicePlacement['labelStyle'],
            )}
        >
          <SelectItem value="badge" text="指示标" /><SelectItem
            value="text"
            text="完整标注"
          /><SelectItem value="compact" text="紧凑" />
        </Select>
        <div class="btn-row" role="group" aria-label="微调点位">
          <Button
            kind="ghost"
            size="small"
            icon={ArrowLeft}
            iconDescription="向左移动"
            on:click={() => nudgeSelectedPlacement(-10, 0)}
          />
          <Button
            kind="ghost"
            size="small"
            icon={ArrowRight}
            iconDescription="向右移动"
            on:click={() => nudgeSelectedPlacement(10, 0)}
          />
          <Button
            kind="ghost"
            size="small"
            icon={ArrowUp}
            iconDescription="向上移动"
            on:click={() => nudgeSelectedPlacement(0, -10)}
          />
          <Button
            kind="ghost"
            size="small"
            icon={ArrowDown}
            iconDescription="向下移动"
            on:click={() => nudgeSelectedPlacement(0, 10)}
          />
        </div>
        <Button
          kind="danger-tertiary"
          icon={TrashCan}
          size="small"
          on:click={() => removeDevicePlacement(p.deviceId)}>移除点位</Button
        >
      </div>
    {:else}<p class="empty-hint">在地图上选择一个设备，以调整安装位置。</p>{/if}
  </section>
  <footer class="panel-footer">
    <p>布局仅保存在当前浏览器</p>
    <p>方向键微调 · Delete 移除 · Esc 取消</p>
  </footer>
</aside>

<style>
  .edit-panel {
    width: 288px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    background: var(--bg-primary);
    border-left: 1px solid var(--border);
    overflow-y: auto;
    z-index: 10;
  }
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 24px 16px;
    border-bottom: 1px solid var(--border);
    gap: 8px;
  }
  .eyebrow {
    font-size: 12px;
    color: var(--text-secondary);
    margin: 0 0 8px;
  }
  h2 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 20px;
    font-weight: 400;
    margin: 0;
  }
  .panel-section {
    padding: 24px 16px;
    border-bottom: 1px solid var(--border);
  }
  h3 {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 600;
    margin: 0 0 16px;
  }
  .btn-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 4px;
  }
  .save-row {
    margin-top: 16px;
    margin-bottom: 8px;
  }
  .device-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .device-list :global(.bx--btn) {
    max-width: none;
    justify-content: flex-start;
    padding: 0 12px;
  }
  .chip-type {
    min-width: 24px;
    margin-right: 12px;
    color: var(--text-secondary);
  }
  .empty-hint {
    font-size: 12px;
    line-height: 20px;
    color: var(--text-muted);
    margin: 0;
  }
  .selected-name {
    font-size: 14px;
    margin: 0 0 4px;
  }
  .inspector {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .coordinates {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .coordinates :global(.bx--number) {
    width: 100%;
    min-width: 0;
  }
  .coordinates :global(input) {
    min-width: 0;
  }
  .panel-footer {
    margin-top: auto;
    padding: 16px;
    font-size: 11px;
    line-height: 20px;
    color: var(--text-muted);
  }
  .panel-footer p {
    margin: 0;
  }
  .panel-section :global(.bx--inline-notification) {
    min-width: 0;
    margin-bottom: 8px;
  }
  @media (max-width: 650px) {
    .edit-panel {
      width: 240px;
    }
  }
</style>

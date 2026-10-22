<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { appState, selectDevice } from '../../state/app-state.svelte';
  import type { Device } from '../../types/device';

  let containerEl = $state<HTMLDivElement | null>(null);
  let initError = $state<string | null>(null);
  let renderer: THREE.WebGLRenderer | null = null;
  let threeScene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let controls: OrbitControls | null = null;
  let deviceMeshes: Map<string, THREE.Group> = new Map();
  let labelTextures: THREE.Texture[] = [];
  let raycaster = new THREE.Raycaster();
  let mouse = new THREE.Vector2();
  let animId = 0;
  let ro: ResizeObserver | null = null;

  function deviceById(id: string): Device | undefined {
    return appState.devices.find((d) => d.id === id);
  }

  function statusColor(status: string): number {
    if (status === 'online') return 0x10b981;
    if (status === 'offline') return 0x6b7280;
    return 0xef4444;
  }

  function alarmColor(device: Device): number {
    const alarms = device.alarms ?? [];
    if (alarms.length === 0) return 0x223322;
    const maxLevel = Math.max(...alarms.map((a) => a.level));
    return maxLevel === 2 ? 0xef4444 : 0xf59e0b;
  }

  function formatMetricValue(v: number): string {
    if (!Number.isFinite(v)) return '—';
    const abs = Math.abs(v);
    if (abs >= 10000) return v.toExponential(2);
    return v.toFixed(1);
  }

  function deviceValueText(device: Device): string {
    const metric = device.metrics?.[0];
    if (!metric) return '—';
    return formatMetricValue(metric.value);
  }

  function parseHexColor(hexStr?: string, fallback = 0x475569): number {
    if (!hexStr) return fallback;
    if (hexStr.startsWith('url(')) {
      if (hexStr.includes('c19')) return 0xb7b626;
      if (hexStr.includes('c35')) return 0x7b8087;
      if (hexStr.includes('c3')) return 0xbf923a;
      if (hexStr.includes('filter')) return 0x3494a5;
      if (hexStr.includes('hydromet')) return 0x8a998a;
    }
    try {
      return new THREE.Color(hexStr).getHex();
    } catch {
      return fallback;
    }
  }

  function safeSize(): { w: number; h: number } {
    const w = Math.max(1, containerEl?.clientWidth ?? 1);
    const h = Math.max(1, containerEl?.clientHeight ?? 1);
    return { w, h };
  }

  function applyCameraSize() {
    if (!renderer || !camera) return;
    const { w, h } = safeSize();
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const canvas = renderer.domElement;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';
  }

  /** Canvas sprite so 3D pins show the live measurement (AGENTS.md). */
  function makeValueSprite(text: string, alarm = false): THREE.Sprite {
    const padX = 14;
    const font = '700 28px "PingFang SC", "Microsoft YaHei", sans-serif';
    const measure = document.createElement('canvas').getContext('2d');
    if (measure) measure.font = font;
    const textW = measure ? Math.ceil(measure.measureText(text).width) : text.length * 16;
    const w = Math.max(96, textW + padX * 2);
    const h = 48;

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      const fallback = new THREE.Sprite(new THREE.SpriteMaterial({ color: alarm ? 0x7f1d1d : 0x0f2812 }));
      fallback.scale.set(80, 28, 1);
      return fallback;
    }
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const r = 10;
    ctx.fillStyle = alarm ? 'rgba(127, 29, 29, 0.92)' : 'rgba(15, 40, 18, 0.88)';
    ctx.strokeStyle = alarm ? '#fca5a5' : '#c6ed56';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(r, 2);
    ctx.lineTo(w - r, 2);
    ctx.quadraticCurveTo(w - 2, 2, w - 2, r);
    ctx.lineTo(w - 2, h - r);
    ctx.quadraticCurveTo(w - 2, h - 2, w - r, h - 2);
    ctx.lineTo(r, h - 2);
    ctx.quadraticCurveTo(2, h - 2, 2, h - r);
    ctx.lineTo(2, r);
    ctx.quadraticCurveTo(2, 2, r, 2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = alarm ? '#fee2e2' : '#ecfccb';
    ctx.fillText(text, w / 2, h / 2 + 1);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    labelTextures.push(texture);
    const material = new THREE.SpriteMaterial({
      map: texture,
      depthTest: false,
      transparent: true,
    });
    const sprite = new THREE.Sprite(material);
    const scale = 0.45;
    sprite.scale.set(w * scale, h * scale, 1);
    return sprite;
  }

  function disposeGroupChildren(root: THREE.Object3D) {
    root.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat?.dispose();
    });
  }

  function buildScene() {
    if (!threeScene) return;

    // Rebuild into a fresh group so a throw cannot leave an empty black scene.
    let next: THREE.Group;
    try {
      next = buildSceneGroup();
    } catch (err) {
      console.error('Factory3D buildScene failed', err);
      return;
    }

    for (const texture of labelTextures) texture.dispose();
    labelTextures = [];

    const previous = threeScene.children.filter((c) => c.userData['sceneRoot']);
    for (const child of previous) {
      disposeGroupChildren(child);
      threeScene.remove(child);
    }

    next.userData['sceneRoot'] = true;
    threeScene.add(next);
    deviceMeshes.clear();
    // Groups created in buildSceneGroup carry userData.deviceId.
    for (const child of next.children) {
      const id = child.userData?.['deviceId'] as string | undefined;
      if (id && child instanceof THREE.Group) {
        deviceMeshes.set(id, child);
      }
    }
  }

  function buildSceneGroup(): THREE.Group {
    const root = new THREE.Group();

    // 环境光与平行阳光
    root.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(400, 700, 300);
    root.add(dirLight);
    const fillLight = new THREE.DirectionalLight(0xa5c49b, 0.4);
    fillLight.position.set(-300, 400, -200);
    root.add(fillLight);

    // 地面（与 2D 草地颜色 #77A56B 一致）
    const groundColor = parseHexColor(appState.scene.backgroundColor, 0x77a56b);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1600, 1200),
      new THREE.MeshStandardMaterial({
        color: groundColor,
        roughness: 0.85,
        metalness: 0.05,
        side: THREE.DoubleSide,
      }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(600, -1, 400);
    root.add(ground);

    const objects = appState.scene.objects ?? [];
    for (const obj of objects) {
      const height = 45;
      const mainColor = parseHexColor(obj.fill, 0x475569);

      if (obj.shape === 'polygon' && obj.points && obj.points.length >= 3) {
        const shape = new THREE.Shape();
        shape.moveTo(obj.points[0][0], -obj.points[0][1]);
        for (let i = 1; i < obj.points.length; i++) {
          shape.lineTo(obj.points[i][0], -obj.points[i][1]);
        }
        shape.closePath();

        const geo = new THREE.ExtrudeGeometry(shape, {
          depth: height,
          bevelEnabled: false,
        });
        geo.rotateX(-Math.PI / 2);
        geo.computeVertexNormals();

        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            color: mainColor,
            roughness: 0.35,
            metalness: 0.15,
          }),
        );
        const edges = new THREE.EdgesGeometry(geo);
        mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x222222 })));
        root.add(mesh);
      } else if (obj.x !== undefined && obj.y !== undefined && obj.width && obj.height) {
        const geo = new THREE.BoxGeometry(obj.width, height, obj.height);
        const mesh = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            color: mainColor,
            roughness: 0.35,
            metalness: 0.15,
          }),
        );
        mesh.position.set(obj.x + obj.width / 2, height / 2, obj.y + obj.height / 2);
        const edges = new THREE.EdgesGeometry(geo);
        mesh.add(new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x222222 })));
        root.add(mesh);
      }
    }

    const placements = appState.scene.devices ?? [];
    for (const placement of placements) {
      const device = deviceById(placement.deviceId);
      if (!device) continue;

      const group = new THREE.Group();
      group.userData = { deviceId: device.id };

      const baseGeo = new THREE.CylinderGeometry(12, 14, 24, 16);
      const baseMat = new THREE.MeshStandardMaterial({
        color: alarmColor(device),
        roughness: 0.3,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 12;
      group.add(base);

      const ringGeo = new THREE.TorusGeometry(16, 2.5, 8, 24);
      const ringColor = statusColor(device.status);
      const ringMat = new THREE.MeshStandardMaterial({
        color: ringColor,
        emissive: ringColor,
        emissiveIntensity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 26;
      group.add(ring);

      const hasAlarm = (device.alarms?.length ?? 0) > 0;
      const label = makeValueSprite(deviceValueText(device), hasAlarm);
      label.position.set(0, 52, 0);
      label.userData = { deviceId: device.id };
      group.add(label);

      group.position.set(placement.x, 0, placement.y);
      root.add(group);
    }

    return root;
  }

  function handleClick(e: MouseEvent) {
    if (!containerEl || !camera || !threeScene) return;
    const rect = containerEl.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);

    const meshes = Array.from(deviceMeshes.values());
    const intersects = raycaster.intersectObjects(meshes, true);
    if (intersects.length > 0) {
      let obj: THREE.Object3D | null = intersects[0].object;
      while (obj && !obj.userData['deviceId']) {
        obj = obj.parent;
      }
      if (obj?.userData['deviceId']) {
        selectDevice(obj.userData['deviceId']);
      }
    } else {
      selectDevice(null);
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') selectDevice(null);
  }

  function createRenderer(): THREE.WebGLRenderer {
    // antialias can fail context creation on software GL (remote Chromium).
    const attempts: WebGLContextAttributes[] = [
      { antialias: true, alpha: false, powerPreference: 'default' },
      { antialias: false, alpha: false, powerPreference: 'default' },
      { antialias: false, alpha: false, failIfMajorPerformanceCaveat: false },
    ];
    let lastErr: unknown = null;
    for (const attrs of attempts) {
      try {
        return new THREE.WebGLRenderer(attrs);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr ?? new Error('WebGL renderer unavailable');
  }

  onMount(() => {
    if (!containerEl) return;

    try {
      renderer = createRenderer();
    } catch (err) {
      console.error('WebGL init failed', err);
      initError = 'WebGL 不可用，无法显示 3D 视图';
      return;
    }

    renderer.setClearColor(0x1e2e1a);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    containerEl.appendChild(renderer.domElement);
    applyCameraSize();

    threeScene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(45, 1, 1, 5000);
    camera.position.set(600, 750, 850);
    camera.lookAt(600, 0, 400);
    applyCameraSize();

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(600, 0, 400);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    buildScene();

    function animate() {
      animId = requestAnimationFrame(animate);
      controls?.update();
      if (renderer && threeScene && camera) {
        renderer.render(threeScene, camera);
      }
    }
    animate();

    ro = new ResizeObserver(() => {
      applyCameraSize();
    });
    ro.observe(containerEl);
    // Some browsers report 0×0 on first paint of a flex child — retry once.
    requestAnimationFrame(() => applyCameraSize());

    return () => {
      ro?.disconnect();
      ro = null;
      cancelAnimationFrame(animId);
      for (const texture of labelTextures) texture.dispose();
      labelTextures = [];
      controls?.dispose();
      controls = null;
      if (threeScene) {
        for (const child of [...threeScene.children]) {
          disposeGroupChildren(child);
          threeScene.remove(child);
        }
      }
      renderer?.dispose();
      if (renderer?.domElement.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer = null;
      threeScene = null;
      camera = null;
      deviceMeshes.clear();
    };
  });

  $effect(() => {
    // Rebuild markers/labels when scene layout or live readings change.
    void appState.scene.objects?.length;
    void appState.scene.devices?.length;
    void appState.devices.length;
    for (const d of appState.devices) {
      void d.status;
      void d.alarms?.length;
      void d.metrics?.[0]?.value;
      void d.metrics?.[0]?.unit;
    }
    buildScene();
  });
</script>

<!-- svelte-ignore a11y_no_static_element_interactions a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions -->
<div
  bind:this={containerEl}
  class="three-container"
  onclick={handleClick}
  onkeydown={handleKeydown}
  role="application"
  tabindex="-1"
>
  {#if initError}
    <div class="three-error">{initError}</div>
  {/if}
</div>

<style>
  .three-container {
    flex: 1;
    min-width: 0;
    min-height: 0;
    position: relative;
    overflow: hidden;
    background: #1e2e1a;
    cursor: grab;
  }

  .three-container:active {
    cursor: grabbing;
  }

  .three-container :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }

  .three-error {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #f3ffd0;
    background: #1e2e1a;
    font-size: 15px;
    pointer-events: none;
  }
</style>

<script lang="ts">
  import { onMount } from 'svelte';
  import * as THREE from 'three';
  import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
  import { appState, selectDevice } from '../../state/app-state.svelte';
  import type { Device } from '../../types/device';

  let containerEl = $state<HTMLDivElement | null>(null);
  let renderer: THREE.WebGLRenderer | null = null;
  let threeScene: THREE.Scene | null = null;
  let camera: THREE.PerspectiveCamera | null = null;
  let controls: OrbitControls | null = null;
  let deviceMeshes: Map<string, THREE.Group> = new Map();
  let raycaster = new THREE.Raycaster();
  let mouse = new THREE.Vector2();

  function deviceById(id: string): Device | undefined {
    return appState.devices.find((d) => d.id === id);
  }

  function statusColor(status: string): number {
    if (status === 'online') return 0x10b981;
    if (status === 'offline') return 0x6b7280;
    return 0xef4444;
  }

  function alarmColor(device: Device): number {
    if (device.alarms.length === 0) return 0x1e2630;
    const maxLevel = Math.max(...device.alarms.map((a) => a.level));
    return maxLevel === 2 ? 0x7f1d1d : 0x78350f;
  }

  function objectColor(kind: string): number {
    if (kind === 'wall') return 0x3a4a5c;
    if (kind === 'machine') return 0x555555;
    if (kind === 'area') return 0x1a2028;
    return 0x333333;
  }

  function buildScene() {
    if (!threeScene) return;

    while (threeScene.children.length > 0) {
      threeScene.remove(threeScene.children[0]);
    }
    deviceMeshes.clear();

    const ambient = new THREE.AmbientLight(0xffffff, 0.6);
    threeScene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(200, 300, 200);
    threeScene.add(dirLight);

    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(1400, 1000),
      new THREE.MeshStandardMaterial({ color: 0x0f1419, side: THREE.DoubleSide }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(600, -1, 400);
    threeScene.add(ground);

    for (const obj of appState.scene.objects) {
      const height = obj.kind === 'wall' ? 30 : obj.kind === 'machine' ? 20 : 2;
      const geo = new THREE.BoxGeometry(obj.width, height, obj.height);
      const mat = new THREE.MeshStandardMaterial({
        color: objectColor(obj.kind),
        transparent: obj.kind === 'area',
        opacity: obj.kind === 'area' ? 0.3 : 1,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.set(
        obj.x + obj.width / 2,
        obj.kind === 'wall' ? 15 : obj.kind === 'machine' ? 10 : 1,
        obj.y + obj.height / 2,
      );
      threeScene.add(mesh);
    }

    for (const placement of appState.scene.devices) {
      const device = deviceById(placement.deviceId);
      if (!device) continue;

      const group = new THREE.Group();
      group.userData = { deviceId: device.id };

      const baseGeo = new THREE.CylinderGeometry(18, 18, 30, 16);
      const baseMat = new THREE.MeshStandardMaterial({ color: alarmColor(device) });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 20;
      group.add(base);

      const ringGeo = new THREE.TorusGeometry(20, 3, 8, 24);
      const ringMat = new THREE.MeshStandardMaterial({ color: statusColor(device.status) });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 36;
      group.add(ring);

      group.position.set(placement.x, 0, placement.y);
      threeScene.add(group);
      deviceMeshes.set(device.id, group);
    }
  }

  function handleClick(e: MouseEvent) {
    if (!containerEl || !camera || !threeScene) return;
    const rect = containerEl.getBoundingClientRect();
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

  onMount(() => {
    if (!containerEl) return;

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(containerEl.clientWidth, containerEl.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setClearColor(0x0f1419);
    containerEl.appendChild(renderer.domElement);

    threeScene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      50,
      containerEl.clientWidth / containerEl.clientHeight,
      1,
      5000,
    );
    camera.position.set(600, 600, 800);
    camera.lookAt(600, 0, 400);

    controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(600, 0, 400);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.update();

    buildScene();

    let animId: number;
    function animate() {
      animId = requestAnimationFrame(animate);
      controls?.update();
      if (renderer && threeScene && camera) {
        renderer.render(threeScene, camera);
      }
    }
    animate();

    const ro = new ResizeObserver(() => {
      if (!containerEl || !renderer || !camera) return;
      const w = containerEl.clientWidth;
      const h = containerEl.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(containerEl);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(animId);
      renderer?.dispose();
    };
  });

  $effect(() => {
    void appState.scene.objects.length;
    void appState.scene.devices.length;
    void appState.devices.length;
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
></div>

<style>
  .three-container {
    flex: 1;
    overflow: hidden;
    cursor: grab;
  }

  .three-container:active {
    cursor: grabbing;
  }
</style>

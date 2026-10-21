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
    if (device.alarms.length === 0) return 0x223322;
    const maxLevel = Math.max(...device.alarms.map((a) => a.level));
    return maxLevel === 2 ? 0xef4444 : 0xf59e0b;
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

  function buildScene() {
    if (!threeScene) return;

    while (threeScene.children.length > 0) {
      threeScene.remove(threeScene.children[0]);
    }
    deviceMeshes.clear();

    // 环境光与平行阳光
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    threeScene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight.position.set(400, 700, 300);
    threeScene.add(dirLight);

    // 补光，照亮侧面
    const fillLight = new THREE.DirectionalLight(0xa5c49b, 0.4);
    fillLight.position.set(-300, 400, -200);
    threeScene.add(fillLight);

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
    threeScene.add(ground);

    // 建筑物渲染
    for (const obj of appState.scene.objects) {
      const height = 45;
      const mainColor = parseHexColor(obj.fill, 0x475569);

      if (obj.shape === 'polygon' && obj.points && obj.points.length >= 3) {
        // 多边形挤压（C35 拐角厂房）
        // 关键几何变换：2D 的点为 (x, y)，在数学笛卡尔坐标中取 (x, -y)
        const shape = new THREE.Shape();
        shape.moveTo(obj.points[0][0], -obj.points[0][1]);
        for (let i = 1; i < obj.points.length; i++) {
          shape.lineTo(obj.points[i][0], -obj.points[i][1]);
        }
        shape.closePath();

        const extrudeSettings: THREE.ExtrudeGeometryOptions = {
          depth: height,
          bevelEnabled: false, // 硬朗工业边缘，不产生畸变
        };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);

        // 刚体旋转 -Math.PI / 2：使 -y 旋转到 +Z 轴（深度与 2D 坐标 y 绝对一致），厚度 depth 沿 +Y 轴直立向上！
        geo.rotateX(-Math.PI / 2);
        geo.computeVertexNormals();

        const mat = new THREE.MeshStandardMaterial({
          color: mainColor,
          roughness: 0.35,
          metalness: 0.15,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(0, 0, 0);

        // 轮廓线条增强立体感
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 1 }));
        mesh.add(line);

        threeScene.add(mesh);
      } else if (obj.x !== undefined && obj.y !== undefined && obj.width && obj.height) {
        // 矩形建筑（C19, C3, 集中过滤厂房, 水冶厂）
        const geo = new THREE.BoxGeometry(obj.width, height, obj.height);
        const mat = new THREE.MeshStandardMaterial({
          color: mainColor,
          roughness: 0.35,
          metalness: 0.15,
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(
          obj.x + obj.width / 2,
          height / 2,
          obj.y + obj.height / 2,
        );

        // 轮廓线条增强立体感
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x222222, linewidth: 1 }));
        mesh.add(line);

        threeScene.add(mesh);
      }
    }

    // 设备监测仪点位渲染
    for (const placement of appState.scene.devices) {
      const device = deviceById(placement.deviceId);
      if (!device) continue;

      const group = new THREE.Group();
      group.userData = { deviceId: device.id };

      // 监测仪柱体底座
      const baseGeo = new THREE.CylinderGeometry(12, 14, 24, 16);
      const baseMat = new THREE.MeshStandardMaterial({
        color: alarmColor(device),
        roughness: 0.3,
      });
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.position.y = 12;
      group.add(base);

      // 状态光环
      const ringGeo = new THREE.TorusGeometry(16, 2.5, 8, 24);
      const ringMat = new THREE.MeshStandardMaterial({
        color: statusColor(device.status),
        emissive: statusColor(device.status),
        emissiveIntensity: 0.7,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.position.y = 26;
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
    renderer.setClearColor(0x1e2e1a);
    containerEl.appendChild(renderer.domElement);

    threeScene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(
      45,
      containerEl.clientWidth / containerEl.clientHeight,
      1,
      5000,
    );
    // 摄像机视角：略微俯视居中厂区，便于总览全厂建筑与设备
    camera.position.set(600, 750, 850);
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

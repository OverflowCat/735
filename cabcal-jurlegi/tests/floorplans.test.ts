import test from 'node:test';
import assert from 'node:assert/strict';
import {
  gammaInventory,
  installedDevices,
  mergeInstalledDevices,
  radonPairs,
} from '../src/lib/data/floorplans/inventory';
import {
  mapDefinitions,
  mapById,
  siteBuildingDisplays,
  siteInlinePlacements,
} from '../src/lib/data/floorplans/maps';
import {
  MAP_STORAGE_KEY,
  readMapLayouts,
  restoreMapScene,
} from '../src/lib/services/map-layout';
import configuredDevices from '../../devices.json';

test('overview uses one water-plant list and direct pins for every small single-floor installation', () => {
  const floating = siteBuildingDisplays.filter((b) => b.floating);
  assert.deepEqual(
    floating.map((b) => b.id),
    ['hydromet'],
  );
  assert.equal(floating[0].ids.size, 27);
  assert.equal(siteInlinePlacements.length, 13);
  const inline = new Set(siteInlinePlacements.map((p) => p.deviceId));
  assert.equal(inline.size, 13);
  assert.ok(!inline.has('gamma_12'));
  assert.ok(inline.has('radon-38'));
  const all = new Set([...inline, ...floating.flatMap((b) => [...b.ids])]);
  assert.equal(all.size, installedDevices.length);
});

test('each installation has one indoor map, with legacy IDs bound by IP rather than asset suffix', () => {
  assert.equal(gammaInventory.length, 30);
  assert.equal(installedDevices.length, 40);
  const indoor = mapDefinitions.filter((m) => m.id !== 'site');
  const ids = indoor.flatMap((m) => m.scene.devices.map((p) => p.deviceId));
  assert.equal(indoor.length, 8);
  assert.equal(ids.length, 40);
  assert.equal(new Set(ids).size, 40);
  assert.ok(
    mapById('hydromet-f1').scene.devices.some((p) => p.deviceId === 'gamma_12'),
  );
  assert.equal(mapById('hydromet-f4').scene.devices[0].deviceId, 'gamma_15');
  for (const device of configuredDevices) {
    if (device.radonNode !== undefined)
      assert.equal(radonPairs.get(device.id), device.radonNode);
  }
});

test('a partial or empty API response leaves missing installations without fabricated values', () => {
  const [installed] = installedDevices;
  const reported = {
    ...installed,
    status: 'online' as const,
    unreported: undefined,
    lastUpdate: new Date().toISOString(),
  };
  const merged = mergeInstalledDevices([reported]);
  assert.equal(merged.length, 40);
  assert.equal(merged[0].unreported, false);
  assert.ok(
    merged
      .slice(1)
      .every(
        (d) => d.unreported && d.metrics.length === 0 && d.lastUpdate === '',
      ),
  );
  assert.ok(mergeInstalledDevices([]).every((d) => d.unreported));
});

test('local layouts isolate floors, retain removals, and preserve paired anchor metadata', () => {
  const first = mapById('hydromet-f1');
  const second = mapById('hydromet-f2');
  const p = { ...first.scene.devices[0], x: 42, y: 53 };
  const stored = {
    [first.id]: { version: first.version, devices: [p] },
    [second.id]: { version: second.version, devices: [] },
  };
  const read = readMapLayouts({
    getItem: (key) => (key === MAP_STORAGE_KEY ? JSON.stringify(stored) : null),
  });
  const restored = restoreMapScene(first, read[first.id]);
  assert.deepEqual(restored.devices, [p]);
  assert.equal(restoreMapScene(second, read[second.id]).devices.length, 0);
  assert.notEqual(restored, first.scene);
  assert.equal(first.scene.devices.length, 15);
});

test('stale, corrupt, duplicate and cross-floor placements cannot overwrite defaults', () => {
  const map = mapById('hydromet-f4');
  const pin = map.scene.devices[0];
  const invalid = [
    { version: map.version - 1, devices: [] },
    { version: map.version, devices: [{ ...pin, x: null }] },
    { version: map.version, devices: [pin, pin] },
    { version: map.version, devices: [{ ...pin, deviceId: 'gamma_01' }] },
    { width: 1200, height: 800, devices: [] },
  ];
  for (const saved of invalid)
    assert.deepEqual(restoreMapScene(map, saved), map.scene);
  assert.deepEqual(readMapLayouts({ getItem: () => '{broken' }), {});
  assert.deepEqual(readMapLayouts({ getItem: () => '[]' }), {});
});

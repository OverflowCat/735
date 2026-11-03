// Optional UI regression: run against a local dev/preview server with Playwright installed.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: [
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--use-gl=angle',
    '--use-angle=swiftshader',
    '--enable-unsafe-swiftshader',
  ],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
let oldSceneCalls = 0;
const device = {
  id: 'gamma_12',
  name: 'γ剂量率监测仪',
  type: 'gamma',
  station: 'STATION-01',
  status: 'online',
  lastUpdate: new Date().toISOString(),
  metrics: [
    {
      metric: '0102060301',
      name: 'γ剂量率实时值',
      timestamp: Date.now(),
      value: 328.5,
      unit: 'nSv/h',
      alarm: false,
    },
  ],
  alarms: [],
};
await page.route('**/api/**', (route) => {
  if (route.request().url().includes('/scene')) oldSceneCalls++;
  const isInventory = route.request().url().endsWith('/devices');
  return route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(isInventory ? [device] : []),
  });
});
const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:5173/';
async function choose(name) {
  await page
    .locator('.map-navigation')
    .getByRole('link', { name, exact: false })
    .click();
  await page.locator('.factory-svg image').waitFor();
  await page.waitForFunction(
    () => !!document.querySelector('.factory-svg image')?.getAttribute('href'),
  );
}
async function floor(n) {
  await page.getByRole('link', { name: `${n} 楼`, exact: true }).click();
  await page.waitForFunction(
    (n) =>
      document
        .querySelector('.map-page')
        ?.getAttribute('aria-label')
        ?.includes(['', '一楼', '二楼', '三楼', '四楼'][n]),
    n,
  );
}
async function position(id) {
  return page.locator(`[data-device="${id}"]`).getAttribute('transform');
}
async function screenPoint(x, y) {
  return page.locator('.factory-svg').evaluate(
    (svg, p) => {
      const result = new DOMPoint(p.x, p.y).matrixTransform(svg.getScreenCTM());
      return { x: result.x, y: result.y };
    },
    { x, y },
  );
}
async function drag(from, to, button = 'left') {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down({ button });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up({ button });
}
try {
  await page.goto(url);
  await page.locator('[data-map="hydromet-f1"]').click();
  await page.locator('.factory-svg image').waitFor();
  assert.equal(await page.locator('[data-device]').count(), 15);
  assert.match(
    await page.locator('[data-device="gamma_12"]').textContent(),
    /328.5 nSv\/h/,
  );
  assert.match(
    await page.locator('[data-device="2026012905"]').count().then(String),
    /0/,
  );
  assert.match(
    (
      await page
        .locator('.map-navigation [data-area][aria-current="page"]')
        .innerText()
    ).replace(/\s/g, ''),
    /水冶厂27点位/,
  );
  for (const [n, count] of [
    [2, 7],
    [3, 4],
    [4, 1],
    [1, 15],
  ]) {
    await floor(n);
    assert.equal(await page.locator('[data-device]').count(), count);
  }
  for (const [name, count] of [
    ['C19 采区', 3],
    ['C35 采区', 4],
    ['C3 采区', 3],
    ['集中过滤厂房', 3],
  ]) {
    await choose(name);
    assert.equal(await page.locator('[data-device]').count(), count);
    const src = await page.locator('.factory-svg image').getAttribute('href');
    const image = await page.request.get(new URL(src, url).href);
    assert.equal(image.status(), 200);
    assert.match(image.headers()['content-type'], /image\/png/);
  }
  await choose('水冶厂');
  const pin = page.locator('[data-device="gamma_12"]');
  const original = await position('gamma_12');
  await pin.focus();
  await page.keyboard.press('Enter');
  await page.locator('.drawer').waitFor();
  assert.match(await page.locator('.drawer').innerText(), /2026012916/);
  assert.equal(
    await page
      .locator('.drawer .info-row')
      .first()
      .locator('.info-value')
      .innerText(),
    'gamma_12',
  );
  await page.locator('.close-btn').click();
  const box = await pin.locator('rect').boundingBox();
  await drag(
    { x: box.x + 40, y: box.y + 20 },
    { x: box.x + 90, y: box.y + 50 },
  );
  assert.equal(
    await position('gamma_12'),
    original,
    'monitoring drag must not move a pin',
  );
  await page.getByRole('button', { name: '编辑模式', exact: true }).click();
  assert.equal(
    await page.getByRole('tab', { name: '3D', exact: true }).count(),
    0,
    'view switch hidden while editing',
  );
  await pin.locator('rect').click();
  await page.keyboard.press('ArrowRight');
  const moved = await position('gamma_12');
  assert.notEqual(moved, original);
  await page.keyboard.press('Control+z');
  assert.equal(await position('gamma_12'), original);
  await page.keyboard.press('Control+Shift+z');
  assert.equal(await position('gamma_12'), moved);
  await page.getByRole('button', { name: '保存布局', exact: true }).click();
  await floor(2);
  await page.keyboard.press('Control+z');
  assert.equal(await page.locator('[data-device]').count(), 7);
  assert.equal(
    await page.getByRole('button', { name: '编辑模式', exact: true }).count(),
    1,
  );
  await floor(1);
  assert.equal(await position('gamma_12'), moved);
  await page.reload();
  await pin.waitFor();
  assert.equal(await position('gamma_12'), moved);
  await choose('C3 采区');
  await page.getByRole('button', { name: '编辑模式', exact: true }).click();
  assert.equal(
    await page.getByRole('tab', { name: '3D', exact: true }).count(),
    0,
    'view switch hidden while editing',
  );
  await page.locator('[data-device="2026012905"] rect').click();
  const paired = await position('radon-37');
  await page.keyboard.press('ArrowDown');
  assert.notEqual(await position('radon-37'), paired);
  assert.equal(await position('radon-37'), await position('2026012905'));
  await page.keyboard.press('Delete');
  assert.equal(await page.locator('[data-device]').count(), 2);
  // Test placement under non-square letterboxing, zoom and pan.
  await page.mouse.move(800, 500);
  await page.mouse.wheel(0, -300);
  await page.waitForTimeout(150);
  await drag({ x: 900, y: 300 }, { x: 940, y: 320 }, 'middle');
  await page.locator('.device-chip').click();
  const target = await screenPoint(400, 200);
  await page.mouse.click(target.x, target.y);
  assert.equal(await position('2026012905'), 'translate(400, 200)');
  assert.equal(await position('radon-37'), 'translate(400, 200)');
  await page.getByRole('button', { name: '重置点位', exact: true }).click();
  assert.equal(await position('radon-37'), paired);
  await page.getByRole('button', { name: '退出编辑', exact: true }).click();
  await choose('水冶厂');
  await floor(1);
  // Readable captions must not overlap at their initial positions.
  await page.getByRole('button', { name: '编辑模式', exact: true }).click();
  assert.equal(
    await page.getByRole('tab', { name: '3D', exact: true }).count(),
    0,
    'view switch hidden while editing',
  );
  await page.getByRole('button', { name: '重置点位', exact: true }).click();
  await page.getByRole('button', { name: '退出编辑', exact: true }).click();
  const boxes = await page.locator('.floor-label rect').evaluateAll((rects) =>
    rects.map((r) => {
      const b = r.getBoundingClientRect();
      return { x: b.x, y: b.y, right: b.right, bottom: b.bottom };
    }),
  );
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i],
        b = boxes[j];
      assert.ok(
        a.right <= b.x || b.right <= a.x || a.bottom <= b.y || b.bottom <= a.y,
        `labels ${i}/${j} overlap`,
      );
    }
  if (process.env.MAP_SCREENSHOT)
    await page.screenshot({ path: process.env.MAP_SCREENSHOT });
  await floor(4);
  await page.getByRole('tab', { name: '3D', exact: true }).click();
  await page.locator('.three-container canvas').waitFor();
  await page.waitForTimeout(800);
  assert.equal(await page.locator('.three-error').count(), 0);
  await page.getByRole('tab', { name: '2D', exact: true }).click();
  assert.equal(await page.locator('[data-device]').count(), 1);
  await page.getByRole('link', { name: '监测总览', exact: true }).click();
  assert.match(await page.locator('.summary-row').innerText(), /39\s*未上报/);
  await page.locator('.search-input').fill('gamma_12');
  assert.equal(await page.locator('tbody tr').count(), 1);
  assert.match(await page.locator('tbody tr').innerText(), /2026012916/);
  assert.equal(oldSceneCalls, 0);
  assert.deepEqual(errors, []);
  // A legacy scene cache cannot replace packaged floorplan geometry.
  const offline = await browser.newContext({
    viewport: { width: 1000, height: 760 },
  });
  await offline.addInitScript(() =>
    localStorage.setItem(
      'cabcal-factory-scene-v1',
      JSON.stringify({
        width: 99999,
        height: 99999,
        objects: [{ id: 'obsolete' }],
        devices: [],
      }),
    ),
  );
  const demo = await offline.newPage();
  await demo.route('**/api/**', (route) =>
    route.fulfill({ status: 503, body: '{}' }),
  );
  await demo.goto(url);
  await demo.waitForFunction(() =>
    document
      .querySelector('.data-indicator')
      ?.textContent?.includes('演示数据'),
  );
  await demo
    .locator('.map-navigation')
    .getByRole('link', { name: 'C3 采区', exact: false })
    .click();
  await demo.waitForFunction(
    () => document.querySelectorAll('[data-device]').length === 3,
  );
  assert.match(
    await demo.locator('[data-device="radon-37"]').textContent(),
    /未上报/,
  );
  assert.equal(
    await demo.locator('.factory-svg').getAttribute('viewBox'),
    '0 0 1042 470',
  );
  await offline.close();
  console.log(
    'UI regression passed: 8 maps, device drawer, floor isolation, persistence, undo/redo, paired placement, pan/zoom coordinates, PNGs, 3D and missing API records.',
  );
} finally {
  await browser.close();
}

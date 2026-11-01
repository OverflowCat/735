import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
  ...(process.env.CHROMIUM_PATH
    ? { executablePath: process.env.CHROMIUM_PATH }
    : {}),
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const alarm = {
  level: 2,
  reason: '测试报警',
  threshold: { low: 0, up: 500 },
  action: null,
};
const devices = [
  { id: 'gamma_12', name: '水冶 γ16', type: 'gamma', value: 628.5, alarm },
  {
    id: '2026012904',
    name: 'C19 γ04',
    type: 'gamma',
    value: 278.3,
    alarm: false,
  },
  { id: 'radon-38', name: 'C35 氡38', type: 'radon', value: 65, alarm: false },
].map((d) => ({
  id: d.id,
  code: d.id,
  name: d.name,
  type: d.type,
  station: 'STATION-01',
  status: 'online',
  lastUpdate: new Date().toISOString(),
  metrics: [
    {
      metric: d.type === 'gamma' ? '0102060301' : '0102060302',
      name: d.name,
      timestamp: String(Date.now()),
      value: d.value,
      unit: d.type === 'gamma' ? 'nGy/h' : 'Bq/m³',
      alarm: d.alarm,
    },
  ],
  alarms: d.alarm ? [d.alarm] : [],
}));
await page.route('**/api/**', (route) =>
  route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(
      route.request().url().endsWith('/devices') ? devices : [],
    ),
  }),
);
const url = process.env.MAP_TEST_URL || 'http://127.0.0.1:5173/';
const panel = page.locator('[data-building-panel="hydromet"]');
const list = panel.locator('.device-scroll');
async function rect() {
  return panel.boundingBox();
}
async function drag(from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
}
try {
  await page.goto(url);
  await panel.waitFor();
  await page.waitForFunction(() =>
    document
      .querySelector('[data-device="2026012904"]')
      ?.textContent?.includes('278.3'),
  );
  assert.equal(await page.locator('[data-building-panel]').count(), 1);
  assert.equal(await page.locator('.factory-svg [data-device]').count(), 13);
  assert.equal(await panel.locator('[data-panel-device]').count(), 27);
  assert.match(
    await panel.locator('[data-panel-device="gamma_12"]').textContent(),
    /628.5/,
  );
  assert.match(
    await panel.locator('[data-panel-device="gamma_12"]').textContent(),
    /二级报警/,
  );
  assert.match(
    await page.locator('[data-device="radon-38"]').textContent(),
    /65.0 Bq\/m³/,
  );
  const svg = page.locator('.factory-svg');
  const view = await svg.getAttribute('viewBox');
  const scroll = await list.boundingBox();
  await page.mouse.move(
    scroll.x + scroll.width / 2,
    scroll.y + scroll.height / 2,
  );
  await page.mouse.wheel(0, 400);
  await page.waitForFunction(
    () => document.querySelector('.device-scroll').scrollTop > 0,
  );
  assert.equal(
    await svg.getAttribute('viewBox'),
    view,
    'list scrolling must not zoom the map',
  );
  await list.evaluate((el) => (el.scrollTop = el.scrollHeight));
  await page.mouse.wheel(0, 200);
  await page.waitForTimeout(100);
  assert.equal(
    await svg.getAttribute('viewBox'),
    view,
    'scroll at list boundary must not zoom',
  );
  const before = await rect();
  const header = await panel.locator('.drag-handle').boundingBox();
  await drag(
    { x: header.x + 80, y: header.y + 18 },
    { x: header.x - 80, y: header.y - 60 },
  );
  const after = await rect();
  assert.ok(
    Math.abs(after.x - before.x) > 50 && Math.abs(after.y - before.y) > 30,
  );
  assert.equal(
    await svg.getAttribute('viewBox'),
    view,
    'panel dragging must not pan the map',
  );
  await page.reload();
  await panel.waitFor();
  const restored = await rect();
  assert.ok(
    Math.abs(restored.x - after.x) < 2 && Math.abs(restored.y - after.y) < 2,
  );
  await panel
    .getByRole('button', { name: '恢复水冶厂设备列表位置', exact: true })
    .click();
  const reset = await rect();
  assert.ok(
    Math.abs(reset.x - before.x) < 2 && Math.abs(reset.y - before.y) < 2,
  );
  await panel.locator('[data-panel-device="gamma_12"]').click();
  await page.locator('.drawer').waitFor();
  assert.match(await page.locator('.drawer').innerText(), /2026012916/);
  assert.equal(
    await page.locator('.map-heading strong').innerText(),
    '厂区总览',
  );
  await page.locator('.close-btn').click();
  await page.locator('[data-device="2026012904"]').press('Enter');
  await page.locator('.drawer').waitFor();
  assert.match(await page.locator('.drawer').innerText(), /2026012904/);
  await page.locator('.close-btn').click();
  await page.locator('[data-map="c19"]').click({ position: { x: 45, y: 25 } });
  assert.equal(await page.locator('[data-building-panel]').count(), 0);
  await page
    .locator('.map-navigation')
    .getByRole('button', { name: '厂区总览', exact: true })
    .click();
  await panel.waitFor();
  if (process.env.MAP_SCREENSHOT)
    await page.screenshot({ path: process.env.MAP_SCREENSHOT });
  await page.setViewportSize({ width: 900, height: 680 });
  await page.waitForTimeout(200);
  const small = await rect();
  const canvas = await page.locator('.map-container').boundingBox();
  assert.ok(
    small.x >= canvas.x &&
      small.y >= canvas.y &&
      small.x + small.width <= canvas.x + canvas.width + 1 &&
      small.y + small.height <= canvas.y + canvas.height + 1,
  );
  await panel.locator('.drag-handle').press('ArrowLeft');
  assert.deepEqual(errors, []);
  console.log(
    'Overview UI passed: 13 roof pins, 27 list devices, units/alarm text, wheel isolation, dragging, persistence/reset, drawer clicks, map navigation and resize bounds.',
  );
} finally {
  await browser.close();
}

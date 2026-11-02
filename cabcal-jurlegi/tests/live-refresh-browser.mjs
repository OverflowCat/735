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
let requests = 0;
let mode = 'success';
let releaseRequest;
function devices() {
  return ['2026012904', 'gamma_12'].map((id, i) => ({
    id,
    name: 'γ剂量率监测仪',
    type: 'gamma',
    station: 'STATION-01',
    status: 'online',
    lastUpdate: new Date().toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: 'γ剂量率',
        timestamp: String(Date.now()),
        value: requests * 100 + i,
        unit: 'nGy/h',
        alarm: false,
      },
    ],
    alarms: [],
  }));
}
await page.route('**/api/**', async (route) => {
  if (!route.request().url().endsWith('/devices')) {
    await route.fulfill({ json: [] });
    return;
  }
  requests++;
  if (mode === 'hold')
    await new Promise((resolve) => {
      releaseRequest = resolve;
    });
  if (mode === 'failure') await route.fulfill({ status: 503, json: {} });
  else if (mode === 'invalid') await route.fulfill({ json: {} });
  else await route.fulfill({ json: devices() }).catch(() => {});
});
async function reading(value) {
  await page.waitForFunction(
    (value) =>
      document
        .querySelector('[data-device="2026012904"]')
        ?.textContent?.includes(`${value}.0`),
    value,
  );
  assert.match(
    await page.locator('[data-panel-device="gamma_12"]').innerText(),
    new RegExp(`${value + 1}\\.0`),
  );
}
async function tick() {
  await page.clock.fastForward(5000);
}
async function visible(hidden) {
  await page.evaluate((hidden) => {
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: hidden,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  }, hidden);
}
try {
  await page.clock.install();
  await page.goto(process.env.MAP_TEST_URL || 'http://127.0.0.1:5175/');
  await reading(100);
  await page.locator('[data-panel-device="gamma_12"]').click();
  await page.locator('.drawer').waitFor();
  await tick();
  await reading(200);
  assert.match(
    await page.locator('.drawer .metric-value').innerText(),
    /201\.0/,
  );
  assert.match(
    await page.locator('.data-indicator').getAttribute('title'),
    /每 5 秒刷新.*上次同步/,
  );
  mode = 'failure';
  await tick();
  await page.waitForFunction(() =>
    document
      .querySelector('.data-indicator')
      ?.textContent?.includes('刷新失败'),
  );
  await reading(200);
  mode = 'invalid';
  await tick();
  await reading(200);
  mode = 'success';
  await tick();
  await reading(500);
  assert.match(await page.locator('.data-indicator').innerText(), /现场数据/);
  await visible(true);
  const paused = requests;
  await page.clock.fastForward(15000);
  assert.equal(requests, paused, 'hidden tabs must pause periodic requests');
  await visible(false);
  await reading(600);
  mode = 'hold';
  await tick();
  await page.waitForFunction(() => true);
  assert.equal(requests, 7);
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await page.clock.fastForward(5000);
  assert.equal(
    requests,
    7,
    'slow requests must not overlap polling or focus refresh',
  );
  await visible(true);
  await page.clock.fastForward(5000);
  await page.waitForFunction(() =>
    document
      .querySelector('.data-indicator')
      ?.textContent?.includes('刷新失败'),
  );
  mode = 'success';
  releaseRequest();
  await visible(false);
  await reading(800);
  assert.match(await page.locator('.data-indicator').innerText(), /现场数据/);
  assert.deepEqual(errors, []);
  console.log(
    'Live refresh passed: automatic roof/list/drawer readings, failure retention, malformed response, recovery, background pause/resume, request deduplication and timeout recovery.',
  );
} finally {
  await browser.close();
}

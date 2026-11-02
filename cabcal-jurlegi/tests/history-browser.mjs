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
let inventoryCalls = 0;
const requests = [];
let mode = 'hold-older';
let held;
const inventory = () =>
  ['2026012904', 'gamma_12'].map((id) => ({
    id,
    name: 'γ剂量率监测仪',
    type: 'gamma',
    station: 'STATION-01',
    status: 'online',
    lastUpdate: new Date().toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: '剂量率',
        timestamp: String(Date.now()),
        value: inventoryCalls,
        unit: 'nGy/h',
        alarm: false,
      },
    ],
    alarms: [],
  }));
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/devices')) {
    inventoryCalls++;
    await route.fulfill({ json: inventory() });
  } else if (url.pathname.endsWith('/history')) {
    const start = Number(url.searchParams.get('start_ms'));
    const end = Number(url.searchParams.get('end_ms'));
    requests.push({ start, end, path: url.pathname });
    assert.equal(url.searchParams.has('range'), false);
    const points = [
      { timestamp: start, value: 40 },
      { timestamp: end, value: 45 },
    ];
    if (mode === 'failure' && end - start > 900000) {
      await route.fulfill({ status: 503, body: '{}' });
    } else {
      if (mode === 'hold-older' && end - start > 900000)
        await new Promise((resolve) => (held = resolve));
      await route.fulfill({ json: points }).catch(() => {});
    }
  } else await route.fulfill({ json: [] });
});
async function choose(name) {
  await page
    .locator('.drawer')
    .getByRole('button', { name, exact: true })
    .click();
}
const status = page.locator('.history-status');
try {
  await page.goto(process.env.MAP_TEST_URL || 'http://127.0.0.1:5175/');
  await page.locator('[data-panel-device="gamma_12"]').click();
  await page.waitForFunction(() =>
    document.querySelector('.history-status')?.textContent?.includes('1/2'),
  );
  await page.locator('.chart-container canvas').waitFor();
  const canvas = await page.locator('.chart-container canvas').elementHandle();
  assert.equal(requests.length, 2);
  assert.equal(requests[1].end + 1, requests[0].start);
  const calls = inventoryCalls;
  await page.waitForFunction(
    (calls) =>
      document
        .querySelector('.drawer .metric-value')
        ?.textContent?.includes(`${calls + 1}.0`),
    calls,
    { timeout: 12000 },
  );
  assert.ok(inventoryCalls > calls);
  assert.equal(
    requests.length,
    2,
    'live refresh must not restart pending history',
  );
  assert.ok(
    await canvas.evaluate((el) => el.isConnected),
    'partial chart must stay mounted during live refresh',
  );
  mode = 'success';
  held();
  await page.waitForFunction(() =>
    document
      .querySelector('.history-status')
      ?.textContent?.includes('完整时段'),
  );
  assert.match(await status.innerText(), /4 条/);
  await choose('7天');
  await page.waitForFunction(() =>
    document
      .querySelector('.history-status')
      ?.textContent?.includes('完整时段'),
  );
  const seven = requests.slice(2);
  assert.ok(seven.length > 2);
  assert.equal(seven.at(-1).start, seven[0].end - 7 * 86400000);
  for (let i = 1; i < seven.length; i++)
    assert.equal(seven[i].end + 1, seven[i - 1].start);
  await choose('自定义');
  await page
    .locator('input[type="datetime-local"]')
    .nth(0)
    .fill('2026-10-29T08:00');
  await page
    .locator('input[type="datetime-local"]')
    .nth(1)
    .fill('2026-10-29T09:00');
  const firstCustom = requests.length;
  await choose('查询');
  await page.waitForFunction(() =>
    document
      .querySelector('.history-status')
      ?.textContent?.includes('完整时段'),
  );
  assert.equal(requests[firstCustom].end - requests.at(-1).start, 3600000);
  mode = 'failure';
  await choose('24小时');
  await page.waitForFunction(() =>
    document
      .querySelector('.history-status')
      ?.textContent?.includes('后续加载失败'),
  );
  assert.match(await status.innerText(), /已保留 2 条/);
  assert.equal(await page.locator('.chart-container canvas').count(), 1);
  mode = 'success';
  await choose('重试');
  await page.waitForFunction(() =>
    document
      .querySelector('.history-status')
      ?.textContent?.includes('完整时段'),
  );
  mode = 'hold-older';
  await choose('1小时');
  await page.waitForFunction(() =>
    document.querySelector('.history-status')?.textContent?.includes('1/2'),
  );
  const oldRequest = held;
  mode = 'success';
  const before = requests.length;
  await choose('15分钟');
  await page.waitForFunction(() =>
    document
      .querySelector('.history-status')
      ?.textContent?.includes('完整时段'),
  );
  assert.equal(requests.length, before + 1);
  assert.match(await status.innerText(), /2 条/);
  oldRequest();
  await page.waitForTimeout(100);
  assert.match(await status.innerText(), /2 条/);
  mode = 'hold-older';
  await choose('7天');
  await page.waitForFunction(() =>
    document.querySelector('.history-status')?.textContent?.includes('1/'),
  );
  const oldCloseRequest = held;
  const closeRequests = requests.length;
  await page.locator('.close-btn').click();
  mode = 'success';
  oldCloseRequest();
  await page.waitForTimeout(100);
  assert.equal(
    requests.length,
    closeRequests,
    'closing stops remaining history batches',
  );
  assert.deepEqual(errors, []);
  console.log(
    'History UI passed: immediate partial chart, ordered batches for presets/custom, no restart on live refresh, partial error/retry, cancellation on range change and close.',
  );
} finally {
  await browser.close();
}

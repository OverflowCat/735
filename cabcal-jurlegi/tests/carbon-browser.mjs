// Verify Carbon interactions and responsive layouts against a local server.
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
page.on('pageerror', (error) => errors.push(error.message));
let historyFails = false;
const device = (id, type = 'gamma') => ({
  id,
  type,
  name: type === 'gamma' ? 'γ剂量率监测仪' : '空气测氡仪',
  station: 'STATION-01',
  status: 'online',
  lastUpdate: new Date().toISOString(),
  metrics: [
    {
      metric: type === 'gamma' ? '0102060301' : '0102060302',
      name: '测量值',
      timestamp: String(Date.now()),
      value: 328.5,
      unit: type === 'gamma' ? 'nGy/h' : 'Bq/m³',
      alarm: false,
    },
  ],
  alarms: [],
});
await page.route('**/api/**', (route) => {
  const url = new URL(route.request().url());
  if (url.pathname.endsWith('/devices'))
    return route.fulfill({
      json: [device('gamma_12'), device('radon-35', 'radon')],
    });
  if (historyFails) return route.fulfill({ status: 503, body: '{}' });
  return route.fulfill({
    json: [
      { timestamp: Date.now() - 60000, value: 300 },
      { timestamp: Date.now(), value: 328.5 },
    ],
  });
});
try {
  await page.goto(process.env.MAP_TEST_URL || 'http://127.0.0.1:5176/');
  await page.getByRole('menuitem', { name: '监测总览', exact: true }).click();
  await page.getByRole('searchbox', { name: '搜索设备' }).fill('gamma_12');
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page
    .locator('tbody')
    .getByRole('button', { name: '2026012916', exact: true })
    .click();
  await page.locator('.drawer').waitFor();
  await page.keyboard.press('Escape');
  await page.locator('.drawer').waitFor({ state: 'detached' });
  const compare = page.getByRole('group', { name: '选择对比设备，最多6台' });
  const boxes = compare.getByRole('checkbox');
  for (let i = 0; i < 6; i++) await compare.locator('label').nth(i).click();
  await page.locator('.chart-area canvas').waitFor();
  assert.equal(await compare.locator('input:checked').count(), 6);
  assert.equal(await boxes.nth(6).isDisabled(), true);
  await page.getByLabel('监测指标', { exact: true }).selectOption('0102060302');
  assert.equal(await compare.locator('input:checked').count(), 0);
  await compare.locator('label').first().click();
  await page.locator('.chart-area canvas').waitFor();
  historyFails = true;
  await page
    .locator('.comparison-main')
    .getByRole('button', { name: '24小时', exact: true })
    .click();
  await page
    .locator('.chart-area')
    .getByText('历史数据暂不可用', { exact: true })
    .waitFor();
  for (const width of [1440, 1024, 768, 600, 390]) {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['工厂地图', '监测总览']) {
      await page.getByRole('menuitem', { name: route, exact: true }).click();
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth),
        width,
      );
      const headerRight = await page
        .locator('.bx--header__global')
        .evaluate((el) => el.getBoundingClientRect().right);
      assert.ok(
        headerRight <= width + 1,
        `header controls overflow at ${width}px`,
      );
    }
  }
  assert.deepEqual(errors, []);
  console.log(
    'Carbon UI passed: navigation, overview drawer, search, comparison limit/type reset/error, and responsive layouts at 390–1440px.',
  );
} finally {
  await browser.close();
}

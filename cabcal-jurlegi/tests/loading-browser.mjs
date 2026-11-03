// Verify real waits, request failures, and refreshes with Carbon Skeleton states.
import assert from 'node:assert/strict';
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || 'playwright'
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const devices = [
  {
    id: 'gamma_12',
    type: 'gamma',
    name: 'γ剂量率监测仪',
    station: 'STATION-01',
    status: 'online',
    lastUpdate: new Date().toISOString(),
    metrics: [
      {
        metric: '0102060301',
        name: '测量值',
        timestamp: Date.now(),
        value: 328.5,
        unit: 'nSv/h',
        alarm: false,
      },
    ],
    alarms: [],
  },
];
let inventoryRoute, historyRoute, imageRoute;
let holdInventory = true,
  holdHistory = true;
const inventory = page.locator('.map-loading');
const history = page.getByRole('status', {
  name: '正在加载历史趋势',
  exact: true,
});
const plan = page.getByRole('status', { name: '正在加载平面图', exact: true });
await page.route('**/api/**', (route) => {
  if (new URL(route.request().url()).pathname.endsWith('/devices')) {
    if (holdInventory) {
      inventoryRoute = route;
      return;
    }
    return route.fulfill({ json: devices });
  }
  if (holdHistory) {
    historyRoute = route;
    return;
  }
  return route.fulfill({
    json: [
      { timestamp: Date.now() - 60000, value: 300 },
      { timestamp: Date.now(), value: 328.5 },
    ],
  });
});
await page.route('**/floorplans/c3.png', (route) => {
  imageRoute = route;
});
try {
  await page.goto(process.env.MAP_TEST_URL || 'http://127.0.0.1:5180/');
  await inventory.waitFor();
  assert.equal(
    await inventory.locator('.bx--skeleton__placeholder').count(),
    1,
  );
  await page.getByRole('link', { name: '监测总览', exact: true }).click();
  await page.locator('.table-wrapper[aria-busy="true"]').waitFor();
  assert.ok(await page.locator('.table-wrapper .bx--skeleton').count());
  await page.screenshot({ path: '/tmp/735-light-loading.png' });
  holdInventory = false;
  await inventoryRoute.fulfill({ json: devices });
  await page.locator('.table-wrapper[aria-busy="false"]').waitFor();
  await page.getByRole('searchbox', { name: '搜索设备' }).fill('gamma_12');
  await page
    .locator('tbody')
    .getByRole('button', { name: '2026012916', exact: true })
    .click();
  await history.waitFor();
  holdHistory = false;
  await historyRoute.fulfill({
    json: [{ timestamp: Date.now() - 60000, value: 328.5 }],
  });
  await history.waitFor({ state: 'detached' });
  await page.locator('.chart-container canvas').waitFor();
  await page.keyboard.press('Escape');
  holdInventory = true;
  await page.getByRole('button', { name: '刷新监测数据', exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector('.sidebar-footer .bx--inline-loading') !== null,
  );
  assert.equal(
    await page.locator('.table-wrapper').getAttribute('aria-busy'),
    'false',
  );
  assert.equal(await page.locator('tbody tr').count(), 1);
  holdInventory = false;
  await inventoryRoute.fulfill({ status: 503, body: '{}' });
  await page.getByText('刷新失败', { exact: true }).waitFor();
  assert.equal(await page.locator('tbody tr').count(), 1);
  await page.getByRole('link', { name: 'C3 采区', exact: true }).click();
  await plan.waitFor();
  await imageRoute.fulfill({ status: 404, body: '' });
  await plan.waitFor({ state: 'detached' });
  await page.getByText('平面图加载失败', { exact: true }).waitFor();
  await page.getByRole('link', { name: '水冶厂', exact: true }).click();
  await plan.waitFor({ state: 'detached' });
  assert.equal(await page.locator('.map-loading').count(), 0);
  const colors = await page.evaluate(() => ({
    brand: getComputedStyle(document.querySelector('.sidebar-brand'))
      .backgroundColor,
    scheme: getComputedStyle(document.documentElement).colorScheme,
  }));
  assert.equal(colors.brand, 'rgb(15, 98, 254)');
  assert.equal(colors.scheme, 'light');
  assert.deepEqual(errors, []);
  console.log(
    'Loading UI passed: initial map/table, delayed history, stable refresh/failure, image loading/error, blue light theme.',
  );
} finally {
  await browser.close();
}

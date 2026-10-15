import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, isAbsolute } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = fileURLToPath(new URL('.', import.meta.url));
const SITE_ROOT = resolve(SCRIPT_DIR, '..');
const QA_DIR = resolve(SITE_ROOT, 'qa');
const DEFAULT_URL = 'http://127.0.0.1:4177/#design';
const TARGET_URL = new URL(process.env.DESIGN_QA_URL || DEFAULT_URL);
if (!TARGET_URL.hash || TARGET_URL.hash === '#') TARGET_URL.hash = 'design';
const PAGE_TIMEOUT = 20_000;
const SHORT_TIMEOUT = 8_000;
const DESIGN_NAMES = {
  street: '街角隨手投',
  sorting: '回收分流站',
  hotspot: '高使用量管理',
  household: '家戶收受站',
};
const DESIGN_DEPTH_CM = { street: 42, sorting: 50, hotspot: 72, household: 80 };
const VIEWS = ['overview', 'pedestrian', 'wheelchair', 'worker'];
const SCREENS = [
  'desktop-street.png',
  'desktop-sorting.png',
  'desktop-hotspot.png',
  'desktop-household.png',
  'mobile-hotspot.png',
  'mobile-webgl-fallback.png',
];
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

function showHelp() {
  console.log(`Usage: python3 scripts/check-design-browser.py [--help]\n\n` +
    'Serve the built site at http://127.0.0.1:4177/#design, then run this check.\n' +
    'Set PLAYWRIGHT_MODULE to a Playwright module path, CHROME_PATH to Chrome, and\n' +
    'DESIGN_QA_URL to override the page URL. Screenshots and JSON go to ignored qa/.');
}

if (process.argv.includes('--help')) {
  showHelp();
  process.exit(0);
}

function importSpecifier() {
  const value = process.env.PLAYWRIGHT_MODULE?.trim();
  if (!value) return 'playwright';
  if (value.startsWith('file:')) return value;
  return isAbsolute(value) ? pathToFileURL(value).href : value;
}

async function loadPlaywright() {
  try {
    return await import(importSpecifier());
  } catch (cause) {
    throw new Error(
      'Could not load Playwright. Set PLAYWRIGHT_MODULE to the Playwright module file or make playwright importable.',
      { cause },
    );
  }
}

function observe(page, counters) {
  const diagnostics = { pageErrors: [], consoleErrors: [], failedRequests: [] };
  page.on('pageerror', error => diagnostics.pageErrors.push(error.message));
  page.on('console', message => {
    if (message.type() === 'error') diagnostics.consoleErrors.push(message.text());
  });
  page.on('requestfailed', request => {
    diagnostics.failedRequests.push({ url: request.url(), failure: request.failure()?.errorText || 'unknown' });
  });
  page.route('**/tile.openstreetmap.org/**', async route => {
    counters.mapTiles += 1;
    await route.fulfill({ status: 200, contentType: 'image/png', body: ONE_PIXEL_PNG });
  });
  return diagnostics;
}

function assertHealthy(diagnostics, { allowedConsole = [] } = {}) {
  assert.deepEqual(diagnostics.pageErrors, [], `Uncaught page errors: ${JSON.stringify(diagnostics.pageErrors)}`);
  assert.deepEqual(diagnostics.failedRequests, [], `Failed requests: ${JSON.stringify(diagnostics.failedRequests)}`);
  const unexpected = diagnostics.consoleErrors.filter(message =>
    !allowedConsole.some(pattern => pattern.test(message)));
  assert.deepEqual(unexpected, [], `Unexpected console errors: ${JSON.stringify(unexpected)}`);
}

async function waitForText(page, selector, expected, { contains = false, timeout = SHORT_TIMEOUT } = {}) {
  await page.waitForFunction(({ selector: target, expected: wanted, contains: partial }) => {
    const element = document.querySelector(target);
    const actual = (element?.innerText ?? element?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return element && (partial ? actual.includes(wanted) : actual === wanted);
  }, { selector, expected, contains }, { timeout });
}

async function waitForAttribute(page, selector, attribute, value, timeout = SHORT_TIMEOUT) {
  await page.waitForFunction(({ selector: target, attribute: name, value: wanted }) =>
    document.querySelector(target)?.getAttribute(name) === wanted,
  { selector, attribute, value }, { timeout });
}

async function assertVisible(page, selector, expected = true) {
  assert.equal(await page.locator(selector).isVisible(), expected, `${selector} visibility`);
}

async function assertValue(page, selector, expected) {
  assert.equal(await page.locator(selector).inputValue(), String(expected), `${selector} value`);
}

async function assertPressed(page, selector, expected = true) {
  await waitForAttribute(page, selector, 'aria-pressed', String(expected));
}

async function assertSinglePressed(page, selector) {
  assert.equal(await page.locator(`${selector}[aria-pressed="true"]`).count(), 1,
    `Expected one selected control in ${selector}`);
}

async function click(page, selector) {
  await page.locator(selector).click();
}

async function selectDesign(page, id) {
  await click(page, `[data-design="${id}"]`);
  await waitForText(page, '#design-name', DESIGN_NAMES[id]);
  await assertPressed(page, `[data-design="${id}"]`);
  await assertSinglePressed(page, '[data-design]');
}

async function selectRole(page, role) {
  await click(page, `[data-design-role="${role}"]`);
  await assertPressed(page, `[data-design-role="${role}"]`);
  await assertSinglePressed(page, '[data-design-role]');
}

async function selectItem(page, item) {
  await click(page, `[data-design-item="${item}"]`);
  await assertPressed(page, `[data-design-item="${item}"]`);
  await assertSinglePressed(page, '[data-design-item]');
}

async function selectChannel(page, channel) {
  await click(page, `[data-design-channel="${channel}"]`);
  await assertPressed(page, `[data-design-channel="${channel}"]`);
  await assertSinglePressed(page, '[data-design-channel]');
}

async function selectScenario(page, scenario) {
  await click(page, `[data-scenario="${scenario}"]`);
  await assertPressed(page, `[data-scenario="${scenario}"]`);
}

async function selectView(page, view) {
  await click(page, `[data-design-view="${view}"]`);
  await assertPressed(page, `[data-design-view="${view}"]`);
  await assertSinglePressed(page, '[data-design-view]');
}

async function assertStatus(page, message, options = {}) {
  await waitForText(page, '#design-status', message, { contains: true, ...options });
}

async function depositAndExpect(page, message, { animate = false } = {}) {
  await click(page, '#design-throw');
  await assertStatus(page, message);
  if (animate) {
    await page.waitForTimeout(1_100);
    await assertStatus(page, message);
  }
}

async function ready(page, { webgl = true } = {}) {
  await page.goto(TARGET_URL.href, { waitUntil: 'domcontentloaded' });
  await page.locator('#panel-design').waitFor({ state: 'visible', timeout: PAGE_TIMEOUT });
  assert.equal(await page.locator('[data-design]').count(), 4, 'four purpose buttons');
  assert.equal(await page.locator('[data-design-item]').count(), 3, 'three example objects');
  if (webgl) {
    await page.waitForFunction(() => document.querySelector('#design-viewport')?.dataset.ready === 'true',
      null, { timeout: PAGE_TIMEOUT });
    assert.equal(await page.locator('#design-viewport canvas').count(), 1, 'one WebGL canvas');
    await assertVisible(page, '#design-fallback', false);
  } else {
    await page.waitForFunction(() => {
      const fallback = document.querySelector('#design-fallback');
      return fallback && !fallback.hidden && fallback.querySelector('strong')?.textContent.includes('無法顯示 3D');
    }, null, { timeout: PAGE_TIMEOUT });
    assert.equal(await page.locator('#design-viewport canvas').count(), 0, 'no canvas after WebGL failure');
    await assertVisible(page, '#design-retry');
    await waitForText(page, '#design-fallback p', '投放、清運與情境切換仍可完整操作。你也可以重新開啟場景。');
  }
  assert.equal(await page.locator('#design-throw').isEnabled(), true, 'visitor controls remain enabled');
}

async function assertNoOverflow(page) {
  const metrics = await page.evaluate(() => {
    const panel = document.querySelector('#panel-design');
    const visible = element => {
      const style = getComputedStyle(element);
      return style.display !== 'none' && style.visibility !== 'hidden';
    };
    const offenders = [...document.querySelectorAll('body *')]
      .filter(element => visible(element))
      .map(element => ({
        element,
        rect: element.getBoundingClientRect(),
      }))
      .filter(({ rect }) => rect.width > 0 && (rect.left < -1 || rect.right > innerWidth + 1))
      .slice(0, 8)
      .map(({ element, rect }) => ({
        name: element.id || element.className?.baseVal || element.className || element.tagName,
        left: Math.round(rect.left),
        right: Math.round(rect.right),
      }));
    return {
      viewport: innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      panel: panel?.scrollWidth || 0,
      panelClient: panel?.clientWidth || 0,
      offenders,
    };
  });
  assert.ok(metrics.document <= metrics.viewport + 1 && metrics.body <= metrics.viewport + 1 &&
    metrics.panel <= metrics.panelClient + 1,
  `Horizontal overflow: ${JSON.stringify(metrics)}`);
}

async function openDimensions(page) {
  const details = page.locator('#panel-design .design-dimensions');
  if (!(await details.evaluate(element => element.open))) await click(page, '#panel-design .design-dimensions summary');
  assert.equal(await page.locator('#panel-design input[type="range"]').count(), 3, 'three native range controls');
  for (const [id, label] of [
    ['design-height', '桶身高度'],
    ['design-opening', '投入口寬度'],
    ['design-sidewalk', '人行道總寬'],
  ]) {
    const labelText = await page.locator(`#${id}`).evaluate(input =>
      [...input.labels].map(node => node.textContent).join(' '));
    assert.ok(labelText.includes(label), `${id} has its visible native label`);
  }
}

async function setRange(page, id, value) {
  await page.locator(`#${id}`).evaluate((input, nextValue) => {
    input.value = String(nextValue);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }, value);
}

async function testDimensionsAndKeyboard(page) {
  await selectDesign(page, 'street');
  await openDimensions(page);
  const height = page.locator('#design-height');
  await height.focus();
  await height.press('ArrowRight');
  await assertValue(page, '#design-height', 115);
  await waitForText(page, '#design-height-value', '115 cm');
  await waitForText(page, '#design-opening-height', '86.3');
  await height.press('Home');
  await assertValue(page, '#design-height', 85);
  await height.press('End');
  await assertValue(page, '#design-height', 130);

  await selectDesign(page, 'household');
  await assertValue(page, '#design-opening', 38);
  assert.equal(await page.locator('#design-opening').getAttribute('max'), '44');
  await setRange(page, 'design-opening', 44);
  await assertValue(page, '#design-opening', 44);
  await selectDesign(page, 'street');
  assert.equal(await page.locator('#design-opening').getAttribute('max'), '26');
  await assertValue(page, '#design-opening', 22);

  for (const [id, depth] of Object.entries(DESIGN_DEPTH_CM)) {
    await selectDesign(page, id);
    await setRange(page, 'design-sidewalk', 240);
    await waitForText(page, '#design-clearance', String(240 - depth));
  }
  await click(page, '#design-reset');
}

async function testPurposeRules(page, { animate = false } = {}) {
  await selectDesign(page, 'street');
  await selectItem(page, 'bottle');
  await depositAndExpect(page, '一般垃圾服務');
  await selectItem(page, 'bag');
  await depositAndExpect(page, '不收家戶垃圾');
  await selectItem(page, 'litter');
  await depositAndExpect(page, '完成概念投放', { animate });

  await selectDesign(page, 'sorting');
  await assertVisible(page, '#design-channel-controls');
  await selectItem(page, 'bottle');
  await depositAndExpect(page, '選「資源回收」入口');
  await selectChannel(page, 'recycle');
  await depositAndExpect(page, '進入回收槽', { animate });
  await selectItem(page, 'litter');
  await depositAndExpect(page, '選「一般垃圾」入口');
  await selectChannel(page, 'general');
  await depositAndExpect(page, '進入一般垃圾槽');
  await selectItem(page, 'bag');
  await depositAndExpect(page, '不收家戶垃圾');

  await selectDesign(page, 'hotspot');
  await assertVisible(page, '[data-scenario="near"]');
  await assertVisible(page, '[data-scenario="offline"]');
  await selectItem(page, 'bottle');
  await depositAndExpect(page, '一般垃圾服務');
  await selectItem(page, 'bag');
  await depositAndExpect(page, '不收家戶垃圾');
  await selectItem(page, 'litter');
  await depositAndExpect(page, '完成概念投放');

  await selectDesign(page, 'household');
  await assertVisible(page, '#design-household-intro');
  await selectItem(page, 'bottle');
  await depositAndExpect(page, '家戶垃圾袋收受');
  await selectItem(page, 'litter');
  await depositAndExpect(page, '家戶垃圾袋收受');
  await selectItem(page, 'bag');
  await click(page, '#design-confirm');
  await assertStatus(page, '請先完成模擬住戶確認並放入示意垃圾袋');
  await depositAndExpect(page, '模擬住戶確認');
  await click(page, '#design-authenticate');
  await assertStatus(page, '住戶確認示意完成');
  await click(page, '#design-confirm');
  await assertStatus(page, '請先完成模擬住戶確認並放入示意垃圾袋');
  await depositAndExpect(page, '示意袋已放入封閉投放艙');
  await click(page, '#design-confirm');
  await assertStatus(page, '示意投放已確認');
}

async function testFullScenarios(page) {
  for (const id of Object.keys(DESIGN_NAMES)) {
    await selectDesign(page, id);
    await selectScenario(page, 'full');
    await waitForText(page, '#design-service-state', '已滿', { contains: true });
    if (id === 'household') {
      await click(page, '#design-authenticate');
      await assertStatus(page, '目前暫停受理');
    } else {
      await selectItem(page, 'litter');
      await depositAndExpect(page, '容器已滿');
    }
  }
}

async function testHotspotScenarios(page) {
  await selectDesign(page, 'hotspot');
  await selectScenario(page, 'near');
  await waitForText(page, '#design-service-state', '接近滿載', { contains: true });
  await selectRole(page, 'worker');
  await click(page, '#design-request');
  await assertStatus(page, '已安排收運示意，容器還沒有清空');
  await waitForText(page, '#design-service-state', '已安排收運', { contains: true });
  await click(page, '#design-compress');
  await assertStatus(page, '已切換壓縮機構示意');

  await selectDesign(page, 'hotspot');
  await selectScenario(page, 'offline');
  await waitForText(page, '#design-service-state', '容量未知・需現場確認');
  await selectItem(page, 'litter');
  await depositAndExpect(page, '感測離線，容量未知');
  await selectRole(page, 'worker');
  await click(page, '#design-request');
  await assertStatus(page, '感測離線，無法依讀值派收');
  await click(page, '#design-compress');
  await assertStatus(page, '感測離線，無法依讀值派收');
}

async function testMaintenance(page, id) {
  await selectDesign(page, id);
  await selectRole(page, 'worker');
  await click(page, '#design-service');
  await assertPressed(page, '#design-service');
  await waitForText(page, '#design-service-state', '清運中・暫停投放');
  await assertStatus(page, '清運門已開');
  if (id === 'hotspot') {
    await click(page, '#design-compress');
    await assertStatus(page, '開門時禁止壓縮');
  }
  await selectRole(page, 'visitor');
  await selectItem(page, id === 'household' ? 'bag' : 'litter');
  await depositAndExpect(page, '清運門開啟中，暫停投放');
  await selectRole(page, 'worker');
  await click(page, '#design-empty');
  await assertStatus(page, '已完成清空示意');
  await click(page, '#design-service');
  await assertPressed(page, '#design-service', false);
  await assertStatus(page, '清運門已關');
}

async function testCameras(page, { screenshots = false } = {}) {
  for (const id of Object.keys(DESIGN_NAMES)) {
    await selectDesign(page, id);
    for (const view of VIEWS) await selectView(page, view);
    await click(page, '#design-reset-view');
    await assertPressed(page, '[data-design-view="overview"]');
    await assertSinglePressed(page, '[data-design-view]');
    await assertNoOverflow(page);
    if (screenshots) {
      await click(page, '#design-reset');
      await page.waitForTimeout(350);
      await page.screenshot({ path: resolve(QA_DIR, `desktop-${id}.png`), fullPage: true });
    }
  }
}

async function exerciseAllPurposes(page, { animate = false } = {}) {
  await testPurposeRules(page, { animate });
  await testFullScenarios(page);
  await testHotspotScenarios(page);
  for (const id of Object.keys(DESIGN_NAMES)) await testMaintenance(page, id);
}

async function navigate(page, name) {
  const historyPages = ['map', 'comparison', 'history'];
  if (historyPages.includes(name) && !(await page.locator('#history-navigation').isVisible())) {
    await click(page, '[data-section="history"]');
    if (name === 'map') {
      await page.locator('#panel-map').waitFor({ state: 'visible', timeout: SHORT_TIMEOUT });
      return;
    }
  }
  if (name === 'map' && await page.locator('#panel-map').isVisible()) return;
  await page.locator(`[data-page="${name}"]:visible`).first().click();
  await page.locator(`#panel-${name}`).waitFor({ state: 'visible', timeout: SHORT_TIMEOUT });
}

async function newPage(browser, counters, options = {}) {
  const { webglFailure = false, ...contextOptions } = options;
  const context = await browser.newContext(contextOptions);
  if (webglFailure) {
    await context.addInitScript(() => {
      const nativeGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...args) {
        if (String(type).toLowerCase().startsWith('webgl')) return null;
        return nativeGetContext.call(this, type, ...args);
      };
    });
  }
  const page = await context.newPage();
  const diagnostics = observe(page, counters);
  return { context, page, diagnostics };
}

async function runDesktop(browser, counters, result) {
  const { context, page, diagnostics } = await newPage(browser, counters, {
    viewport: { width: 1440, height: 1000 },
  });
  try {
    await ready(page);
    await testDimensionsAndKeyboard(page);
    await exerciseAllPurposes(page, { animate: true });
    await testCameras(page, { screenshots: true });
    await assertNoOverflow(page);

    const canvas = await page.locator('#design-viewport canvas').elementHandle();
    assert.ok(canvas, 'canvas exists before navigation');
    await page.evaluate(element => { window.__designQaCanvas = element; }, canvas);
    for (const name of ['countries', 'research', 'sources', 'map', 'design']) await navigate(page, name);
    assert.equal(await page.locator('#design-viewport canvas').count(), 1, 'one canvas after navigation');
    assert.equal(await page.evaluate(() =>
      window.__designQaCanvas === document.querySelector('#design-viewport canvas')),
    true, 'navigation reuses the original canvas');
    result.desktop = 'passed';
    assertHealthy(diagnostics);
  } finally {
    await context.close();
  }
}

async function runResponsive(browser, counters, result) {
  for (const width of [720, 390, 320]) {
    const isMobile = width <= 390;
    const { context, page, diagnostics } = await newPage(browser, counters, {
      viewport: { width, height: isMobile ? 844 : 900 },
      isMobile,
      hasTouch: isMobile,
    });
    try {
      await ready(page);
      for (const id of Object.keys(DESIGN_NAMES)) {
        await selectDesign(page, id);
        await assertNoOverflow(page);
      }
      await selectDesign(page, 'hotspot');
      await selectView(page, 'wheelchair');
      await assertNoOverflow(page);
      if (width === 390) {
        await click(page, '#design-reset-view');
        await page.screenshot({ path: resolve(QA_DIR, 'mobile-hotspot.png'), fullPage: true });
      }
      assertHealthy(diagnostics);
      result[`width_${width}`] = 'passed';
    } finally {
      await context.close();
    }
  }
}

async function runReducedMotion(browser, counters, result) {
  const { context, page, diagnostics } = await newPage(browser, counters, {
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  });
  try {
    await ready(page);
    assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
    await testPurposeRules(page, { animate: false });
    await selectView(page, 'wheelchair');
    await assertNoOverflow(page);
    assertHealthy(diagnostics);
    result.reduced_motion = 'passed';
  } finally {
    await context.close();
  }
}

async function runDatasetFailure(browser, counters, result) {
  const { context, page, diagnostics } = await newPage(browser, counters, {
    viewport: { width: 1440, height: 1000 },
  });
  try {
    await page.route('**/data/datasets.json', route =>
      route.fulfill({ status: 503, contentType: 'text/plain', body: 'unavailable' }));
    await ready(page);
    await waitForText(page, '#load-status', '位置資料暫時無法載入', { contains: true });
    assert.ok((await page.locator('#load-status').getAttribute('class')).includes('error'));
    await exerciseAllPurposes(page);

    const canvas = await page.locator('#design-viewport canvas').elementHandle();
    await page.evaluate(element => { window.__designQaCanvas = element; }, canvas);
    for (const name of ['countries', 'research', 'map', 'design']) await navigate(page, name);
    assert.equal(await page.locator('#design-viewport canvas').count(), 1);
    assert.equal(await page.evaluate(() =>
      window.__designQaCanvas === document.querySelector('#design-viewport canvas')), true);
    assertHealthy(diagnostics, { allowedConsole: [/503/, /Site initialization failed:.*Data response unavailable/] });
    result.dataset_503_independence = 'passed';
  } finally {
    await context.close();
  }
}

async function runWebglFallback(browser, counters, result) {
  const { context, page, diagnostics } = await newPage(browser, counters, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    webglFailure: true,
  });
  try {
    await ready(page, { webgl: false });
    await exerciseAllPurposes(page);
    await testDimensionsAndKeyboard(page);
    await testCameras(page);
    assert.equal(await page.locator('#design-viewport canvas').count(), 0,
      'purpose workflows do not need a WebGL canvas');
    await selectDesign(page, 'hotspot');
    await click(page, '#design-reset-view');
    await assertNoOverflow(page);
    await page.screenshot({ path: resolve(QA_DIR, 'mobile-webgl-fallback.png'), fullPage: true });
    await click(page, '#design-retry');
    await page.waitForFunction(() => {
      const fallback = document.querySelector('#design-fallback');
      return fallback && !fallback.hidden && fallback.querySelector('strong')?.textContent.includes('無法顯示 3D');
    }, null, { timeout: PAGE_TIMEOUT });
    assert.equal(await page.locator('#design-viewport canvas').count(), 0);
    assertHealthy(diagnostics, { allowedConsole: [/webgl/i] });
    result.webgl_fallback_all_purposes = 'passed';
  } finally {
    await context.close();
  }
}

async function main() {
  await mkdir(QA_DIR, { recursive: true });
  const result = {
    status: 'running',
    url: TARGET_URL.href,
    screenshots: SCREENS,
    checks: {},
    map_tile_responses: 0,
  };
  let browser;
  try {
    const { chromium } = await loadPlaywright();
    const executablePath = process.env.CHROME_PATH?.trim();
    browser = await chromium.launch({
      headless: true,
      ...(executablePath ? { executablePath: resolve(executablePath) } : {}),
    });
    const counters = { mapTiles: 0 };
    result.browser_version = browser.version();

    await runDesktop(browser, counters, result.checks);
    await runResponsive(browser, counters, result.checks);
    await runReducedMotion(browser, counters, result.checks);
    await runDatasetFailure(browser, counters, result.checks);
    await runWebglFallback(browser, counters, result.checks);

    result.map_tile_responses = counters.mapTiles;
    result.map_tile_fixture = 'OpenStreetMap tile requests are fulfilled with an in-memory 1x1 PNG';
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed';
    result.error = error?.stack || String(error);
    process.exitCode = 1;
  } finally {
    await browser?.close();
    await writeFile(resolve(QA_DIR, 'design-browser-results.json'),
      `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  }
  console.log(JSON.stringify(result, null, 2));
}

await main();

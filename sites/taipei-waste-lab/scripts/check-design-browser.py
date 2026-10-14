"""Exercise the independent Three.js design view with installed Chromium.

Run the static server on port 4174 first (``npm run preview``), then run this
script. The screenshots and structured result are written to qa/. No external
map tiles are required. Forced dataset/WebGL failures are separate test cases.
"""
import json
import os
import re
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parent.parent
QA = ROOT / 'qa'
URL = os.environ.get('DESIGN_QA_URL', 'http://127.0.0.1:4174/')
CONCEPTS = {'pair': '圓桶雙分類', 'hood': '雨遮雙桶',
            'slot': '窄口直立桶', 'service': '前門模組桶'}


def track_errors(page):
    errors = []
    console_errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('requestfailed', lambda request: errors.append(
        f'Unexpected failed request: {request.url}: {request.failure}')
        if not request.url.startswith('https://tile.openstreetmap.org/') else None)
    page.on('console', lambda message: console_errors.append(message.text)
            if message.type == 'error' else None)
    page.route('https://tile.openstreetmap.org/**', lambda route: route.abort())
    return errors, console_errors


def assert_no_errors(errors, console_errors, *, dataset_failure=False, webgl_failure=False):
    assert not errors, f'Uncaught JavaScript errors: {errors}'
    unexpected = []
    for message in console_errors:
        expected = (dataset_failure and ('503' in message or
                    message == 'Site initialization failed: Data response unavailable'))
        expected = expected or (webgl_failure and 'Error creating WebGL context' in message)
        # Only map tile requests are blocked by this script. Do not suppress
        # module loads, shader errors, or other substantive console failures.
        expected = expected or message == 'Failed to load resource: net::ERR_FAILED'
        if not expected:
            unexpected.append(message)
    assert not unexpected, f'Unexpected browser console errors: {unexpected}'


def no_overflow(page):
    actual = page.evaluate('''() => ({
      viewport: innerWidth, document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
      offenders: [...document.querySelectorAll('#panel-design *')].filter(el => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && (r.right > innerWidth + 1 || r.left < -1);
      }).map(el => el.id || el.className || el.tagName).slice(0, 8)
    })''')
    assert actual['document'] <= actual['viewport'], f'Horizontal overflow: {actual}'


def ready(page, *, webgl=True):
    page.goto(URL + '#design')
    expect(page.locator('#panel-design')).to_be_visible()
    expect(page.locator('[data-design]')).to_have_count(4)
    if webgl:
        expect(page.locator('#design-viewport')).to_have_attribute('data-ready', 'true', timeout=20000)
        expect(page.locator('#design-viewport canvas')).to_have_count(1)
        expect(page.locator('#design-throw')).to_be_enabled()
        expect(page.locator('#design-fallback')).to_be_hidden()
    else:
        expect(page.locator('#design-fallback strong')).to_have_text('目前裝置無法開啟 3D 場景')


def control(page, name, value):
    page.locator('#design-' + name).evaluate('''(input, value) => {
      input.value = String(value);
      input.dispatchEvent(new Event('input', {bubbles: true}));
    }''', value)


def select_concept(page, concept):
    page.locator(f'[data-design="{concept}"]').click()
    expect(page.locator('#design-name')).to_have_text(CONCEPTS[concept])
    expect(page.locator(f'[data-design="{concept}"]')).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('[data-design][aria-pressed="true"]')).to_have_count(1)


def trial(page, item, allowed, *, animate=True):
    page.locator(f'[data-design-item="{item}"]').click()
    expect(page.locator(f'[data-design-item="{item}"]')).to_have_attribute('aria-pressed', 'true')
    result = '可穿過' if allowed else '無法穿過'
    expect(page.locator('#design-status')).to_contain_text(result)
    if animate:
        expect(page.locator('#design-throw')).to_be_enabled()
        page.locator('#design-throw').click()
        expect(page.locator('#design-throw')).to_be_enabled(timeout=5000)
        # Completed motion must preserve the accessible explanation rather than
        # replacing it with a generic animation-complete message.
        expect(page.locator('#design-status')).to_contain_text(result)


def desktop_checks(page):
    ready(page)
    # Native labels, semantic button state, and native keyboard range behavior.
    expect(page.get_by_role('slider')).to_have_count(4)
    for name in ['桶身高度', '投入口寬度', '人行道總寬', '容器填滿程度']:
        expect(page.get_by_role('slider', name=re.compile(name))).to_have_count(1)
    height = page.get_by_role('slider', name=re.compile('桶身高度'))
    height.focus()
    height.press('ArrowRight')
    expect(page.locator('#design-height-value')).to_have_text('115 cm')
    expect(page.locator('#design-opening-height')).to_have_text('115')
    height.press('Home')
    expect(height).to_have_value('85')
    height.press('End')
    expect(height).to_have_value('130')
    page.locator('#design-reset').click()

    for concept in CONCEPTS:
        select_concept(page, concept)
        page.locator('#design-reset').click()
        trial(page, 'cup', True, animate=False)
        trial(page, 'bottle', True, animate=False)
        trial(page, 'bag', False, animate=False)
    # The smallest concept must clamp the carried setting on switch.
    select_concept(page, 'pair')
    control(page, 'opening', 36)
    expect(page.locator('#design-opening-value')).to_have_text('36 cm')
    trial(page, 'bag', True)
    select_concept(page, 'slot')
    expect(page.locator('#design-opening')).to_have_attribute('max', '18')
    expect(page.locator('#design-opening')).to_have_value('18')
    expect(page.locator('#design-opening-value')).to_have_text('18 cm')
    trial(page, 'cup', True)
    trial(page, 'bottle', True)
    trial(page, 'bag', False)

    control(page, 'sidewalk', 240)
    expect(page.locator('#design-sidewalk-value')).to_have_text('240 cm')
    expect(page.locator('#design-clearance')).to_have_text('196')
    control(page, 'fill', 100)
    expect(page.locator('#design-fill-value')).to_have_text('100%')
    expect(page.locator('#design-fill-readout')).to_have_text('100')
    page.locator('[data-design-item="cup"]').click()
    expect(page.locator('#design-status')).to_contain_text('設定為填滿')
    page.locator('#design-throw').click()
    expect(page.locator('#design-throw')).to_be_enabled(timeout=5000)
    expect(page.locator('#design-status')).to_contain_text('設定為填滿')

    page.locator('#design-reset').click()
    select_concept(page, 'service')
    # Buttons must also activate from the keyboard.
    service = page.locator('#design-service')
    service.focus()
    service.press('Space')
    expect(service).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('[data-design-view="worker"]')).to_have_attribute('aria-pressed', 'true')
    expect(page.locator('#design-status')).to_contain_text('內桶已拉出', timeout=5000)
    service.press('Space')
    expect(service).to_have_attribute('aria-pressed', 'false')
    expect(page.locator('#design-status')).to_contain_text('內桶已收回', timeout=5000)
    for view in ['overview', 'pedestrian', 'wheelchair', 'worker']:
        page.locator(f'[data-design-view="{view}"]').click()
        expect(page.locator(f'[data-design-view="{view}"]')).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('[data-design-view][aria-pressed="true"]')).to_have_count(1)
    page.locator('#design-reset-view').click()
    expect(page.locator('[data-design-view="overview"]')).to_have_attribute('aria-pressed', 'true')

    page.evaluate('window.__designQaCanvas = document.querySelector("#design-viewport canvas")')
    for panel in ['history', 'sources', 'map', 'design', 'history', 'design']:
        page.locator(f'[data-page="{panel}"]').click()
        expect(page.locator('#panel-' + panel)).to_be_visible()
    expect(page.locator('#design-viewport canvas')).to_have_count(1)
    assert page.evaluate('window.__designQaCanvas === document.querySelector("#design-viewport canvas")')
    # Preserve a useful final screenshot, with the scene in its overview preset.
    select_concept(page, 'pair')
    page.locator('#design-reset').click()
    page.locator('#design-reset-view').click()
    page.wait_for_timeout(700)
    no_overflow(page)
    page.screenshot(path=str(QA / 'desktop-design.png'), full_page=True)


def mobile_checks(page, width):
    ready(page)
    for concept in CONCEPTS:
        select_concept(page, concept)
        no_overflow(page)
    select_concept(page, 'slot')
    expect(page.locator('#design-opening')).to_have_value('18')
    trial(page, 'cup', True, animate=False)
    trial(page, 'bottle', True, animate=False)
    trial(page, 'bag', False, animate=False)
    control(page, 'sidewalk', 120)
    expect(page.locator('#design-clearance')).to_have_text('76')
    page.locator('[data-design-view="wheelchair"]').click()
    expect(page.locator('[data-design-view="wheelchair"]')).to_have_attribute('aria-pressed', 'true')
    no_overflow(page)
    select_concept(page, 'hood')
    page.locator('#design-reset').click()
    page.locator('#design-reset-view').click()
    page.wait_for_timeout(700)
    page.screenshot(path=str(QA / f'mobile-{width}-design.png'), full_page=True)


def main():
    QA.mkdir(exist_ok=True)
    results = {}
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
            args=['--no-sandbox', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader'])
        desktop = browser.new_context(viewport={'width': 1440, 'height': 1080})
        page = desktop.new_page()
        errors, console = track_errors(page)
        desktop_checks(page)
        assert_no_errors(errors, console)
        results['desktop'] = 'passed'
        desktop.close()

        for width in [390, 320]:
            context = browser.new_context(viewport={'width': width, 'height': 844},
                                          is_mobile=True, has_touch=True)
            phone = context.new_page()
            errors, console = track_errors(phone)
            mobile_checks(phone, width)
            assert_no_errors(errors, console)
            results[f'mobile_{width}'] = 'passed'
            context.close()

        reduced = browser.new_context(viewport={'width': 1440, 'height': 1080}, reduced_motion='reduce')
        page = reduced.new_page()
        errors, console = track_errors(page)
        ready(page)
        assert page.evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches')
        trial(page, 'cup', True)
        page.locator('#design-service').click()
        expect(page.locator('#design-service')).to_have_attribute('aria-pressed', 'true')
        expect(page.locator('#design-status')).to_contain_text(re.compile('清運模式|內桶已拉出'))
        no_overflow(page)
        assert_no_errors(errors, console)
        results['reduced_motion'] = 'passed'
        reduced.close()

        failure = browser.new_context(viewport={'width': 1440, 'height': 1080})
        page = failure.new_page()
        errors, console = track_errors(page)
        page.route('**/data/datasets.json', lambda route: route.fulfill(status=503, body='unavailable'))
        ready(page)
        expect(page.locator('#load-status')).to_have_class(re.compile('error'))
        select_concept(page, 'slot')
        trial(page, 'cup', True)
        control(page, 'height', 120)
        expect(page.locator('#design-height-value')).to_have_text('120 cm')
        page.locator('[data-page="history"]').click()
        expect(page.locator('#panel-history')).to_be_visible()
        page.locator('[data-page="design"]').click()
        expect(page.locator('#design-viewport canvas')).to_have_count(1)
        assert_no_errors(errors, console, dataset_failure=True)
        results['dataset_503_independence'] = 'passed'
        failure.close()

        fallback = browser.new_context(viewport={'width': 390, 'height': 844})
        fallback.add_init_script('''(() => {
          const native = HTMLCanvasElement.prototype.getContext;
          HTMLCanvasElement.prototype.getContext = function(type, ...options) {
            return String(type).toLowerCase().includes('webgl') ? null : native.call(this, type, ...options);
          };
        })();''')
        page = fallback.new_page()
        errors, console = track_errors(page)
        ready(page, webgl=False)
        expect(page.locator('#design-throw')).to_be_disabled()
        expect(page.locator('#design-retry')).to_be_visible()
        expect(page.locator('#design-fallback p')).to_contain_text('仍可切換桶型、調整尺寸')
        select_concept(page, 'slot')
        control(page, 'height', 120)
        control(page, 'sidewalk', 240)
        expect(page.locator('#design-opening-height')).to_have_text('95')
        expect(page.locator('#design-clearance')).to_have_text('196')
        trial(page, 'cup', True, animate=False)
        page.locator('#design-retry').click()
        expect(page.locator('#design-fallback strong')).to_have_text('目前裝置無法開啟 3D 場景')
        expect(page.locator('#design-viewport canvas')).to_have_count(0)
        no_overflow(page)
        page.screenshot(path=str(QA / 'mobile-design-fallback.png'), full_page=True)
        assert_no_errors(errors, console, webgl_failure=True)
        results['webgl_fallback'] = 'passed'
        fallback.close()
        browser.close()
    results['checks'] = ['four concepts', 'native labels and keyboard', 'control readouts',
        'opening limits', 'sample fit and blocked trials', 'full-bin guard', 'service operation',
        'camera presets', 'single canvas after navigation', 'no horizontal overflow']
    results['external_tiles'] = 'intentionally blocked'
    (QA / 'design-browser-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(results, ensure_ascii=False))


if __name__ == '__main__':
    main()

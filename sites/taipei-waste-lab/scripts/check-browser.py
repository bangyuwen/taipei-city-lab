# Route and data interaction regression checks for the three-entrance site.
import json
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
QA = ROOT / 'qa'
QA.mkdir(exist_ok=True)
URL = os.environ.get('REDESIGN_QA_URL', 'http://127.0.0.1:4174/')
WORKSPACE_PAGES = {
    'research': ('research',),
    'analysis': ('analysis', 'districts', 'methods', 'feedback', 'evidence'),
    'ideas': ('ideas', 'spec', 'siting', 'design'),
    'plan': ('plan', 'team', 'work'),
    'library': ('library', 'history', 'map', 'comparison', 'countries', 'sources',
                'materials', 'definition', 'archive'),
}
CAPTURE_SCREENSHOTS = '--functional-only' not in sys.argv


def url_for(fragment=''):
    parts = urlsplit(URL)
    return urlunsplit(parts._replace(fragment=fragment))


def check_no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'


def check_runtime_links(page):
    invalid = page.locator('a[href]').evaluate_all('''links => {
      const current = new URL(location.href);
      const runtimePaths = new Set([
        current.pathname,
        new URL('.', current).pathname,
        new URL('index.html', current).pathname,
        new URL('siting-overlay.html', current).pathname,
      ]);
      return links.map(link => link.getAttribute('href')).filter(href => {
        let target;
        try { target = new URL(href, document.baseURI); } catch { return true; }
        if (!/^https?:$/.test(target.protocol)) return true;
        // Original external sources are allowed; local research files are not
        // reader-facing routes. Query/hash links into the app remain valid.
        if (target.origin !== current.origin) return false;
        if (/\\.(?:csv|md|zip)$/i.test(decodeURIComponent(target.pathname))) return true;
        return !runtimePaths.has(target.pathname);
      });
    }''')
    assert not invalid, f'Local attachment or unknown route remains: {invalid}'


def focused(page, target_id):
    page.wait_for_function('(id) => document.activeElement?.id === id', arg=target_id)


def workspace_for_page(panel):
    return next((workspace for workspace, pages in WORKSPACE_PAGES.items()
                 if panel in pages), 'research')


def primary(page, workspace):
    menu = page.locator('#site-menu-toggle')
    if menu.is_visible() and not page.locator('#site-navigation').is_visible():
        menu.click()
    page.locator(f'#site-navigation [data-page="{workspace}"]').click()


def navigate(page, panel):
    previous_hash = urlsplit(page.url).fragment
    workspace = workspace_for_page(panel)
    primary(page, workspace)
    if panel != workspace:
        if workspace == 'library':
            page.locator(f'#panel-library .library-index a[href="#{panel}"]').first.click()
        else:
            page.locator(f'#panel-{workspace} .project-subnav a[data-page="{panel}"]').click()
    target = page.locator(f'#panel-{panel}')
    target.wait_for(state='visible')
    page.wait_for_function('(expected) => document.body.dataset.page === expected', arg=panel)
    if previous_hash != panel:
        focused(page, target.get_attribute('aria-labelledby'))


def ready(page):
    page.goto(url_for())
    page.locator('#panel-research').wait_for(state='visible')
    page.locator('#dataset-version:not([disabled])').wait_for(state='attached')
    assert page.locator('#panel-research details').count() == 0
    assert page.locator('#research-synthesis > .research-synthesis-item').count() == 3
    assert page.locator('#site-navigation a').evaluate_all('(links) => links.map(link => [link.hash, link.textContent.trim()])') == [
        ['#research', '工作總覽'], ['#analysis', '熱點研究'], ['#ideas', '方案比較'],
        ['#plan', '執行分工'], ['#library', '資料庫'],
    ]
    for selector in ('#history-navigation', '#research-navigation'):
        legacy_navigation = page.locator(selector)
        assert not legacy_navigation.is_visible()
        assert legacy_navigation.evaluate('(element) => element.childElementCount === 0')
    assert page.locator('.research-candidate').count() == 0
    navigate(page, 'map')
    page.locator('#map.leaflet-container').wait_for()


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.environ.get('CHROME_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox'])
        desktop = browser.new_context(viewport={'width': 1440, 'height': 1080}, reduced_motion='reduce')
        page = desktop.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        # External tile availability is independent of local map interactions.
        page.route('https://{tile.openstreetmap.org,basemaps.cartocdn.com}/**', lambda route: route.abort())
        ready(page)
        assert page.locator('#dataset-version option').count() == 6
        assert page.locator('[data-year]').count() == 0
        assert page.locator('#result-count').inner_text() == '2,517'
        assert '2,505' in page.locator('#result-map-count').inner_text()
        page.select_option('#district', '中正區')
        assert page.locator('#result-count').inner_text() == '369'
        page.fill('#search', '中山南路')
        assert int(page.locator('#result-count').inner_text().replace(',', '')) > 0
        page.locator('.point-row button').first.click()
        assert page.locator('.leaflet-popup-content').is_visible()
        assert page.locator('[download], #export-csv, #comparison-export, #comparison-district-export').count() == 0
        page.click('#reset-filters')
        page.select_option('#dataset-version', '2024-archive')
        assert page.locator('#result-count').inner_text() == '1,971'
        assert '1,969' in page.locator('#result-map-count').inner_text()
        assert '2024-10-19' in page.locator('#dataset-date').inner_text()
        page.select_option('#dataset-version', '2024')
        assert page.locator('#result-count').inner_text() == '1,000'
        page.select_option('#district', '信義區')
        assert page.locator('#result-count').inner_text() == '0'
        assert '不能視為' in page.locator('#point-list').inner_text()
        navigate(page, 'countries')
        page.locator('#panel-countries.country-reading-ready').wait_for()
        assert page.locator('.country-case:visible').count() == 1
        assert page.locator('#country-viewer').get_attribute('data-media') == 'photo'
        navigate(page, 'map')
        assert page.locator('#dataset-version').input_value() == '2024'
        assert page.locator('#district').input_value() == '信義區'
        page.reload()
        page.locator('#dataset-version:not([disabled])').wait_for(state='attached')
        assert page.locator('#district').input_value() == '信義區'
        assert page.locator('#dataset-version').input_value() == '2024'
        page.click('#reset-filters')
        for version, count in [('2022', '1,799'), ('2026-main', '681'), ('2026', '294')]:
            page.select_option('#dataset-version', version)
            assert page.locator('#result-count').inner_text() == count
        page.select_option('#dataset-version', '2015')
        page.fill('#search', '武昌街4號')
        assert page.locator('#result-count').inner_text() == '1'
        assert '0 筆可繪製' in page.locator('#result-map-count').inner_text()
        assert page.locator('.point-row button').is_disabled()
        page.click('#reset-filters')
        navigate(page, 'history')
        assert page.locator('.timeline-event').count() == 11
        assert page.locator('[data-event-filter]').count() == 0
        assert page.locator('.case-step').count() == 4
        navigate(page, 'sources')
        assert page.locator('#source-cards tbody tr').count() == 6
        check_runtime_links(page)
        check_no_overflow(page)
        if CAPTURE_SCREENSHOTS:
            page.screenshot(path=str(QA / 'desktop-sources.png'), full_page=True)
        navigate(page, 'research')
        page.locator('#panel-research a[href="#reference-L02"]').first.click()
        page.locator('#panel-sources').wait_for(state='visible')
        focused(page, 'reference-L02')
        page.goto(url_for('reference-P03'))
        page.locator('#panel-sources').wait_for(state='visible')
        focused(page, 'reference-P03')
        navigate(page, 'materials')
        page.locator('#research-context:not([disabled])').wait_for(state='attached')
        assert page.locator('.research-candidate').count() == 18
        check_runtime_links(page)
        navigate(page, 'map')
        # Returning from a hidden panel must restore a renderable Leaflet canvas.
        page.wait_for_function('''() => {
          const canvas=document.querySelector('.leaflet-overlay-pane canvas');
          if(!canvas||!canvas.width||!canvas.height)return false;
          const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data;
          let pixels=0;for(let i=3;i<data.length;i+=4)if(data[i])pixels++;
          return pixels>1500;
        }''')
        if CAPTURE_SCREENSHOTS:
            page.screenshot(path=str(QA / 'desktop-map.png'), full_page=True)
        check_no_overflow(page)
        assert not errors, errors

        mobile = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True,
                                     has_touch=True, reduced_motion='reduce')
        phone = mobile.new_page()
        phone_errors = []
        phone.on('pageerror', lambda error: phone_errors.append(str(error)))
        phone.route('https://{tile.openstreetmap.org,basemaps.cartocdn.com}/**', lambda route: route.abort())
        ready(phone)
        for panel in ['research', 'map', 'history', 'sources']:
            navigate(phone, panel)
            assert phone.locator(f'#panel-{panel}').is_visible()
            check_no_overflow(phone)
        navigate(phone, 'map')
        phone.select_option('#dataset-version', '2024-archive')
        phone.select_option('#district', '大安區')
        assert phone.locator('#result-count').inner_text() == '229'
        phone.select_option('#dataset-version', '2024')
        assert phone.locator('#result-count').inner_text() == '235'
        navigate(phone, 'countries')
        phone.go_back()
        phone.locator('#panel-library').wait_for(state='visible')
        phone.go_back()
        phone.locator('#panel-map').wait_for(state='visible')
        assert phone.locator('#district').input_value() == '大安區'
        assert phone.locator('#dataset-version').input_value() == '2024'
        if CAPTURE_SCREENSHOTS:
            phone.screenshot(path=str(QA / 'mobile-map.png'), full_page=True)
        assert not phone_errors, phone_errors

        failure = desktop.new_page()
        failure_errors = []
        failure.on('pageerror', lambda error: failure_errors.append(str(error)))
        failure.route('**/data/datasets.json', lambda route: route.fulfill(status=503, body='unavailable'))
        failure.goto(url_for())
        failure.locator('#load-status.error').wait_for(state='attached')
        assert failure.locator('#panel-research').is_visible()
        assert failure.locator('#research-synthesis > article').count() == 3
        assert '尚無台北試辦成效' in failure.locator('#panel-research').inner_text()
        navigate(failure, 'map')
        assert failure.locator('#district').is_disabled()
        assert failure.locator('#load-status.error').is_visible()
        assert failure.locator('[download], #export-csv, #comparison-export, #comparison-district-export').count() == 0
        navigate(failure, 'history')
        assert failure.locator('.timeline-event').count() == 11
        assert failure.locator('[data-event-filter]').count() == 0
        navigate(failure, 'sources')
        assert failure.locator('#reference-L02').is_visible()
        assert '版本表暫時無法載入' in failure.locator('#source-cards').inner_text()
        assert not failure_errors, failure_errors
        browser.close()
    print(json.dumps({'desktop': 'passed', 'mobile': 'passed', 'download_controls': 'absent',
                      'checks': 'research default, three primary entrances, secondary routes, six versions, coordinate flags, partial coverage, preserved filters, reference focus, lazy materials, readable timeline, static homepage on unavailable data',
                      'external_tiles': 'intentionally blocked for interaction regression'}, ensure_ascii=False))


if __name__ == '__main__':
    main()

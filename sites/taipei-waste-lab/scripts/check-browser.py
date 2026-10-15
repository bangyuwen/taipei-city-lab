"""Interaction checks against the local static site with the installed browser."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
QA = ROOT / 'qa'
QA.mkdir(exist_ok=True)
URL = 'http://127.0.0.1:4174/'

def check_no_overflow(page):
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'Horizontal overflow'

def ready(page):
    page.goto(URL)
    page.wait_for_selector('#load-status[hidden]', state='attached')
    page.wait_for_selector('.leaflet-container')

def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path='/usr/bin/chromium', headless=True,
                                    args=['--no-sandbox'])
        desktop = browser.new_context(viewport={'width':1440,'height':1080}, accept_downloads=True)
        page = desktop.new_page()
        errors = []
        page.on('pageerror', lambda e: errors.append(str(e)))
        # External tile availability is tested separately; source records remain usable.
        page.route('https://tile.openstreetmap.org/**', lambda route: route.abort())
        ready(page)
        assert page.locator('#result-count').inner_text() == '2,517'
        assert '2,505' in page.locator('#result-map-count').inner_text()
        page.select_option('#district','中正區')
        assert page.locator('#result-count').inner_text() == '369'
        page.fill('#search','中山南路')
        count=int(page.locator('#result-count').inner_text().replace(',',''))
        assert count>0
        page.locator('.point-row button').first.click()
        assert page.locator('.leaflet-popup-content').is_visible()
        assert page.locator('[download], #export-csv, #comparison-export, #comparison-district-export').count() == 0
        page.click('#reset-filters')
        assert page.locator('#result-count').inner_text()=='2,517'
        page.click('[data-year="2024-archive"]')
        assert page.locator('#result-count').inner_text()=='1,971'
        assert '1,969' in page.locator('#result-map-count').inner_text()
        assert '2024-10-19' in page.locator('#dataset-date').inner_text()
        page.select_option('#dataset-version','2024')
        assert page.locator('#result-count').inner_text()=='1,000'
        assert '991' in page.locator('#dataset-note').inner_text()
        page.select_option('#district','信義區')
        assert page.locator('#result-count').inner_text()=='0'
        assert '不能視為' in page.locator('#point-list').inner_text()
        assert page.locator('[download], #export-csv, #comparison-export, #comparison-district-export').count() == 0
        page.reload()
        page.wait_for_selector('#load-status[hidden]', state='attached')
        assert page.locator('#district').input_value()=='信義區'
        assert page.locator('[data-year="2024-archive"]').get_attribute('aria-pressed')=='true'
        assert page.locator('#dataset-version').input_value()=='2024'
        page.click('#reset-filters')
        page.click('[data-year="2022"]')
        assert page.locator('#result-count').inner_text()=='1,799'
        page.click('[data-year="2026-main"]')
        assert page.locator('#result-count').inner_text()=='681'
        assert '680' in page.locator('#result-map-count').inner_text()
        page.select_option('#dataset-version','2026')
        assert page.locator('#result-count').inner_text()=='294'
        page.click('[data-year="2015"]')
        page.fill('#search','武昌街4號')
        assert page.locator('#result-count').inner_text()=='1'
        assert '0 筆可繪製' in page.locator('#result-map-count').inner_text()
        assert page.locator('.point-row button').is_disabled()
        page.click('#reset-filters')
        page.click('[data-page="history"]')
        assert page.locator('#panel-history').is_visible()
        assert page.locator('.timeline-event').count()==11
        page.click('[data-event-filter="removal"]')
        assert page.locator('.timeline-event').count()==2
        assert page.locator('.case-step').count()==4
        page.click('[data-event-filter="all"]')
        page.click('[data-page="sources"]')
        assert page.locator('.source-card').count()==6
        assert page.evaluate("Array.from(document.querySelectorAll('a[href]')).every(a => /^(https?:|#)/i.test(a.getAttribute('href')))"), 'Local attachment anchor remains'
        check_no_overflow(page)
        page.screenshot(path=str(QA/'desktop-sources.png'),full_page=True)
        page.click('[data-page="map"]')
        # Returning from a hidden panel must restore the visible map bounds.
        page.wait_for_function('''() => {
          const c=document.querySelector('.leaflet-overlay-pane canvas');
          if(!c||!c.width||!c.height)return false;
          const a=c.getContext('2d').getImageData(0,0,c.width,c.height).data;
          let pixels=0;for(let i=3;i<a.length;i+=4)if(a[i])pixels++;
          return pixels>1500;
        }''')
        page.screenshot(path=str(QA/'desktop-map.png'),full_page=True)
        check_no_overflow(page)
        assert not errors, errors

        mobile=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,accept_downloads=True)
        phone=mobile.new_page();phone_errors=[]
        phone.on('pageerror',lambda e:phone_errors.append(str(e)))
        phone.route('https://tile.openstreetmap.org/**',lambda route:route.abort())
        ready(phone)
        for panel in ['map','history','sources']:
            phone.click(f'[data-page="{panel}"]')
            assert phone.locator(f'#panel-{panel}').is_visible()
            check_no_overflow(phone)
        phone.click('[data-page="map"]')
        phone.click('[data-year="2024-archive"]')
        phone.select_option('#district','大安區')
        assert phone.locator('#result-count').inner_text()=='229'
        phone.select_option('#dataset-version','2024')
        assert phone.locator('#result-count').inner_text()=='235'
        phone.screenshot(path=str(QA/'mobile-map.png'),full_page=True)
        assert not phone_errors, phone_errors

        failure=desktop.new_page()
        failure_errors=[]
        failure.on('pageerror',lambda e:failure_errors.append(str(e)))
        failure.route('**/data/datasets.json',lambda route:route.fulfill(status=503,body='unavailable'))
        failure.goto(URL)
        failure.wait_for_selector('.load-status.error')
        assert failure.locator('#district').is_disabled()
        assert failure.locator('[download], #export-csv, #comparison-export, #comparison-district-export').count() == 0
        failure.click('[data-page="history"]')
        assert failure.locator('#panel-history').is_visible()
        assert failure.locator('.timeline-event').count()==11
        failure.click('[data-event-filter="removal"]')
        assert failure.locator('.timeline-event').count()==2
        failure.click('[data-page="sources"]')
        assert failure.locator('#panel-sources').is_visible()
        assert not failure_errors, failure_errors
        browser.close()
    print(json.dumps({'desktop':'passed','mobile':'passed','download_controls':'absent',
                      'checks':'versions, coordinate flags, partial coverage, deep links, history filters, unavailable-data navigation',
                      'external_tiles':'intentionally blocked for interaction regression'},ensure_ascii=False))

if __name__=='__main__':
    main()

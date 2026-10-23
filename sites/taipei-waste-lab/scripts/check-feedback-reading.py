"""Check feedback chapters, legacy fragments, history and native disclosures."""
import json
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get('FEEDBACK_QA_URL', 'http://127.0.0.1:4174/research/')
QA = Path(__file__).resolve().parent.parent / 'qa'
CHAPTERS = ('summary', 'districts', 'access', 'removal', 'causes', 'statistics', 'method')


def selected_chapter(page, key):
    expected = 'reader-feedback-' + key
    page.wait_for_function('''id => {
      const items = document.querySelectorAll('.feedback-reader .reader-item:not([hidden])');
      return items.length === 1 && items[0].id === id;
    }''', arg=expected)
    assert page.locator('.feedback-chapters a[aria-current]').get_attribute('href') == '#' + expected
    assert page.locator('#reader-select-feedback').input_value() == expected
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')


def check_viewport(browser, size):
    context = browser.new_context(viewport=size, reduced_motion='reduce')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(URL + '#feedback')
    page.wait_for_selector('#panel-feedback .reader-controls', state='visible')
    selected_chapter(page, 'summary')
    assert page.locator('#reader-select-feedback option').count() == len(CHAPTERS)
    results = {'summaryHeight': page.locator('#panel-feedback').evaluate('(e) => e.scrollHeight'), 'chapters': {}}
    if '--screenshots' in sys.argv:
        QA.mkdir(exist_ok=True)
        page.screenshot(path=str(QA / f'feedback-{size["width"]}.png'), full_page=True)

    for key in CHAPTERS:
        destination = 'reader-feedback-' + key
        if size['width'] > 639:
            page.locator(f'.feedback-chapters a[href="#{destination}"]').click()
        else:
            page.select_option('#reader-select-feedback', destination)
        selected_chapter(page, key)
        results['chapters'][key] = page.locator('#panel-feedback').evaluate('(e) => e.scrollHeight')

    # Deep links select their chapter, reveal any disclosure, and move focus.
    for anchor, key in (
        ('feedback-district-4', 'districts'), ('feedback-access-district-4', 'access'),
        ('feedback-removal-evidence', 'removal'), ('feedback-mechanism-sorting', 'causes'),
        ('feedback-signals', 'statistics'), ('feedback-method', 'method'),
    ):
        page.evaluate('(anchor) => { location.hash = anchor; }', anchor)
        selected_chapter(page, key)
        assert page.locator('#' + anchor).is_visible()
        page.wait_for_function('(id) => document.activeElement?.id === id', arg=anchor)
        assert page.locator('#' + anchor).evaluate('''element => {
          for (let parent = element; parent; parent = parent.parentElement)
            if (parent.matches('details') && !parent.open) return false;
          return true;
        }''')

    page.evaluate('location.hash = "feedback-access-district-4"')
    selected_chapter(page, 'access')
    page.wait_for_function('document.querySelector("#feedback-access-district-4").closest("details").open')
    summary = page.locator('#feedback-access-district-4')
    summary.focus()
    page.keyboard.press('Enter')
    assert not summary.evaluate('(e) => e.closest("details").open')
    page.keyboard.press('Enter')
    assert summary.evaluate('(e) => e.closest("details").open')
    summary.locator('..').get_by_role('link', name='接著看街頭與場域資料').click()
    selected_chapter(page, 'districts')
    page.go_back()
    page.wait_for_function('location.hash === "#feedback-access-district-4"')
    selected_chapter(page, 'access')
    page.reload()
    selected_chapter(page, 'access')
    assert summary.evaluate('(e) => e.closest("details").open')
    assert not errors, errors
    context.close()
    return results


def main():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            executable_path=os.environ.get('CHROME_PATH', '/usr/bin/chromium'),
            headless=True, args=['--no-sandbox'])
        results = {size['width']: check_viewport(browser, size) for size in (
            {'width': 1440, 'height': 1000}, {'width': 390, 'height': 844})}
        # The existing app shell needs JavaScript for routing. Chapter content
        # and links remain in the source HTML if JavaScript is unavailable.
        context = browser.new_context(java_script_enabled=False)
        page = context.new_page()
        page.goto(URL + '#feedback')
        assert page.locator('.feedback-reader .reader-item').count() == len(CHAPTERS)
        assert page.locator('.feedback-reader .reader-item[hidden]').count() == 0
        assert page.locator('.feedback-chapters a').count() == len(CHAPTERS)
        context.close()
        browser.close()
    print(json.dumps(results, ensure_ascii=False))


if __name__ == '__main__':
    main()

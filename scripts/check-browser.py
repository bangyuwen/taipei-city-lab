"""Optional real-browser regression check; requires Python Playwright and Chromium.

External tiles are intentionally blocked here. This checks local rendering
lifecycles and keyboard behavior, not the availability or appearance of OSM.
"""
import argparse
import functools
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from playwright.sync_api import sync_playwright


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--chromium", help="Path to a system Chromium executable")
    parser.add_argument("--dist", type=Path, default=Path(__file__).resolve().parents[1] / "dist")
    args = parser.parse_args()
    handler = functools.partial(QuietHandler, directory=str(args.dist.resolve()))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}/"
    errors = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=args.chromium,
                headless=True,
                args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            )
            context = browser.new_context(viewport={"width": 1440, "height": 1000})
            context.route("https://tile.openstreetmap.org/**", lambda route: route.abort())
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))

            def topic(name):
                page.goto(origin + "#" + name, wait_until="domcontentloaded")
                page.wait_for_function("document.getElementById('loading').hidden")
                page.wait_for_timeout(100)

            topic("bins")
            page.get_by_role("button", name="先增設 5 個", exact=True).click()
            page.wait_for_function("document.getElementById('control-budget').value==='5'")
            page.locator("#viewmode-2d").click()
            page.locator("#viewmode-map").click()
            page.locator("#reset").click()
            table = page.locator("#results .table-scroll")
            table.focus()
            before = table.evaluate("el => el.scrollTop")
            page.keyboard.press("ArrowDown")
            page.wait_for_timeout(150)
            assert table.evaluate("el => el.scrollTop") > before, "Keyboard cannot scroll recommendation details"

            page.locator("#sources-button").focus()
            page.keyboard.press("Enter")
            assert page.locator("#source-dialog").is_visible()
            assert page.locator(".source-entry a svg").count() > 0
            assert "↗" not in page.locator("#method").inner_text()
            page.keyboard.press("Escape")
            assert page.evaluate("document.activeElement.id") == "sources-button", "Dialog focus was not restored"

            page.locator("#viewmode-2d").click()
            for width in (390, 320):
                page.set_viewport_size({"width": width, "height": 844})
                page.wait_for_function("""() => {
                    const svg=document.querySelector('#visualization .chart-svg');
                    return svg.viewBox.baseVal.width<400 && [...svg.querySelectorAll('text')].every(el => {
                        const matrix=el.getScreenCTM();
                        return parseFloat(getComputedStyle(el).fontSize)*Math.hypot(matrix.a,matrix.b)>=12;
                    });
                }""")
                sizes = page.locator("#visualization .chart-grid text").evaluate_all("""elements => elements.map(el => {
                    const matrix=el.getScreenCTM();
                    return parseFloat(getComputedStyle(el).fontSize)*Math.hypot(matrix.a,matrix.b);
                })""")
                assert sizes and min(sizes) >= 12, f"Unreadable chart labels at {width}px: {sizes}"
            topic("traffic")
            page.locator("#viewmode-2d").click()
            page.wait_for_function("document.querySelector('#visualization .chart-svg').viewBox.baseVal.width<400")
            assert page.locator("#visualization .chart-svg").evaluate("""svg => [...svg.querySelectorAll('text')].every(el => {
                const box=el.getBBox(), bounds=svg.viewBox.baseVal;
                return box.x>=0 && box.x+box.width<=bounds.width && box.y>=0 && box.y+box.height<=bounds.height;
            })"""), "Traffic chart labels are clipped on a narrow viewport"
            page.set_viewport_size({"width": 1440, "height": 1000})
            topic("bins")
            page.locator("#viewmode-3d").click()
            page.wait_for_selector("#scene-panel canvas")
            for name in ("shade", "rat", "traffic", "bus", "buildings", "audit", "bins"):
                topic(name)
                if name in ("traffic", "bus"):
                    page.locator("#viewmode-3d").click()
                    page.wait_for_selector("#scene-panel canvas")
                    page.locator("#scene-play").click()
                    page.wait_for_timeout(150)
                    page.locator("#scene-play").click()
            # Allow queued animation callbacks to run after the map transitions.
            page.wait_for_timeout(250)
            assert not errors, "Browser runtime errors: " + "; ".join(errors)
            browser.close()
            print("Browser regression passed: keyboard scroll, dialog focus/icons, responsive chart labels, map/3D lifecycle")
    finally:
        server.shutdown()
        server.server_close()
        thread.join()


if __name__ == "__main__":
    main()

"""Exercise all six standalone sites in a real browser, using local assets.

Requires Python Playwright and Chromium. External map tiles are blocked; this
checks topic isolation, controls, exports, mobile layout and local CSV handling,
not tile-provider availability. The preview server always shuts down on exit.
"""
import argparse
import functools
import json
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil
import threading
from urllib.parse import urlparse

from playwright.sync_api import sync_playwright


SITES = (
    ("shade", "taipei-shade-lab", "樹蔭公平", "budget", "0"),
    ("rat", "taipei-rat-lab", "鼠患源頭治理", "budget", "0"),
    ("traffic", "taipei-traffic-lab", "內湖錯峰通勤", "shift", "0"),
    ("bus", "taipei-bus-lab", "公車接駁與休息", "demand", "0"),
    ("buildings", "taipei-building-lab", "社區健檢排序", "budget", "0"),
    ("audit", "taipei-data-lab", "市政資料健檢", "question", "traffic"),
)
MODULE_TITLES = {"rat":"鼠患巡查與源頭查核", "bus":"一站公車接駁", "buildings":"先健檢哪裡？"}


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


def downloaded_json(download):
    assert download.failure() is None, "Download failed"
    return json.loads(Path(download.path()).read_text(encoding="utf-8-sig"))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parents[1])
    parser.add_argument("--chromium", default=shutil.which("chromium") or shutil.which("chromium-browser"))
    options = parser.parse_args()
    root = options.root.resolve()
    handler = functools.partial(QuietHandler, directory=str(root / "sites"))
    server = ThreadingHTTPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    errors, foreign_assets, requests = [], [], []
    checked = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(
                executable_path=options.chromium,
                headless=True,
                args=["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
            )
            context = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)

            def route_request(route):
                url = route.request.url
                if url.startswith(origin + "/") or url.startswith(("blob:", "data:")):
                    route.continue_()
                else:
                    if not (urlparse(url).hostname or "").endswith("tile.openstreetmap.org"):
                        foreign_assets.append(url)
                    route.abort()

            context.route("**/*", route_request)
            page = context.new_page()
            page.on("pageerror", lambda error: errors.append(str(error)))
            page.on("request", lambda request: requests.append((request.method, request.url)))
            page.on("response", lambda response: errors.append(f"HTTP {response.status}: {response.url}")
                    if response.url.startswith(origin) and response.status >= 400 else None)

            def visit(topic, directory, suffix=""):
                page.goto(f"{origin}/{directory}/dist/{suffix}", wait_until="domcontentloaded")
                page.wait_for_function("document.getElementById('loading')?.hidden === true")
                page.wait_for_selector("#module-head .topic-title")
                assert page.locator(".fatal-error").count() == 0, f"{topic}: failed to initialize"

            for topic, directory, title, key, value in SITES:
                # Start without a hash: a standalone site must pick its own topic.
                visit(topic, directory)
                assert page.locator("#module-head .topic-title").inner_text() == MODULE_TITLES.get(topic, title)
                assert title in page.title(), f"{topic}: wrong document title"
                assert page.locator("#city-intro").is_hidden(), f"{topic}: retained shared seven-topic homepage"
                links = page.locator("#navigation a").evaluate_all("els => els.map(el => el.getAttribute('href'))")
                assert links == [f"#{topic}"], f"{topic}: cross-topic navigation {links}"
                topic_hashes = page.locator("a[href^='#']").evaluate_all("els => els.map(el => el.getAttribute('href').split('?')[0])")
                assert not (set(topic_hashes) & {f"#{item[0]}" for item in SITES if item[0] != topic})
                assert "#bins" not in topic_hashes

                page.locator("#research-workbench").evaluate("el => el.open = true")
                page.locator("#controls details").evaluate_all("els => els.forEach(el => el.open = true)")
                before = page.locator("#metrics").inner_text() + page.locator("#results").inner_text()
                control = page.locator(f"#control-{key}")
                if control.evaluate("el => el.tagName") == "SELECT":
                    control.select_option(value)
                    # The application intentionally listens to input, not change.
                    control.dispatch_event("input")
                else:
                    assert control.get_attribute("min") == value, f"{topic}: expected lower-bound control case"
                    control.focus()
                    control.press("Home")
                page.wait_for_function("""previous => document.getElementById('metrics').innerText +
                    document.getElementById('results').innerText !== previous""", arg=before)
                assert control.input_value() == value
                storage = page.evaluate("key => JSON.parse(localStorage.getItem(key))", directory + "-v1")
                assert str(storage["params"][topic][key]) == value

                page.locator(".research-tools").evaluate("el => el.open = true")
                with page.expect_download() as pending:
                    page.locator("#all-export").click()
                package = downloaded_json(pending.value)
                assert [scenario["id"] for scenario in package["scenarios"]] == [topic]
                assert str(package["scenarios"][0]["params"][key]) == value
                assert package["snapshot"]["topicId"] == topic
                assert "七題" not in package["title"]
                with page.expect_download() as pending:
                    page.locator("#export-csv").click()
                csv = Path(pending.value.path()).read_text(encoding="utf-8-sig")
                assert pending.value.suggested_filename == f"{topic}-scenario.csv"
                assert csv.strip(), f"{topic}: empty CSV export"

                # Unknown hashes cannot activate a module from another site.
                page.evaluate("location.hash = 'not-a-topic'")
                page.wait_for_timeout(150)
                assert page.locator("#module-head .topic-title").inner_text() == MODULE_TITLES.get(topic, title)
                checked.append(topic)

            keys = page.evaluate("Object.keys(localStorage).filter(key => /^taipei-.*-lab-v1$/.test(key)).sort()")
            assert keys == sorted(directory + "-v1" for _, directory, *_ in SITES), f"Storage namespaces overlap: {keys}"
            visit("shade", "taipei-shade-lab")
            assert page.locator("#control-budget").input_value() == "0", "Other sites overwrote the saved shade scenario"

            # Check an actual uploaded CSV on mobile, including its exported audit.
            page.set_viewport_size({"width": 390, "height": 844})
            visit("audit", "taipei-data-lab")
            page.locator("#sources-button").click()
            assert page.locator("#source-dialog").is_visible()
            source_text = page.locator("#source-body").inner_text()
            audit_snapshot = json.loads((root / "sites/taipei-data-lab/dist/data/snapshot.json").read_text(encoding="utf-8"))
            original_loaded = sum(source["integrationStatus"] == "loaded" for source in audit_snapshot["sources"].values())
            assert original_loaded > 0, "Regression fixture must retain original loaded-source metadata"
            assert source_text.count("原題已載入觀測；本站僅保存目錄") == original_loaded
            assert "已載入觀測快照" not in source_text, "Catalogue-only site claims to load another topic’s observations"
            page.locator("#close-sources").click()
            page.locator("#csv-text").fill("id,updated_at,lat,lon\nA,2026-10-13,25.04,121.54\nA,2026-10-13,25.04,121.54\nB,2020-01-01,,121.55")
            page.locator("#audit-question").fill("確認資料格式與重複列")
            page.locator("#audit-date").fill("2026-10-13")
            page.locator("#run-audit").click()
            page.wait_for_function("document.getElementById('audit-report').innerText.includes('3 列')")
            with page.expect_download() as pending:
                page.locator("#export-audit").click()
            report = downloaded_json(pending.value)
            assert report["rowCount"] == 3 and report["duplicateCount"] == 1
            assert report["request"]["question"] == "確認資料格式與重複列"
            assert report["request"]["timezone"] == "Asia/Taipei"
            assert report["request"]["referenceDate"] == "2026-10-13"
            profiles = report.get("profiles", report.get("profile", []))
            assert any(item["name"] == "lat" and item["missingCount"] == 1 for item in profiles), "CSV missing value was lost"
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth + 1"), "Mobile page overflows horizontally"
            assert page.locator("#module-head .topic-title").is_visible()
            assert not [entry for entry in requests if entry[0] not in ("GET", "HEAD")], "CSV content must stay in the browser"
            assert not foreign_assets, "Non-local application assets: " + "; ".join(foreign_assets)
            assert not errors, "Browser failures: " + "; ".join(errors)
            browser.close()
            print(json.dumps({"status":"passed", "desktopTopics":checked, "mobile":"audit/390px", "csvAuditRows":3,
                              "checks":["own title/navigation", "control recalculation", "isolated storage", "JSON/CSV exports", "catalogue-only source disclosure", "local assets", "no runtime errors"]}, ensure_ascii=False))
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()

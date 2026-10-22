"""Publish the two-entry site from explicit research and demo runtime assets."""
import hashlib
import json
import runpy
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEMO_ASSETS = (
    'index.html', 'pedestrian.html', 'planning.html', 'crew.html', 'crew-route.html',
    'config.js', 'common.js', 'cloud.js', 'ui.js', 'ui.css', 'common.css', 'tokens.css',
    'bin-category.js', 'bin-icons.js', 'scenario.js', 'forecast.js', 'crew-list.js', 'routing.js', 'nav.js',
    'bins.geojson', 'youbike.geojson', 'busstops_taipei.geojson', 'footfall_hourly.json',
    'roads_walk.json', 'roads_drive.json', 'mrt_stations.json', 'survey_candidates.json',
    'anchors.json', 'assets/favicon.svg', 'assets/apple-touch-icon.png', 'assets/logo.svg',
    'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css',
    'vendor/leaflet/images/layers.png', 'vendor/leaflet/images/layers-2x.png',
    'vendor/leaflet/images/marker-icon.png', 'vendor/leaflet/images/marker-icon-2x.png',
    'vendor/leaflet/images/marker-shadow.png',
)
LEGACY_PAGES = ('siting-overlay.html', 'field-checklist.html',
                'design-thinking/index.html', 'prd/index.html')


def read_source(path):
    if any(p.is_symlink() for p in (path, *path.parents)):
        raise ValueError(f'Public input must not be a symlink: {path}')
    if not path.is_file():
        raise FileNotFoundError(f'Missing portal input: {path}')
    return path.read_bytes()


def redirect_page(target):
    # Targets are fixed application paths, never URL input.
    return ('<!doctype html><html lang="zh-Hant"><meta charset="utf-8">'
            '<meta name="viewport" content="width=device-width,initial-scale=1">'
            '<title>前往研究頁面</title>'
            f'<script>location.replace({json.dumps(target)}+location.search+location.hash)</script>'
            f'<p>頁面已移至<a href="{target}">研究與證據</a>。</p></html>').encode()


def publication_files():
    assets = runpy.run_path(str(ROOT / 'scripts/prepare-public.py'))['ASSETS']
    files = {f'research/{name}': read_source(ROOT / 'out' / name) for name in assets}
    for name in DEMO_ASSETS:
        files['demo/' + name] = read_source(ROOT.parent / 'youtong' / name)
    for name in ('index.html', 'portal.css', 'portal.js'):
        files[name] = read_source(ROOT / 'templates/portal' / name)
    for name in ('research-nav.js', 'research-nav.css'):
        files['research/' + name] = read_source(ROOT / 'templates/portal' / name)
    html = files['research/index.html'].decode()
    html = html.replace('</head>', '<link rel="stylesheet" href="research-nav.css">'
                        '<script src="research-nav.js" defer></script></head>', 1)
    files['research/index.html'] = html.encode()
    # Both copies consume the same canonical decision plan; no candidate becomes a visit.
    canonical = ROOT.parents[1] / 'topics/bins/research/decision-checks-2026-10-22/checks.json'
    source = canonical if canonical.is_file() else ROOT / 'research/decision-checks-2026-10-22/checks.json'
    raw = read_source(source)
    plan = json.loads(raw)
    if plan['status'] != 'proposed_not_started' or plan['district_quota'] is not None or plan['scheduled_visits']:
        raise ValueError('Demo summary must be revised before publishing a changed field-plan status')
    summary = {key: plan[key] for key in ('date', 'status', 'selection_rule', 'district_quota', 'scheduled_visits')}
    summary['sourceSHA256'] = hashlib.sha256(raw).hexdigest()
    summary['researchPath'] = '../research/#plan'
    files['demo/current-plan.json'] = (json.dumps(summary, ensure_ascii=False, indent=2) + '\n').encode()
    for name in LEGACY_PAGES:
        prefix = '../' * (len(Path(name).parts) - 1)
        files[name] = redirect_page(prefix + 'research/' + name)
    return files


def prepare():
    # Validate every source before replacing the existing generated publication.
    files = publication_files()
    output = ROOT / 'public'
    if output.is_symlink() or (output.exists() and not output.is_dir()):
        raise ValueError('Unsafe portal output root')
    if output.exists():
        if any(path.is_symlink() for path in output.rglob('*')):
            raise ValueError('Portal output contains a symlink')
        shutil.rmtree(output)
    output.mkdir()
    for name, content in files.items():
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    print(f'Published {len(files)} runtime files: /, /research/, /demo/')


if __name__ == '__main__':
    prepare()

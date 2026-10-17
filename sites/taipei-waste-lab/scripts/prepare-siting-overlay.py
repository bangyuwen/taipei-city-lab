"""Build the standalone, display-only siting overlay from private inputs."""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / 'templates/siting-overlay.html'
DISPLAY_DATA = ROOT / 'data/siting-overlay.json'
LEAFLET_DIR = ROOT / 'dist/vendor/leaflet'
OUTPUT = ROOT / 'dist/siting-overlay.html'
TOKENS = ('__LEAFLET_CSS__', '__LEAFLET_JS__', '__OVERLAY_JSON__')


def read_text(path):
    if path.is_symlink() or not path.is_file():
        raise FileNotFoundError(f'Required siting-overlay input is missing or unsafe: {path.relative_to(ROOT)}')
    return path.read_text(encoding='utf-8')


def build():
    template = read_text(TEMPLATE)
    snapshot = read_text(DISPLAY_DATA)
    leaflet_css = read_text(LEAFLET_DIR / 'leaflet.css')
    leaflet_js = read_text(LEAFLET_DIR / 'leaflet-src.esm.js')
    leaflet_license = read_text(LEAFLET_DIR / 'LICENSE').rstrip()

    data = json.loads(snapshot)
    if len(data.get('candidates', {}).get('features', [])) != 425:
        raise ValueError('Expected 425 candidate groups in the fixed display snapshot')
    if len(data.get('layers', [])) != 5:
        raise ValueError('Expected five historical snapshot layers')
    if '</script' in snapshot.lower() or '</script' in leaflet_js.lower():
        raise ValueError('An inline HTML script-closing sequence is present in an input')
    if '*/' in leaflet_license:
        raise ValueError('Leaflet license cannot be represented safely in a CSS comment')

    css_with_license = f'/* Leaflet license\n{leaflet_license}\n*/\n{leaflet_css}'
    replacements = {
        '__LEAFLET_CSS__': css_with_license,
        '__LEAFLET_JS__': leaflet_js,
        '__OVERLAY_JSON__': snapshot,
    }
    page = template
    for token in TOKENS:
        if page.count(token) != 1:
            raise ValueError(f'Expected exactly one template token: {token}')
        page = page.replace(token, replacements[token])
    if any(token in page for token in TOKENS):
        raise ValueError('An unexpanded template token remains')
    if 'inventory.html' in page or re.search(r'<a\b[^>]*\bdownload(?:\s|=|>)', page, re.I):
        raise ValueError('The public overlay must not expose inventory or download controls')
    if '<a href="./#siting" target="_top">' not in page:
        raise ValueError('The standalone return link must target the siting section')
    if "event.source!==window.parent||event.origin!==location.origin" not in page:
        raise ValueError('Parent messages must be restricted to the same-origin embedding parent')
    if "},location.origin)" not in page or "},'*')" in page:
        raise ValueError('Frame messages must target the same origin')

    OUTPUT.write_text(page, encoding='utf-8')
    print(f'Built {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)')


if __name__ == '__main__':
    build()

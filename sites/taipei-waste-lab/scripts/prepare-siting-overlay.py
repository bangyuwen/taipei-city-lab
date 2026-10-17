"""Build the standalone, display-only siting overlay from private inputs."""
import json
from html import escape
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
TEMPLATE = ROOT / 'templates/siting-overlay.html'
DISPLAY_DATA = ROOT / 'data/siting-overlay.json'
PRIORITY_DATA = ROOT / 'data/field-priorities.json'
LEAFLET_DIR = ROOT / 'dist/vendor/leaflet'
OUTPUT = ROOT / 'dist/siting-overlay.html'
TOKENS = ('__LEAFLET_CSS__', '__LEAFLET_JS__', '__OVERLAY_JSON__')


def build_checklist(priorities):
    """Render the same desktop judgments as the map, without raw attachments."""
    sheets, index = [], []
    levels = {item['id']: item['label'] for item in priorities['classification']['priorityLevels']}
    confidence = {item['id']: item['label'] for item in priorities['classification']['confidenceLevels']}
    sources = {item['id']: item for item in priorities['sources']}
    for number, site in enumerate(priorities['sites'], 1):
        item = {key: escape(site[key]) for key in ('id', 'name', 'priority', 'confidence', 'priorityReason', 'confidenceReason', 'uncertainty', 'decision')}
        evidence = ''.join(f'<li>{escape(value)}</li>' for value in site['evidence'])
        references = ''.join(f'<li><a href="{escape(sources[key]["url"], quote=True)}" target="_blank" rel="noopener">{escape(sources[key]["title"])}</a> · {escape(sources[key]["date"])}</li>' for key in site['demand_sources'])
        index.append(f'<li data-site="{item["id"]}"><a href="#{item["id"]}">{escape(levels[site["priority"]])} · {item["name"]}</a></li>')
        sheets.append(f'''<article class="sheet" id="{item['id']}" data-priority="{item['priority']}" aria-labelledby="title-{item['id']}">
<div class="sheet-heading"><span>台北垃圾箱研究 · 資料判讀表</span><span>{item['id']} · <span class="page-number">{number:02d} / 10</span></span></div>
<h2 id="title-{item['id']}">{item['name']}</h2>
<div class="assessment-grades"><p>新增評估優先度 <strong class="badge {item['priority']}">{escape(levels[site['priority']])}</strong></p><p>資料可信度 <strong class="confidence">{escape(confidence[site['confidence']])}</strong></p></div>
<p class="scope">純資料評估 · 保存資料整理日 {escape(priorities['asOf'])} · 不代表今日現況或核准設置</p>
<section><h3>推薦理由</h3><p class="reason">{item['priorityReason']}</p></section>
<section><h3>資料可信度的理由</h3><p class="confidence-reason">{item['confidenceReason']}</p></section>
<section><h3>資料依據</h3><ol class="evidence">{evidence}</ol></section>
<section><h3>判讀限制</h3><p class="uncertainty">{item['uncertainty']}</p></section>
<section class="conclusion"><h3>目前建議</h3><p class="decision">{item['decision']}</p></section>
<section class="sources"><h3>保存時引用的官方來源</h3><ul>{references}</ul></section>
<footer class="sheet-footer"><p>優先度指新增的研究順序；可信度指資料互證程度，兩者不是同一件事。未計算加權分數，同級不細排名，這 10 處也不是全市前十名。</p><p>2.77 是本案假設，並非法定門檻；寬度單位未核實。缺列不代表撤桶，近點不代表可用供給；未取得的需求與營運條件保留未知。</p></footer>
</article>''')
    page = read_text(ROOT / 'templates/field-checklist.html')
    for token, content in {'__CHECKLIST_INDEX__': ''.join(index), '__CHECKLIST_SHEETS__': '\n'.join(sheets)}.items():
        if page.count(token) != 1:
            raise ValueError(f'Expected exactly one checklist token: {token}')
        page = page.replace(token, content)
    output = ROOT / 'dist/field-checklist.html'
    output.write_text(page, encoding='utf-8')
    print(f'Built {output.relative_to(ROOT)} (10 desktop assessments)')


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
    priorities = json.loads(read_text(PRIORITY_DATA))
    sites = priorities.get('sites', [])
    candidate_ids = {f['properties']['id'] for f in data['candidates']['features']}
    if len(sites) != 10 or len({s['id'] for s in sites}) != 10:
        raise ValueError('Expected ten distinct desktop assessments')
    if sorted(s['priority'] for s in sites) != ['hold'] * 4 + ['lower'] * 5 + ['review']:
        raise ValueError('Expected one first-review, five lower and four held assessments')
    if sorted(s['confidence'] for s in sites) != ['low'] * 3 + ['medium'] * 7:
        raise ValueError('Expected seven medium and three low confidence assessments')
    if any(s['id'] not in candidate_ids for s in sites):
        raise ValueError('Priority must refer to a preserved candidate polygon')
    # This is a curated display input, never the raw research package.
    if set(priorities) != {'asOf', 'status', 'definition', 'classification', 'limits', 'sites', 'sources'}:
        raise ValueError('Unexpected public priority fields')
    site_fields = {'id', 'priority', 'confidence', 'name', 'uncertainty', 'evidence', 'decision', 'demand_sources', 'priorityReason', 'confidenceReason'}
    classification = priorities['classification']
    if set(classification) != {'criteria', 'priorityLevels', 'confidenceLevels', 'limits'}:
        raise ValueError('Unexpected classification display fields')
    for key in ('criteria', 'limits'):
        if not isinstance(classification[key], list) or not classification[key] or any(not isinstance(item, str) or not item.strip() for item in classification[key]):
            raise ValueError('Classification explanation must contain readable text')
    for key, expected in [('priorityLevels', ['review', 'lower', 'hold']), ('confidenceLevels', ['medium', 'low'])]:
        levels = classification[key]
        if [item['id'] for item in levels] != expected or any(set(item) != {'id', 'label', 'description'} for item in levels):
            raise ValueError('Unexpected assessment level definitions')
        if any(not isinstance(item[field], str) or not item[field].strip() for item in levels for field in ('label', 'description')):
            raise ValueError('Assessment levels require labels and descriptions')
    source_ids = {s['id'] for s in priorities['sources']}
    for site in sites:
        if set(site) != site_fields or len(site['evidence']) != 3:
            raise ValueError('Unexpected priority detail fields')
        for value in [site['priorityReason'], site['confidenceReason'], site['uncertainty'], site['decision'], *site['evidence']]:
            if not isinstance(value, str) or not value.strip():
                raise ValueError('Every assessment requires readable reasons, evidence and limits')
        if not set(site['demand_sources']) <= source_ids:
            raise ValueError('Missing priority evidence source')
    if any(set(source) != {'id', 'title', 'url', 'date'} for source in priorities['sources']):
        raise ValueError('Unexpected priority source fields')
    data['fieldPriorities'] = priorities
    snapshot = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
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
    build_checklist(priorities)
    print(f'Built {OUTPUT.relative_to(ROOT)} ({OUTPUT.stat().st_size:,} bytes)')


if __name__ == '__main__':
    build()

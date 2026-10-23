"""Render a dated decision case from retained evidence, without new observations."""
import hashlib
import html
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SITE = ROOT.parents[1]
if (ROOT.parents[3] / 'sites/taipei-waste-lab').is_dir():
    SITE = ROOT.parents[3] / 'sites/taipei-waste-lab'


def build():
    manifest = json.loads((ROOT / 'inputs.json').read_text())
    for source in manifest['sources']:
        content = (ROOT / source['path']).read_bytes()
        if hashlib.sha256(content).hexdigest() != source['sha256']:
            raise ValueError(f"Case input changed; retain a new dated revision: {source['path']}")
    result = json.loads((ROOT / '../station-venue-recheck-2026-10-22/results.json').read_text())
    station = next(row for row in result['stations'] if row['station'] == '中山')
    venue = next(row for row in result['original_venue_records'] if row['地址'] == '中山捷運站')
    nearest = station['nearest_street_record']
    values = {
        'exit_count': station['exit_count'],
        'rows_300': station['rechecked_street_rows']['300'],
        'rows_500': station['rechecked_street_rows']['500'],
        'venue_row': venue['source_csv_row'],
        'venue_district': venue['行政區'],
        'venue_name': venue['地址'],
        'venue_note': venue['備註'],
        'street_address': nearest['地址'],
        'nearest_exit': nearest['nearest_exit'],
        'distance_m': f"{nearest['distance_m']:.1f}",
        'street_row': nearest['source_csv_row'],
        'street_total': result['street_source_rows'],
        'valid_total': result['street_valid_coordinate_rows'],
    }
    page = (ROOT / 'page.html').read_text()
    for key, value in values.items():
        page = page.replace('{{' + key + '}}', html.escape(str(value), quote=True))
    if '{{' in page:
        raise ValueError('Unresolved case template field')

    index = SITE / 'dist/index.html'
    current = index.read_text()
    start = '<!-- zhongshan-placement-case:start -->'
    end = '<!-- zhongshan-placement-case:end -->'
    entry = (start + '\n<p><a href="cases/zhongshan.html">'
             '中山站配置決策案例：用已有資料走一次保留、調整與增設的判斷'
             '</a>；預算與現場缺口逐項標示。</p>\n' + end)
    if start in current:
        pattern = re.escape(start) + r'.*?' + re.escape(end)
        if len(re.findall(pattern, current, flags=re.S)) != 1:
            raise ValueError('Case link markers must form exactly one block')
        current = re.sub(pattern, lambda _: entry, current, flags=re.S)
    else:
        pattern = r'(<h4\b[^>]*\bid="method-venue-zhongshan"[^>]*>.*?</h4>)'
        if len(re.findall(pattern, current, flags=re.S)) != 1:
            raise ValueError('Expected exactly one Zhongshan source heading')
        current = re.sub(pattern, lambda match: match[1] + '\n' + entry, current, flags=re.S)

    output = SITE / 'dist/cases/zhongshan.html'
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(page)
    index.write_text(current)
    print('Rendered Zhongshan decision case and source-page entry.')


if __name__ == '__main__':
    build()

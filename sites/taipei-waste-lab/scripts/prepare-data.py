"""Preserve saved source records; never interpret an absent row as a removal."""
import collections
import csv
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'dist/data'
CANONICAL_RESEARCH = ROOT.parent.parent / 'topics/bins/research'
RECOVERY = ROOT / 'research/source-recovery-2026-10-15'
HISTORY_FILES = (
    'taipei-bins-2015-districts.csv',
    'taipei-bins-2015.csv',
    'taipei-bins-2015.geojson',
    'taipei-bins-2015.provenance.json',
    'taipei-bins-2022.csv',
    'taipei-bins-2024-05-14-partial.csv',
    'taipei-bins-2024-05-14-partial.provenance.json',
    'taipei-bins-2026-study-area.csv',
    'taipei-bins-2026-study-area.provenance.json',
)
RESEARCH_FILES = (
    'bin-reduction.md', 'bin-removal-history.md',
    'global-bin-practices.md', 'bin-design.md',
)
DISTRICTS = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區']
OFFICIAL = 'https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c'

def prepare_sources():
    """Package canonical inputs for the site and private offline research bundle.

    In this monorepo only topics/bins is edited by hand. data/history and
    data/research are generated source packages for a standalone site checkout;
    dist is never a build input. The research bundle has the same ownership.
    """
    topic = ROOT.parent.parent / 'topics/bins'
    packaged = ROOT / 'data'
    source = topic / 'data/history' if topic.is_dir() else packaged / 'history'
    research = topic / 'docs' if topic.is_dir() else packaged / 'research'

    # Validate every required input before replacing any generated files.
    history_bytes = {name: (source / name).read_bytes() for name in HISTORY_FILES}
    research_bytes = {name: (research / name).read_bytes() for name in RESEARCH_FILES}
    if topic.is_dir():
        # This is a generated standalone copy; the canonical tree is untouched.
        if (ROOT / 'research').exists():
            shutil.rmtree(ROOT / 'research')
        shutil.copytree(CANONICAL_RESEARCH, ROOT / 'research',
                        ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for directory in (packaged / 'history', packaged / 'research',
                      DEST):
        directory.mkdir(parents=True, exist_ok=True)
    for name, content in history_bytes.items():
        (packaged / 'history' / name).write_bytes(content)
        (DEST / name).write_bytes(content)
    for name, content in research_bytes.items():
        (packaged / 'research' / name).write_bytes(content)

def source_rows(path):
    with path.open(encoding='utf-8-sig', newline='') as f:
        return list(csv.DictReader(f))

def point(row, index, key):
    try:
        x, y = float(row['經度']), float(row['緯度'])
    except (ValueError, TypeError):
        x, y = None, None
    plottable = x is not None and y is not None and 121.4 < x < 121.7 and 24.95 < y < 25.3
    road = row.get('路名', '')
    other = row.get('段、號及其他註明', row.get('段號及其他註明', ''))
    address = row.get('地址') or (other if road and other.startswith(road) else road + other)
    return {'id': f'{key}-row-{index + 1}', 'district': row['行政區'], 'address': address,
            'x': x, 'y': y, 'plottable': plottable,
            'rawX': row['經度'], 'rawY': row['緯度'],
            'quality': '通過座標粗篩，尚未逐點核實' if plottable else '座標待核對，保留原始紀錄'}

def main():
    prepare_sources()
    # Retain the prior downloads and import the two frozen recovery snapshots.
    # Rebuilding never fetches current data or imports another project's data.
    manifest = json.loads((RECOVERY / 'manifest.json').read_text())
    for snapshot in manifest['snapshots'][:2]:
        name = snapshot['file']
        payload = (RECOVERY / name).read_bytes()
        if hashlib.sha256(payload).hexdigest() != manifest['files'][name]['sha256']:
            raise ValueError(f'Recovery input hash mismatch: {name}')
        (DEST / name).write_bytes(payload)
    for snapshot in manifest['snapshots'][:2]:
        provenance = {**snapshot, 'observedDate': manifest['observed_date'],
                      'sha256': manifest['files'][snapshot['file']]['sha256'],
                      'limitations': '完整取得公開檔案，不代表已核實全市現場清冊完整性。',
                      'sourceManifest': '../research/source-recovery-2026-10-15/manifest.json'}
        provenance['raw_file'] = '../research/source-recovery-2026-10-15/' + snapshot['raw_file']
        if 'archive_cdx' in snapshot:
            provenance['archive_cdx'] = '../research/source-recovery-2026-10-15/' + snapshot['archive_cdx']
        (DEST / snapshot['file'].replace('.csv', '.provenance.json')).write_text(
            json.dumps(provenance, ensure_ascii=False, indent=2) + '\n')
    source2026 = json.loads((DEST / 'taipei-bins-2026-study-area.provenance.json').read_text())

    definitions = [
        {'key': '2015', 'year': '2015', 'label': '2015 保存資料', 'short': '12 區保存紀錄',
         'file': 'taipei-bins-2015.csv', 'savedAt': '2015-10-31', 'complete': None,
         'dateLabel': '2015-10-31 保存；原調查日期未知',
         'source': 'https://github.com/wagamama/tourist-map/tree/3ec132bf03fd029cd80c191d991c52fa2c7c3ec0',
         'sourceLabel': '2015 固定版本原始資料',
         'note': '保存了 12 區的 2,517 筆紀錄，尚未核實完整性；並非三千組時的完整清冊。相同座標全部保留，12 筆座標待核對。'},
        {'key': '2022', 'year': '2022', 'label': '2022 保存資料', 'short': '12 區保存紀錄',
         'file': 'taipei-bins-2022.csv', 'savedAt': '2022-09-01', 'complete': None,
         'dateLabel': '2022-09-01 保存；原調查日期未知',
         'source': 'https://github.com/roto93/react-taipei-trash-can/blob/a4d1a32ceb8155134a185dca0c07837da659436a/pages/api/hello.js',
         'sourceLabel': '2022 固定版本原始資料',
         'note': '保存了 12 區的 1,799 筆紀錄，尚未核實完整性。保存日期不等於清潔箱實際設置或撤除日期。'},
        {'key': '2024-archive', 'year': '2024', 'label': '2024 年 10 月封存版', 'short': '10月封存・12區',
         'file': 'taipei-bins-2024-10-18-archive-utc.csv', 'savedAt': '2024-10-19',
         'complete': None, 'completeDownload': True,
         'dateLabel': '2024-10-19 05:17 台北時間封存（UTC 10-18 21:17）；原調查／更新日期未知',
         'source': 'https://web.archive.org/web/20241018211732id_/https://data.taipei/api/dataset/a835f3ba-7f50-4b0d-91a6-9df128632d1c/resource/267d550f-c6ec-46e0-b8af-fd5a464eb098/download',
         'sourceLabel': '官方 CSV 封存原檔',
         'note': '完整取得封存回應 1,971 筆，涵蓋 12 區；全市現場完整性未核實，2 筆座標待核對。這是另一份 10 月快照，不能回填成 5 月的 1,991 筆；5 月缺的 991 筆仍未找回。'},
        {'key': '2024', 'year': '2024', 'label': '2024 年 5 月缺頁版（舊版）', 'short': '5月缺頁・舊版',
         'preferred': False,
         'file': 'taipei-bins-2024-05-14-partial.csv', 'savedAt': '2024-06-18', 'complete': False,
         'dateLabel': '2024-06-18 保存；系統匯入日 2024-05-14',
         'source': 'https://github.com/wer53077n/Cleaning-Box/blob/82475ba3659e1c2320efc87dcdfb5685aff015a0/TPcleaningBox.json',
         'sourceLabel': '2024 固定版本 API 回應',
         'reportedTotal': 1991,
         'note': '原 API 回報 1,991 筆，這份副本只有前 1,000 筆，少了 991 筆與其餘行政區。缺列不代表垃圾箱被撤除。'},
        {'key': '2026-main', 'year': '2026', 'label': '2026 官方公開主檔', 'short': '官方公開主檔',
         'file': 'taipei-bins-2026-09-30-published.csv', 'savedAt': '2026-10-15',
         'complete': None, 'completeDownload': True,
         'dateLabel': '2026-09-30 來源更新；2026-10-15 下載；原調查日期未知',
         'source': OFFICIAL, 'sourceLabel': '官方清潔箱資料集',
         'note': '保留官方主檔全部 681 筆，未裁切示範區；CSV 與 API 一致，非分頁漏抓。目錄仍列 2,009 筆；北投區 0 筆、南港區 4 筆，不能視為當地沒有垃圾箱。全市現場完整性未核實，1 筆座標待核對。'},
        {'key': '2026', 'year': '2026', 'label': '2026 中心示範區（舊版）', 'short': '中心示範區・舊版',
         'preferred': False,
         'file': 'taipei-bins-2026-study-area.csv', 'savedAt': '2026-10-13', 'complete': False,
         'dateLabel': '2026-10-13 下載；來源 CSV 更新日 2026-09-30',
         'source': OFFICIAL, 'sourceLabel': '官方清潔箱資料集',
         'bbox': source2026['snapshot_metadata']['bbox'],
         'note': '目前載入中心示範框 294 筆，並非全市。原下載表有 681 列、680 列座標有效；資料目錄筆數不能視為實際存量。'}
    ]
    datasets = []
    for definition in definitions:
        definition.setdefault('preferred', True)
        definition['coverageLabel'] = ('僅示範區' if definition.get('bbox') else
                                       '已知缺頁' if definition['complete'] is False else '全市完整性未核實')
        provenance = definition['file'].replace('.csv', '.provenance.json')
        if (DEST / provenance).exists():
            definition['provenanceFile'] = provenance
        path = DEST / definition['file']
        rows = source_rows(path)
        points = [point(r, i, definition['key']) for i, r in enumerate(rows)]
        counts = collections.Counter(p['district'] for p in points)
        definition.update({'rows': len(rows), 'plottableRows': sum(p['plottable'] for p in points),
                           'distinctCoordinates': len({(p['x'], p['y']) for p in points if p['x'] is not None}),
                           'districts': {d: counts.get(d, 0) for d in DISTRICTS},
                           'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'points': points})
        datasets.append(definition)
    payload = {'updatedAt': '2026-10-15', 'districtOrder': DISTRICTS, 'datasets': datasets,
               'officialSource': OFFICIAL,
               'identityNote': '各列 id 僅供本站操作，不是官方箱號，不可跨年識別同一垃圾箱。'}
    (DEST / 'datasets.json').write_text(json.dumps(payload, ensure_ascii=False, separators=(',', ':')) + '\n')
    assert [d['rows'] for d in datasets] == [2517, 1799, 1971, 1000, 681, 294]
    assert datasets[0]['plottableRows'] == 2505
    print(json.dumps([{'key': d['key'], 'rows': d['rows'], 'mapRows': d['plottableRows']} for d in datasets]))
    subprocess.run([sys.executable, str(ROOT / 'scripts/compare-snapshots.py')], check=True)
    subprocess.run([sys.executable, str(ROOT / 'scripts/analyze-coordinate-distances.py')], check=True)
    for script in ['prepare-research-execution.py', 'estimate-budget.py', 'package-research.py']:
        subprocess.run([sys.executable, str(ROOT / 'scripts' / script)], check=True)

    subprocess.run([sys.executable, str(ROOT / 'scripts/prepare-siting-overlay.py')], check=True)
    subprocess.run([sys.executable, str(ROOT / 'scripts/prepare-public.py')], check=True)

if __name__ == '__main__':
    main()

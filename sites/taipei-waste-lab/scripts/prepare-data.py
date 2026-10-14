"""Preserve saved source records; never interpret an absent row as a removal."""
import collections
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEST = ROOT / 'dist/data'
DISTRICTS = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區', '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區']
OFFICIAL = 'https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c'

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
            'quality': '通過座標粗篩，尚未逐點核實' if plottable else '座標待核對，保留原始紀錄'}

def main():
    # All four preserved CSVs and their source information belong to this site.
    # Rebuilding never imports another project's datasets or generates demand.
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
        {'key': '2024', 'year': '2024', 'label': '2024 部分資料', 'short': '只保存前 1,000 筆',
         'file': 'taipei-bins-2024-05-14-partial.csv', 'savedAt': '2024-06-18', 'complete': False,
         'dateLabel': '2024-06-18 保存；系統匯入日 2024-05-14',
         'source': 'https://github.com/wer53077n/Cleaning-Box/blob/82475ba3659e1c2320efc87dcdfb5685aff015a0/TPcleaningBox.json',
         'sourceLabel': '2024 固定版本 API 回應',
         'reportedTotal': 1991,
         'note': '原 API 回報 1,991 筆，這份副本只有前 1,000 筆，少了 991 筆與其餘行政區。缺列不代表垃圾箱被撤除。'},
        {'key': '2026', 'year': '2026', 'label': '2026 示範範圍', 'short': '中心示範框 294 筆',
         'file': 'taipei-bins-2026-study-area.csv', 'savedAt': '2026-10-13', 'complete': False,
         'dateLabel': '2026-10-13 下載；來源 CSV 更新日 2026-09-30',
         'source': OFFICIAL, 'sourceLabel': '官方清潔箱資料集',
         'bbox': source2026['snapshot_metadata']['bbox'],
         'note': '目前載入中心示範框 294 筆，並非全市。原下載表有 681 列、680 列座標有效；資料目錄筆數不能視為實際存量。'}
    ]
    datasets = []
    for definition in definitions:
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
    assert [d['rows'] for d in datasets] == [2517, 1799, 1000, 294]
    assert datasets[0]['plottableRows'] == 2505
    print(json.dumps([{'key': d['key'], 'rows': d['rows'], 'mapRows': d['plottableRows']} for d in datasets]))

if __name__ == '__main__':
    main()

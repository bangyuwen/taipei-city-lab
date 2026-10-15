"""Verify the frozen recovery bundle offline; retain every source record."""
import base64
import collections
import csv
import hashlib
import io
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FIELDS = ['行政區', '地址', '經度', '緯度', '備註']
DISTRICTS = ['中正區', '大同區', '中山區', '松山區', '大安區', '萬華區',
             '信義區', '士林區', '北投區', '內湖區', '南港區', '文山區']


def csv_rows(path, encoding):
    text = path.read_bytes().decode(encoding)
    reader = csv.DictReader(io.StringIO(text))
    assert reader.fieldnames == FIELDS, (path.name, reader.fieldnames)
    return list(reader)


def record(row):
    # Trimming applies only to comparison keys, never to saved CSV values.
    return tuple(str(row[field]).strip() for field in FIELDS)


def profile(rows):
    counts = collections.Counter(row['行政區'] for row in rows)
    assert set(counts) <= set(DISTRICTS), counts
    invalid, outside, coordinates = [], [], []
    for line, row in enumerate(rows, 2):
        try:
            x, y = float(row['經度']), float(row['緯度'])
            valid = math.isfinite(x) and math.isfinite(y) and 119 < x < 123 and 21 < y < 27
        except (ValueError, TypeError):
            valid = False
        if not valid:
            invalid.append({'csv_line': line, **row})
            continue
        coordinates.append((x, y))
        if not (121.4 < x < 121.7 and 24.95 < y < 25.3):
            outside.append({'csv_line': line, **row})
    return {
        'rows': len(rows),
        'district_counts': {district: counts.get(district, 0) for district in DISTRICTS},
        'finite_taiwan_coordinate_rows': len(coordinates),
        'rough_taipei_coordinate_rows': len(coordinates) - len(outside),
        'invalid_coordinates': invalid,
        'outside_rough_taipei_rectangle': outside,
        'duplicate_numeric_coordinate_records': len(coordinates) - len(set(coordinates)),
        'exact_duplicate_rows': len(rows) - len({tuple(row[field] for field in FIELDS) for row in rows}),
        'empty_fields': {field: sum(not row[field].strip() for row in rows) for field in FIELDS},
    }


def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    for name, expected in manifest['files'].items():
        payload = (ROOT / name).read_bytes()
        assert len(payload) == expected['bytes'], name
        assert hashlib.sha256(payload).hexdigest() == expected['sha256'], name

    profiles, records = {}, {}
    for snapshot in manifest['snapshots']:
        original = csv_rows(ROOT / snapshot['raw_file'], 'cp950')
        exported = csv_rows(ROOT / snapshot['file'], 'utf-8-sig')
        assert original == exported, snapshot['file']
        profiles[snapshot['file']] = profile(original)
        records[snapshot['file']] = original

    archived_name, current_name, venues_name = [s['file'] for s in manifest['snapshots']]
    archived, current, venues = [records[name] for name in (archived_name, current_name, venues_name)]
    assert [len(archived), len(current), len(venues)] == [1971, 681, 130]
    assert profiles[archived_name]['rough_taipei_coordinate_rows'] == 1969
    assert profiles[current_name]['rough_taipei_coordinate_rows'] == 680
    assert profiles[current_name]['district_counts']['北投區'] == 0

    cdx = json.loads((ROOT / 'raw/archive-cdx-download.json').read_text())
    captures = [dict(zip(cdx[0], row)) for row in cdx[1:]]
    capture = next(row for row in captures if row['timestamp'] == '20241018211732')
    original_bytes = (ROOT / manifest['snapshots'][0]['raw_file']).read_bytes()
    # This SHA-1 is an archive payload identifier, not a security control.
    archive_digest = base64.b32encode(hashlib.sha1(original_bytes).digest()).decode().rstrip('=')
    assert archive_digest == capture['digest']

    pages = [json.loads((ROOT / f'raw/api-offset-{offset}.json').read_text())['result']
             for offset in (0, 1000, 2000)]
    assert [page['count'] for page in pages] == [681, 681, 681]
    assert [len(page['results']) for page in pages] == [681, 0, 0]
    api_rows = pages[0]['results']
    assert collections.Counter(map(record, api_rows)) == collections.Counter(map(record, current))

    may = json.loads((ROOT / 'raw/2024-original.json').read_text())['result']
    assert may['count'] == 1991 and may['offset'] == 0 and len(may['results']) == 1000
    assert {row['_importdate']['date'][:10] for row in may['results']} == {'2024-05-14'}
    old_counter = collections.Counter(map(record, may['results']))
    october_counter = collections.Counter(map(record, archived))
    matches = sum((old_counter & october_counter).values())
    assert matches == 668

    metadata = json.loads((ROOT / 'raw/catalog-parsed.json').read_text())
    result = {
        'verified_manifest_files': len(manifest['files']),
        'observed_date': manifest['observed_date'],
        'profiles': profiles,
        'checks': {
            'raw_to_utf8_values_and_order_preserved': True,
            'archive_payload_matches_cdx_digest': True,
            'current_csv_matches_api_multiset': True,
            'current_api_page_rows': [len(page['results']) for page in pages],
            'current_api_import_dates': sorted({row['_importdate']['date'] for row in api_rows}),
            'catalog_number_of_data': metadata['number_of_data'],
            'catalog_count_matches_current_csv': metadata['number_of_data'] == len(current),
        },
        'may_to_october_comparison': {
            'comparison_key': 'All five published fields, trimmed; multiplicity retained.',
            'may_preserved_rows': len(may['results']),
            'may_reported_total': may['count'],
            'identical_published_rows': matches,
            'may_rows_not_identical_in_october': sum((old_counter - october_counter).values()),
            'october_rows_not_identical_in_may_partial': sum((october_counter - old_counter).values()),
            'same_facility_identity_established': False,
            'missing_may_rows_recovered': 0,
        },
        'conclusions': {
            'may_2024_exact_completion': 'NOT_RECOVERED',
            'october_2024_archived_official_response': 'RECOVERED',
            'latest_published_2026_full_download': 'RECOVERED',
            'physical_citywide_inventory_completeness': 'UNVERIFIED',
            'venues_combined_with_street_boxes': False,
        },
    }
    (ROOT / 'quality-summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'verified_files': result['verified_manifest_files'],
                      'rows': {name: p['rows'] for name, p in profiles.items()},
                      'may_to_october_identical_rows': matches,
                      'conclusions': result['conclusions']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()

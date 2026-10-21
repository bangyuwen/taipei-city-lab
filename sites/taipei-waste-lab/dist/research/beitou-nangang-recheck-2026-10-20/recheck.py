"""Recheck fixed observation anchors; venue remarks are evidence, never weights."""
import csv
import hashlib
import io
import json
import math
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESEARCH = HERE.parent
CITY = RESEARCH / 'taipei-citywide-2026-10-19'
INPUT = RESEARCH / 'youbike-bin-screening-2026-10-18/inputs'
AREAS = ('南港區', '北投區')


def read_csv(path):
    with path.open(encoding='utf-8-sig', newline='') as stream:
        return list(csv.DictReader(stream))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def distance(a, b, cosine=False):
    x, y, u, v = map(math.radians, (*a, *b))
    if cosine:
        return 6371000 * math.acos(min(1, max(-1,
            math.sin(y) * math.sin(v) + math.cos(y) * math.cos(v) * math.cos(x-u))))
    h = math.sin((v-y)/2)**2 + math.cos(y)*math.cos(v)*math.sin((u-x)/2)**2
    return 12742000 * math.asin(math.sqrt(min(1, max(0, h))))


def xy(row):
    return float(row['lon']), float(row['lat'])


def select(rows, gap, metric):
    chosen = []
    pool = [r for r in rows if r['eligible'] == 'True' and int(r[metric]) > 0]
    for row in sorted(pool, key=lambda r: (-int(r[metric]), r['station_id'])):
        if all(distance(xy(row), xy(other)) >= gap for other in chosen):
            chosen.append(row)
        if len(chosen) == 3:
            break
    return [r['station_id'] for r in chosen]


def build():
    manifest = json.loads((CITY / 'manifest.json').read_text())
    assert digest(CITY / 'protocol.md') == manifest['protocol_sha256']
    for item in manifest['inputs']:
        assert digest(CITY / item['path']) == item['sha256'], item['path']
    fixed = json.loads((HERE / 'inputs.json').read_text())
    for item in fixed:
        assert digest(HERE / item['path']) == item['sha256'], item['path']
    receipt = json.loads((RESEARCH / 'bin-coverage-2026-10-20/source-check.json').read_text())
    sources, source_counts, excluded_coordinates = {}, {}, []
    for key, filename in [('street', 'bins-2026.csv'), ('venue', 'venues.csv')]:
        rows = read_csv(INPUT / filename)
        item = next(s for s in receipt['sources'] if s['file'] == (
            'street.csv' if key == 'street' else 'venues.csv'))
        body = (RESEARCH / item['retainedPath']).read_bytes()
        assert hashlib.sha256(body).hexdigest() == item['sha256']
        fresh = list(csv.DictReader(io.StringIO(body.decode('cp950'))))
        assert rows == fresh, 'Official rows changed; investigate before proceeding'
        sources[key] = []
        for i, row in enumerate(rows, 2):
            try:
                lon, lat = float(row['經度']), float(row['緯度'])
                valid = 121.4 <= lon <= 121.7 and 24.9 <= lat <= 25.25
            except ValueError:
                valid = False
            if not valid:
                excluded_coordinates.append({'source': key, 'row': i, 'original': row})
                continue
            sources[key].append({'row': i, 'name': row['地址'], 'source_area': row['行政區'],
                                 'lon': lon, 'lat': lat, 'remark': row['備註']})
        source_counts[key] = {'total': len(rows), 'valid_coordinates': len(sources[key])}
    assert source_counts == {'street': {'total': 681, 'valid_coordinates': 680},
                             'venue': {'total': 130, 'valid_coordinates': 130}}
    stations = read_csv(CITY / 'results/stations.csv')
    previous = json.loads((CITY / 'results/summary.json').read_text())
    # Independently reconcile the main metric against the earlier full-file aggregate.
    names = defaultdict(list)
    for row in json.loads((INPUT / 'youbike.json').read_text()):
        name = row['sna'].removeprefix('YouBike2.0_').replace('（', '(').replace('）', ')').strip()
        names[name].append(row['sno'])
    counts = Counter()
    for row in read_csv(RESEARCH / 'gongguan-hotspots-2026-10-19/results/source-station-events.csv'):
        if len(names.get(row['station_name'], [])) == 1:
            counts[(names[row['station_name']][0], row['side'])] += int(row['events'])
    for row in stations:
        assert int(row['borrow']) == counts[row['station_id'], 'borrow']
        assert int(row['return_events']) == counts[row['station_id'], 'return']
        assert int(row['events']) == int(row['borrow']) + int(row['return_events'])
        assert 0 <= int(row['events_excluding_flags']) <= int(row['events'])
    notes = json.loads((HERE / 'point-checks.json').read_text())
    result = {'checked_date': '2026-10-20', 'basis': 'fixed July aggregates; no new field observations',
              'venue_rows_added': 0, 'venue_remarks_used_in_ranking': False,
              'all_station_activity_reconciled': len(stations), 'source_counts': source_counts,
              'excluded_coordinates': excluded_coordinates, 'districts': [], 'candidates': []}
    max_error = 0
    for area in AREAS:
        pool = [r for r in stations if r['source_area'] == area]
        old = [r for r in previous['candidates'] if r['source_area'] == area]
        old_ids = [r['station_id'] for r in old]
        scenarios = []
        for gap, metric in [(300, 'events'), (150, 'events'),
                            (500, 'events'), (300, 'events_excluding_flags')]:
            chosen = select(pool, gap, metric)
            assert chosen == old_ids, (area, gap, metric, chosen)
            if (gap, metric) != (300, 'events'):
                prior = next(r for r in previous['sensitivity'] if
                    r['source_area'] == area and r['minimum_separation_m'] == gap
                    and r['activity_basis'] == metric)
                assert chosen == prior['station_ids'].split('|')
            scenarios.append({'gap_m': gap, 'metric': metric, 'station_ids': chosen,
                              'same_order_as_previous_main': True})
        result['districts'].append({
            'area': area, 'snapshot_stations': len(pool),
            'eligible_stations': sum(r['eligible'] == 'True' for r in pool),
            'unknown_activity_stations': sum(r['eligible'] == 'True' and int(r['events']) == 0 for r in pool),
            'scenarios': scenarios})
        for c in old:
            point = {k: c[k] for k in ('candidate_id', 'station_id', 'name', 'source_area',
                     'lon', 'lat', 'events', 'events_excluding_flags', 'city_rank')}
            for key, rows in sources.items():
                d, _, nearest = min((distance(xy(c), xy(r)), r['row'], r) for r in rows)
                independent, row_number = min((distance(xy(c), xy(r), True), r['row']) for r in rows)
                assert row_number == nearest['row'] == c[key + '_source_row']
                assert abs(d - c[key + '_nearest_m']) < .01
                max_error = max(max_error, abs(d - independent))
                assert abs(d - independent) < .02
                point[key] = {**nearest, 'source_coordinate_distance_m': round(d, 2)}
            point.update(notes[c['candidate_id']])
            point['field_status'] = {
                'physical_bin_count': None, 'actual_bin_locations': None,
                'opening_and_acceptance_rules': None, 'walking_route': None,
                'manager': None, 'disposal_demand': None}
            result['candidates'].append(point)
    result['maximum_formula_difference_m'] = max_error
    result['candidate_count'] = len(result['candidates'])
    result['unchanged_candidates_in_order'] = len(result['candidates'])
    assert {c['candidate_id'] for c in result['candidates']} == set(notes)
    assert not any(r['name'] == '北投運動中心' for r in sources['venue'])
    return result


if __name__ == '__main__':
    result = build()
    (HERE / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print('Reconciled 1,821 station aggregates; 6/6 anchors and order unchanged in all 4 scenarios.')
    print('All 12 nearest source records independently checked; 0 venue coordinates added.')

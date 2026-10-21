"""Recheck the remaining ten districts against the fixed citywide baseline."""
import json
import runpy
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
RESEARCH = HERE.parent
PRIOR = RESEARCH / 'beitou-nangang-recheck-2026-10-20'
CITY = RESEARCH / 'taipei-citywide-2026-10-19'


def build():
    # Reuse the already-established source reconciliation and distance functions.
    common = runpy.run_path(str(PRIOR / 'recheck.py'))
    digest, read_csv = common['digest'], common['read_csv']
    distance, xy, select = common['distance'], common['xy'], common['select']
    for item in json.loads((HERE / 'inputs.json').read_text()):
        assert digest(HERE / item['path']) == item['sha256'], item['path']
    verified = common['build']()
    assert verified == json.loads((PRIOR / 'results.json').read_text())
    old = json.loads((CITY / 'results/summary.json').read_text())
    stations = read_csv(CITY / 'results/stations.csv')
    by_id = {r['station_id']: r for r in stations}
    areas = [d for d in old['districts'] if d['source_area'] not in
             ('北投區', '南港區', '臺大公館校區')]
    notes = json.loads((HERE / 'point-checks.json').read_text())
    sources = {}
    for key, name in [('street', 'bins-2026.csv'), ('venue', 'venues.csv')]:
        sources[key] = []
        for number, row in enumerate(read_csv(common['INPUT'] / name), 2):
            try:
                lon, lat = float(row['經度']), float(row['緯度'])
            except ValueError:
                continue
            if 121.4 <= lon <= 121.7 and 24.9 <= lat <= 25.25:
                sources[key].append({
                    'row': number, 'name': row['地址'], 'source_area': row['行政區'],
                    'lon': lon, 'lat': lat, 'remark': row['備註']})
        assert len(sources[key]) == verified['source_counts'][key]['valid_coordinates']
    result = {
        'checked_date': '2026-10-20',
        'basis': 'fixed July aggregates; no new field observations',
        'venue_rows_added': 0, 'venue_remarks_used_in_ranking': False,
        'source_counts': verified['source_counts'],
        'excluded_coordinates': verified['excluded_coordinates'],
        'all_station_activity_reconciled': verified['all_station_activity_reconciled'],
        'districts': [], 'candidates': []}
    max_error = 0
    for district in areas:
        area = district['source_area']
        pool = [r for r in stations if r['source_area'] == area]
        primary = [r for r in old['candidates'] if r['source_area'] == area]
        primary_ids = [r['station_id'] for r in primary]
        scenarios = []
        for gap, metric in [(300, 'events'), (150, 'events'),
                            (500, 'events'), (300, 'events_excluding_flags')]:
            chosen = select(pool, gap, metric)
            if (gap, metric) == (300, 'events'):
                expected = primary_ids
            else:
                previous = next(r for r in old['sensitivity'] if r['source_area'] == area
                                and r['minimum_separation_m'] == gap
                                and r['activity_basis'] == metric)
                expected = previous['station_ids'].split('|')
                assert len(set(chosen) & set(primary_ids)) == previous['retained_of_primary3']
            assert chosen == expected, (area, gap, metric, chosen)
            # Validate spacing with the independent spherical cosine formula.
            for i, sid in enumerate(chosen):
                for other in chosen[i+1:]:
                    assert distance(xy(by_id[sid]), xy(by_id[other]), True) >= gap - .02
            scenarios.append({
                'gap_m': gap, 'metric': metric, 'station_ids': chosen,
                'station_names': [by_id[sid]['name'] for sid in chosen],
                'same_order_as_previous_scenario': True,
                'same_order_as_primary': chosen == primary_ids,
                'retained_of_primary3': len(set(chosen) & set(primary_ids)),
                'removed': [by_id[sid]['name'] for sid in primary_ids if sid not in chosen],
                'added': [by_id[sid]['name'] for sid in chosen if sid not in primary_ids]})
        result['districts'].append({
            'area': area, 'code': primary[0]['candidate_id'][1:3],
            'snapshot_stations': len(pool),
            'eligible_stations': sum(r['eligible'] == 'True' for r in pool),
            'unknown_activity_stations': sum(r['eligible'] == 'True' and int(r['events']) == 0 for r in pool),
            'scenarios': scenarios})
        for c in primary:
            point = {k: c[k] for k in ('candidate_id', 'station_id', 'name', 'source_area',
                     'lon', 'lat', 'events', 'events_excluding_flags', 'city_rank')}
            for key, rows in sources.items():
                d, number, nearest = min((distance(xy(c), xy(r)), r['row'], r) for r in rows)
                independent, other_row = min((distance(xy(c), xy(r), True), r['row']) for r in rows)
                assert number == other_row == c[key + '_source_row']
                assert abs(d - c[key + '_nearest_m']) < .01
                assert nearest['name'] == c[key + '_name']
                assert nearest['source_area'] == c[key + '_source_area']
                max_error = max(max_error, abs(d - independent))
                assert abs(d - independent) < .02
                point[key] = {**nearest, 'source_coordinate_distance_m': round(d, 2)}
            point.update(notes[c['candidate_id']])
            assert point['relation'] in ('同站名', '不同場域')
            point['field_status'] = {
                'physical_bin_count': None, 'actual_bin_locations': None,
                'opening_and_acceptance_rules': None, 'walking_route': None,
                'manager': None, 'disposal_demand': None}
            result['candidates'].append(point)
    assert len(result['districts']) == 10 and len(result['candidates']) == 30
    assert set(notes) == {p['candidate_id'] for p in result['candidates']}
    result['unchanged_primary_candidates_in_order'] = 30
    result['maximum_formula_difference_m'] = max_error
    result['relation_counts'] = dict(Counter(p['relation'] for p in result['candidates']))
    result['cross_area_venue_hints'] = [
        p['candidate_id'] for p in result['candidates'] if p['source_area'] != p['venue']['source_area']]
    result['shared_venue_rows'] = [
        {'row': number, 'candidate_ids': [p['candidate_id'] for p in result['candidates']
                                        if p['venue']['row'] == number]}
        for number, count in Counter(p['venue']['row'] for p in result['candidates']).items()
        if count > 1]
    result['spacing_sensitive_areas'] = [
        d['area'] for d in result['districts']
        if any(not s['same_order_as_primary'] for s in d['scenarios'])]
    return result


if __name__ == '__main__':
    result = build()
    (HERE / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({
        'primary_unchanged': result['unchanged_primary_candidates_in_order'],
        'spacing_sensitive_areas': result['spacing_sensitive_areas'],
        'relation_counts': result['relation_counts'],
        'cross_area_venue_hints': result['cross_area_venue_hints'],
        'shared_venue_rows': result['shared_venue_rows'],
        'nearest_records_reconciled': 2 * len(result['candidates'])}, ensure_ascii=False))

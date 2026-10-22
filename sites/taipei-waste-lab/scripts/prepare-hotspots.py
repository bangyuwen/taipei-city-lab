"""Publish a minimal activity map from retained citywide analysis, without new inference."""
import csv
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'research/taipei-citywide-2026-10-19/results'


def build():
    stations = []
    with (SOURCE / 'stations.csv').open(encoding='utf-8-sig') as f:
        rows = list(csv.DictReader(f))
    for row in rows:
        if row['eligible'] != 'True':
            continue
        observed = row['activity_status'] == 'observed'
        stations.append({
            'id': row['station_id'], 'name': row['name'], 'area': row['source_area'],
            'address': row['address'], 'lat': float(row['lat']), 'lon': float(row['lon']),
            'events': int(row['events']) if observed else None,
            'borrow': int(row['borrow']) if observed else None,
            'returns': int(row['return_events']) if observed else None,
            'street': {'name': row['street_name'], 'distance': float(row['street_nearest_m']), 'area': row['street_source_area']},
            'venue': {'name': row['venue_name'], 'distance': float(row['venue_nearest_m']), 'area': row['venue_source_area']},
        })
    summary = json.loads((SOURCE / 'summary.json').read_text())
    catalog = json.loads((ROOT / 'dist/data/datasets.json').read_text())
    current = next(d for d in catalog['datasets'] if d['key'] == '2026-main')
    def points(items):
        return [{'id': p['id'], 'name': p['address'], 'area': p['district'],
                 'lat': p['y'], 'lon': p['x'], 'remark': p.get('sourceRemark', '')}
                for p in items if p['plottable']]
    meta = {
        'month': summary['month'], 'stationSnapshot': summary['snapshot'],
        'streetDate': '2026-09-30', 'venueDate': '2026-08-18',
        'sourceRows': len(rows), 'excludedStations': len(rows)-len(stations),
        'eligibleStations': len(stations), 'unknownStations': sum(p['events'] is None for p in stations),
        'events': sum(p['events'] or 0 for p in stations),
        'areas': [d['source_area'] for d in summary['districts']],
        'sourceSHA256': {name: hashlib.sha256((SOURCE/name).read_bytes()).hexdigest()
                         for name in ['stations.csv', 'summary.json']},
    }
    assert meta['events'] == summary['totals']['eligible_events']
    assert meta['eligibleStations'] == sum(d['eligible_stations'] for d in summary['districts'])
    assert len({s['id'] for s in stations}) == len(stations)
    result = {'meta': meta, 'stations': stations, 'street': points(current['points']),
              'venues': points(catalog['venueLeads']['points'])}
    (ROOT / 'dist/data/activity-hotspots.json').write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':'))+'\n')
    print(f"Prepared {len(stations)} activity locations; {meta['unknownStations']} unknown, no imputed zeros.")
    return result


if __name__ == '__main__':
    build()

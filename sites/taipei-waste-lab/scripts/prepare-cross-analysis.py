"""Join retained station activity and official bus locations to the fixed bin snapshot."""
import csv
import gzip
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path
from cross_transport import prepare_transport

ROOT = Path(__file__).resolve().parent.parent
STATIONS = ROOT / 'research/taipei-citywide-2026-10-19/results/stations.csv'
BUS = ROOT / 'data/cross-analysis-inputs/bus-stops-2026-10-22.json.gz'
BINS = ROOT / 'dist/data/datasets.json'
PROFILES = ROOT / 'research/taipei-citywide-2026-10-19/results/hourly-profiles.csv'


def distance(a, b):
    lat1, lat2 = math.radians(a['y']), math.radians(b['y'])
    dy = lat2 - lat1
    dx = math.radians(b['x'] - a['x'])
    h = math.sin(dy / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dx / 2) ** 2
    return 6371000 * 2 * math.asin(min(1, math.sqrt(h)))


def nearest(point, bins):
    d, b = min((distance(point, b), i) for i, b in enumerate(bins))
    return {'id': bins[b]['id'], 'address': bins[b]['address'], 'district': bins[b]['district'],
            'x': bins[b]['x'], 'y': bins[b]['y'], 'distanceM': round(d, 2)}


def prepare():
    catalog = json.loads(BINS.read_text())
    snapshot = next(d for d in catalog['datasets'] if d['key'] == '2026-main')
    bins = [p for p in snapshot['points'] if p['plottable']]
    raw = json.loads(gzip.decompress(BUS.read_bytes()))
    assert raw['EssentialInfo']['CoordinateSystem'] == 'WGS84'
    groups = defaultdict(list)
    for row in raw['BusInfo']:
        groups[row['stopLocationId']].append(row)
    buses, excluded = [], []
    for key, rows in sorted(groups.items()):
        coordinates = {(float(p['longitude']), float(p['latitude'])) for p in rows}
        if key in (None, 0, -1) or len(coordinates) != 1:
            excluded.append(key)
            continue
        x, y = next(iter(coordinates))
        if not (math.isfinite(x) and math.isfinite(y) and 120 < x < 123 and 24 < y < 26):
            excluded.append(key)
            continue
        row = min(rows, key=lambda p: p['Id'])
        buses.append({'id': str(key), 'name': row['nameZh'], 'address': row['address'], 'x': x, 'y': y,
                      'routeCount': len({p['routeId'] for p in rows})})
    stations, used = [], set()
    for row in csv.DictReader(STATIONS.open(encoding='utf-8-sig')):
        if row['active'] != 'True' or row['coordinate_valid'] != 'True':
            continue
        p = {'id': row['station_id'], 'name': row['name'], 'district': row['source_area'],
             'address': row['address'], 'x': float(row['lon']), 'y': float(row['lat']),
             'events': int(row['events_excluding_flags']) if row['eligible'] == 'True' and row['activity_status'] == 'observed' else None,
             'pedestrianCount': None, 'busPassengerCount': None}
        p['nearestBin'] = nearest(p, bins)
        distances = [(distance(p, b), b) for b in bins]
        p['binCounts'] = {str(radius): len({(b['x'], b['y']) for d, b in distances if d <= radius})
                          for radius in [100, 200, 300]}
        p['binRows'] = {str(radius): sum(d <= radius for d, _ in distances) for radius in [100, 200, 300]}
        nearby = []
        for bus in buses:
            if abs(p['x'] - bus['x']) > .004 or abs(p['y'] - bus['y']) > .003:
                continue
            d = distance(p, bus)
            if d <= 300:
                nearby.append({'id': bus['id'], 'distanceM': round(d, 2)})
                used.add(bus['id'])
        p['buses'] = sorted(nearby, key=lambda b: (b['distanceM'], b['id']))
        stations.append(p)
    buses = [dict(p, nearestBin=nearest(p, bins)) for p in buses if p['id'] in used]
    values = sorted(p['events'] for p in stations if p['events'] is not None and p['events'] > 0)
    threshold = values[math.ceil(.75 * len(values)) - 1]
    profiles = defaultdict(dict)
    rows_by_group = defaultdict(list)
    for row in csv.DictReader(PROFILES.open(encoding='utf-8-sig')):
        rows_by_group[(row['source_area'], row['day_type'])].append(row)
    for (area, day_type), rows in rows_by_group.items():
        days = {int(p['days']) for p in rows}
        assert len(days) == 1 and len(rows) == 24
        denominator = days.pop()
        assert denominator == (22 if day_type == 'weekday' else 7)
        peak = min(rows, key=lambda p: (-int(p['events']), int(p['hour'])))
        profiles[area][day_type] = {'days': denominator, 'dailyEvents': sum(int(p['events']) for p in rows) / denominator,
                                   'peakHour': int(peak['hour']),
                                   'hourly': [int(p['events']) for p in sorted(rows,key=lambda r:int(r['hour']))]}
    data = {'meta': {'generatedFor': '2026-10-22', 'binKey': '2026-main', 'binRows': snapshot['rows'],
        'binCoordinates': len(bins), 'busUpdatedAt': raw['EssentialInfo']['UpdateTime'],
        'busSourceRows': len(raw['BusInfo']), 'busLocationGroups': len(groups), 'excludedBusIds': excluded,
        'busScope': 'Locations within 300 m of active Taipei YouBike stations; not a city boundary.',
        'activityDays': 29, 'stationRows': 1821, 'activeCoordinateStations': len(stations), 'observedStations': len(values),
        'highActivityThreshold': threshold, 'activityPeriod': '2026-07，排除 7/10、7/11',
        'stationSnapshot': '2026-10-18', 'busSource': 'https://tcgbusfs.blob.core.windows.net/blobbus/GetStop.gz',
        'activitySource': 'https://data.gov.tw/dataset/150635', 'stationSource': 'https://data.gov.tw/dataset/137993',
        'binSource': snapshot['source'], 'binDate': snapshot['dateLabel'],
        'inputs': [{'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()} for p in [STATIONS, BUS, BINS, PROFILES]]},
        'stations': stations, 'buses': buses, 'areaProfiles': profiles,
        'transport': prepare_transport(ROOT, bins, stations, buses, distance, nearest)}
    target = ROOT / 'dist/data/cross-analysis.json'
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps(data['meta'], ensure_ascii=False, indent=2))


if __name__ == '__main__':
    prepare()

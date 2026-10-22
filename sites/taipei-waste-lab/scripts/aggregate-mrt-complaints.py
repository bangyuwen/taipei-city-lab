"""Regenerate retained hourly aggregates from official raw CSVs (no network)."""
import csv
import gzip
import hashlib
import json
from collections import defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INPUT = ROOT / 'data/cross-analysis-inputs'
EXCLUDED = {'2026-07-10', '2026-07-11'}


def aggregate_od(path):
    stations = defaultdict(lambda: {'entries': 0, 'exits': 0, 'fullMonthEntries': 0, 'fullMonthExits': 0,
                                    'hourly': [0]*24, 'weekday': [0]*24, 'weekend': [0]*24})
    dates, rows, trips, full_trips = set(), 0, 0, 0
    observed_blocks = set()
    # Each source date/hour block contains exactly one row for each ordered station pair.
    block, pairs, expected_names = None, set(), None
    def validate_block():
        nonlocal expected_names
        origins = {a for a, b in pairs}; destinations = {b for a, b in pairs}
        assert len(pairs) == len(origins)*len(destinations)
        if expected_names is None: expected_names = (origins, destinations)
        assert (origins, destinations) == expected_names
    with gzip.open(path, 'rt', encoding='utf-8-sig', newline='') as f:
        for row in csv.DictReader(f):
            day, hour, origin, destination, count = row['日期'], int(row['時段']), row['進站'], row['出站'], int(row['人次'])
            assert day.startswith('2026-07-') and 0 <= hour < 24 and count >= 0
            key = (day, hour)
            if block != key:
                if block is not None: validate_block()
                assert key not in observed_blocks
                observed_blocks.add(key)
                block, pairs = key, set()
            assert (origin, destination) not in pairs
            pairs.add((origin, destination))
            aliases = {'G大坪林': '大坪林', 'O景安': '景安', 'O頭前庄': '頭前庄'}
            origin, destination = aliases.get(origin, origin), aliases.get(destination, destination)
            dates.add(day); rows += 1; full_trips += count
            stations[origin]['fullMonthEntries'] += count
            stations[destination]['fullMonthExits'] += count
            if day in EXCLUDED: continue
            trips += count
            kind = 'weekend' if date.fromisoformat(day).weekday() >= 5 else 'weekday'
            stations[origin]['entries'] += count
            stations[destination]['exits'] += count
            stations[origin]['hourly'][hour] += count
            stations[origin][kind][hour] += count
        validate_block()
    assert len(dates) == 31
    assert sum(p['entries'] for p in stations.values()) == sum(p['exits'] for p in stations.values()) == trips
    return {'stations': dict(sorted(stations.items())), 'rows': rows, 'trips': trips, 'fullMonthTrips': full_trips,
            'sourceOriginCount': len(expected_names[0]), 'sourceDestinationCount': len(expected_names[1]),
            'observedHours': sorted({h for d,h in observed_blocks}), 'dateHourBlocks': len(observed_blocks),
            'dates': sorted(dates), 'excludedDates': sorted(EXCLUDED), 'days': 29, 'weekdayDays': 22, 'weekendDays': 7}


CATEGORIES = ['路面清潔（含行人果皮箱、菸蒂、狗便）', '垃圾車清運及服務事項']


def aggregate_complaints(path):
    groups = {name: {'hourly': [0]*24, 'weekday': [0]*24, 'weekend': [0]*24,
                     'fullMonthHourly': [0]*24, 'sourceRows': 0, 'outsideMonth': 0, 'excludedDays': 0}
              for name in CATEGORIES}
    seen, rows, outside = set(), 0, 0
    with gzip.open(path, 'rt', encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames
        for row in reader:
            rows += 1
            assert row['案件編號'] not in seen
            seen.add(row['案件編號'])
            dt = datetime.strptime(row['受理日期'], '%Y%m%dT%H%M%S')
            in_month = dt.strftime('%Y-%m') == '2026-07'
            outside += not in_month
            if row['案件次類別'] not in groups: continue
            p = groups[row['案件次類別']]; p['sourceRows'] += 1
            if not in_month:
                p['outsideMonth'] += 1
                continue
            p['fullMonthHourly'][dt.hour] += 1
            if dt.date().isoformat() in EXCLUDED:
                p['excludedDays'] += 1
                continue
            p['hourly'][dt.hour] += 1
            p['weekend' if dt.weekday() >= 5 else 'weekday'][dt.hour] += 1
    return {'groups': groups, 'sourceRows': rows, 'uniqueCases': len(seen), 'outsideMonth': outside,
            'fields': fields, 'spatialStatus': 'No address or coordinates in source',
            'timestamp': '受理日期', 'days': 29, 'weekdayDays': 22, 'weekendDays': 7}


def prepare():
    od = INPUT / 'mrt-od-202607.csv.gz'
    complaints = INPUT / 'complaints-202607.csv.gz'
    result = {'mrt': aggregate_od(od), 'complaints': aggregate_complaints(complaints)}
    result['inputs'] = [{'path': str(p.relative_to(ROOT)), 'sha256': hashlib.sha256(p.read_bytes()).hexdigest()}
                        for p in [od, complaints]]
    (INPUT / 'transport-time-aggregate.json').write_text(json.dumps(result,ensure_ascii=False,separators=(',', ':'))+'\n')
    print({key:value for key,value in result['mrt'].items() if key not in ('stations','dates')})
    print(result['complaints'])

if __name__ == '__main__': prepare()

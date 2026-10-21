"""Aggregate the official full OD file; retain station/day counts and coverage receipt."""
import argparse, collections, csv, datetime, hashlib, json
from pathlib import Path

ROOT = Path(__file__).resolve().parent

def aggregate(path):
    digest = hashlib.sha256()
    with path.open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''): digest.update(block)
    entries, exits = collections.Counter(), collections.Counter()
    group_counts, pair_counts = {}, set()
    current = None
    names = set()
    row_count = total = 0
    days = {f'2026-09-{d:02}' for d in range(1, 31)}
    with path.open(encoding='utf-8-sig', newline='') as f:
        reader = csv.DictReader(f)
        assert reader.fieldnames == ['日期', '時段', '進站', '出站', '人次']
        for r in reader:
            date, hour, origin, dest = (r[k] for k in reader.fieldnames[:4])
            count = int(r['人次'])
            assert date in days and 0 <= int(hour) < 24 and count >= 0
            key = date, hour
            if key != current:
                if current is not None: group_counts['/'.join(current)] = len(pair_counts)
                assert '/'.join(key) not in group_counts, 'Repeated non-contiguous OD block'
                pair_counts = set(); current = key
            pair = (origin, dest)
            assert pair not in pair_counts, 'Duplicate OD key'
            pair_counts.add(pair)
            entries[date, origin] += count; exits[date, dest] += count
            names.update(pair); total += count; row_count += 1
        if current: group_counts['/'.join(current)] = len(pair_counts)
    assert {d for d, _ in entries} == days
    keys = entries.keys() | exits.keys()
    assert sum(entries.values()) == sum(exits.values()) == total
    output = ROOT / 'inputs/station-day-202609.csv'
    with output.open('w', encoding='utf-8', newline='') as f:
        w = csv.writer(f); w.writerow(['date','station','entries','exits'])
        for key in sorted(keys): w.writerow([*key, entries[key] if key in entries else '', exits[key] if key in exits else ''])
    receipt = {'url': list(csv.DictReader((ROOT/'inputs/od-index.csv').open(encoding='utf-8-sig')))[-1]['URL'].replace('http://','https://'),
        'retained_raw_file': str(path), 'raw_bytes':path.stat().st_size, 'raw_sha256': digest.hexdigest(),
        'period':'2026-09', 'days':30, 'station_names':sorted(names), 'raw_rows':row_count,
        'journeys':total, 'entries':sum(entries.values()), 'exits':sum(exits.values()),
        'station_day_rows':len(keys), 'origin_only_names':sorted({k[1] for k in entries.keys()-exits.keys()}), 'destination_only_names':sorted({k[1] for k in exits.keys()-entries.keys()}), 'blocks':group_counts, 'unique_od_keys':True,
        'station_days_per_name':{s:sum((d,s) in entries for d in days) for s in sorted(names)}}
    (ROOT/'inputs/od-receipt.json').write_text(json.dumps(receipt, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k:v for k,v in receipt.items() if k not in ['blocks','station_names','station_days_per_name']},ensure_ascii=False))
    print('hour labels', sorted({k.split('/')[-1] for k in group_counts}), 'pair counts per block',sorted(set(group_counts.values())))

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('raw_csv',type=Path);a=p.parse_args();aggregate(a.raw_csv)

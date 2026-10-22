"""Join retained MRT/time aggregates to the existing cross-analysis scope."""
import csv
import gzip
import hashlib
import json
import re
from collections import defaultdict


def prepare_transport(root, bins, bikes, buses, distance, nearest):
    inputs = root / 'data/cross-analysis-inputs'
    aggregate_path = inputs / 'transport-time-aggregate.json'
    source = json.loads(aggregate_path.read_text())
    for item in source['inputs']:
        assert hashlib.sha256((root / item['path']).read_bytes()).hexdigest() == item['sha256'], 'Run aggregate-mrt-complaints.py after changing raw inputs'
    grouped = defaultdict(list)
    with gzip.open(inputs / 'mrt-exits.csv.gz', 'rt', encoding='cp950', newline='') as f:
        for row in csv.DictReader(f):
            label = row['出入口名稱']
            name = re.sub(r'站出口.*$', '', label) if '站出口' in label else re.sub(r'M\d+$', '', label)
            p = {'id': row['項次'], 'name': label, 'x': float(row['經度']), 'y': float(row['緯度'])}
            assert 120 < p['x'] < 123 and 24 < p['y'] < 26
            grouped[name].append(p)
    mrt, outside, unmatched = [], [], []
    aliases = {'大橋頭': '大橋頭站'}
    for name, exits in sorted(grouped.items()):
        # Geographical scope is the same retained Taipei YouBike station neighbourhoods.
        nearby_bikes = [p for p in bikes if any(abs(p['x']-e['x'])<.004 and abs(p['y']-e['y'])<.003 and distance(p,e)<=300 for e in exits)]
        if not nearby_bikes:
            outside.append(name)
            continue
        flow = source['mrt']['stations'].get(aliases.get(name, name))
        if flow is None:
            unmatched.append(name)
            continue
        near = min((nearest(e,bins) for e in exits), key=lambda p:p['distanceM'])
        distances = [(min(distance(e,b) for e in exits),b) for b in bins]
        nearby_buses = [p['id'] for p in buses if any(abs(p['x']-e['x'])<.004 and abs(p['y']-e['y'])<.003 and distance(p,e)<=300 for e in exits)]
        mrt.append({'id':name, 'name':name, 'exitLocations':exits, **flow,
                    'nearestBin':near, 'bikeIds':[p['id'] for p in nearby_bikes], 'busIds':nearby_buses,
                    'areas':sorted({p['district'] for p in nearby_bikes}),
                    'binCounts':{str(r):len({(b['x'],b['y']) for d,b in distances if d<=r}) for r in [100,200,300]}})
    metadata = {k:v for k,v in source['mrt'].items() if k!='stations'}
    metadata.update({'scope':'Stations with an exit within 300 m of retained Taipei YouBike stations; not a city boundary',
                     'exitRows':sum(map(len,grouped.values())), 'exitStationNames':len(grouped),
                     'outsideScope':outside, 'unmatchedInScope':unmatched,
                     'odSource':'https://data.taipei/dataset/detail?id=63f31c7e-7fc3-418b-bd82-b95158755b4d',
                     'exitSource':'https://data.taipei/dataset/detail?id=cfa4778c-62c1-497b-b704-756231de348b',
                     'complaintSource':'https://data.taipei/dataset/detail?id=cb423c17-88eb-4231-a725-f1b93247d1bf',
                     'inputs':source['inputs'] + [{'path':str(p.relative_to(root)), 'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in [aggregate_path, inputs/'mrt-exits.csv.gz']]})
    return {'meta':metadata, 'stations':mrt, 'complaints':source['complaints']}

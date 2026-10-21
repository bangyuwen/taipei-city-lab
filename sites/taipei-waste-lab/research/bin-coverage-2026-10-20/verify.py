"""Reconcile the retained official responses without claiming physical stock."""
import collections
import csv
import hashlib
import io
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RESEARCH = ROOT.parent


def verify():
    receipt = json.loads((ROOT / 'source-check.json').read_text())
    sources = {}
    for item in receipt['sources']:
        body = (RESEARCH / item['retainedPath']).read_bytes()
        assert item['status'] == 200
        assert len(body) == item['bytes']
        assert hashlib.sha256(body).hexdigest() == item['sha256']
        sources[item['file']] = body
    street = list(csv.DictReader(io.StringIO(sources['street.csv'].decode('cp950'))))
    venues = list(csv.DictReader(io.StringIO(sources['venues.csv'].decode('cp950'))))
    api = json.loads(sources['api-0.json'])['result']
    tail = json.loads(sources['api-1000.json'])['result']
    map_rows = list(csv.reader(json.loads(sources['map.json'])))
    columns = ['行政區', '地址', '經度', '緯度', '備註']
    projection = lambda rows: [tuple(row[key] for key in columns) for row in rows]
    assert projection(street) == projection(api['results'])
    assert [row[:4] for row in projection(street)] == [
        (r[0], r[1] + r[2], r[3], r[4]) for r in map_rows]
    assert api['count'] == tail['count'] == len(street) == 681
    assert api['offset'] == 0 and api['limit'] == 1000
    assert tail['offset'] == 1000 and not tail['results']
    districts = collections.Counter(row['行政區'] for row in street)
    for district, expected in receipt['focusDistricts'].items():
        records = [row for row in venues if row['行政區'] == district]
        assert districts[district] == expected['streetRows']
        assert len(records) == expected['venueRows']
        assert sum(int(re.fullmatch(r'(\d+)處', row['備註']).group(1))
                   for row in records) == expected['reportedPlaces']
    assert receipt['addedVerifiedStreetRows'] == 0
    assert receipt['inventoryComplete'] is None and receipt['surveyDate'] is None
    # The published map must retain each source remark without multiplying points.
    site = RESEARCH.parent
    if (ROOT.parents[3] / "sites/taipei-waste-lab").is_dir():
        site = ROOT.parents[3] / "sites/taipei-waste-lab"
    points = json.loads((site / 'dist/data/datasets.json').read_text())['venueLeads']['points']
    assert len(points) == len(venues) == 130
    for point, row in zip(points, venues):
        assert point['district'] == row['行政區'] and point['address'] == row['地址']
        assert point['sourceRemark'] == row['備註']
    print('681 street rows reconciled across CSV/API/map; pagination complete.')
    print('130 venue rows preserve original remarks; Beitou 10 rows / 49 reported places; Nangang 5 / 28.')
    print('Physical stock and dog-bag-to-street-bin identity remain unverified.')


if __name__ == '__main__':
    verify()

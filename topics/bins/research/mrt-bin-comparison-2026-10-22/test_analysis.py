"""Exercise cohort, radius, duplicate-row and unknown-source boundaries."""
import contextlib
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('comparison', Path(__file__).with_name('analyze.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ComparisonBoundaries(unittest.TestCase):
    def test_coordinate_and_name_boundaries(self):
        for lon, lat in [(180, 90), (-180, -90)]:
            self.assertEqual(module.coordinate({'經度': str(lon), '緯度': str(lat)}), (lon, lat))
        for lon, lat in [(181, 90), (180, 91), ('NaN', 25), (121, 'inf'), ('', 25)]:
            self.assertIsNone(module.coordinate({'經度': str(lon), '緯度': str(lat)}))
        self.assertEqual(module.normalize(' 大橋頭站 '), '大橋頭')
        self.assertEqual(module.normalize('臺北車站'), '台北車站')
        self.assertEqual(module.normalize('忠孝新生'), '忠孝新生')

    def test_cohort_radius_unions_and_venue_units(self):
        # 11 eligible Taipei stations cross the top-10 boundary; higher-activity
        # New Taipei data must not enter this Taipei-address cohort.
        names = [f'站{i:02d}' for i in range(12)]
        stations = [{'StationName': name, 'StationID': name,
                     'StationAddress': '臺北市' if i < 11 else '新北市'}
                    for i, name in enumerate(names)]
        daily = [{'station': name, 'date': f'2026-09-{day:02d}',
                  'entries': str(i + 1), 'exits': str(i + 1)}
                 for i, name in enumerate(names) for day in range(1, 31)]
        exits = [{'出入口名稱': name + '站出口1', '經度': '121', '緯度': '25'} for name in names]
        # Duplicate exit coverage must not count a street source row twice.
        exits += [{**row, '出入口名稱': row['出入口名稱'][:-1] + '2'} for row in exits]
        distances = [100, 101, 200, 201, 300, 301, 500, 501, 100]
        streets = [{'行政區': '中山區', '地址': f'row{i}', '經度': '121.5',
                    '緯度': str(25 + (0 if i == 8 else i) / 1000)} for i in range(9)]
        street_distances = {module.coordinate(row): distance for row, distance in zip(streets, distances)}
        venues = [{'地址': names[10] + '捷運站', '行政區': district, '備註': '10處'}
                  for district in ['中山區', '大同區']]
        def source(path, encoding=None):
            if path == module.STREET: return streets
            if path == module.VENUES: return venues
            return {'stations-2026-09-04.csv': stations, 'station-day-202609.csv': daily,
                    'exits-2026-08-04.csv': exits}[path.name]
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); (root / 'inputs').mkdir()
            (root / 'inputs/od-receipt.json').write_text(json.dumps({'station_names': names, 'journeys': 1}))
            with patch.object(module, 'ROOT', root), patch.object(module, 'read_csv', side_effect=source), \
                 patch.object(module, 'distance', side_effect=lambda a, b: street_distances[a]), \
                 contextlib.redirect_stdout(io.StringIO()):
                result = module.calculate()
        self.assertEqual(result['eligible_station_count'], 11)
        self.assertEqual([r['station'] for r in result['results']], list(reversed(names[1:11])))
        first = result['results'][0]
        self.assertEqual(first['street_rows'], {'100': 2, '200': 4, '300': 6, '500': 8})
        self.assertEqual(first['distinct_street_coordinates'], {'100': 1, '200': 3, '300': 5, '500': 7})
        self.assertEqual(len(first['venues']), 2)
        self.assertEqual([r['備註'] for r in first['venues']], ['10處', '10處'])
        self.assertNotIn('usable_bin_count', first)


if __name__ == '__main__':
    unittest.main()

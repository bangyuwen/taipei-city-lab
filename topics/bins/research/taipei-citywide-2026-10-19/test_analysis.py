"""Regression checks for eligibility, source limits and selection boundaries."""
import contextlib
import importlib.util
import io
import json
import shutil
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


ROOT = Path(__file__).resolve().parent
city = load('citywide', ROOT / 'analyze.py')
local = load('gongguan', ROOT.parent / 'gongguan-hotspots-2026-10-19/analyze.py')


class AnalysisBoundaries(unittest.TestCase):
    def test_historical_publisher_rejects_current_or_damaged_pages_without_writes(self):
        publisher = load('historical_publisher', ROOT.parent / 'gongguan-hotspots-2026-10-19/publish_results.py')
        start='<!-- gongguan-delivery:start -->';end='<!-- gongguan-delivery:end -->'
        for content in ['<section aria-labelledby="research-overview-mvp">current citywide plan</section>',
                        start, end, end+start, start+start+end]:
            with self.subTest(content=content), tempfile.TemporaryDirectory() as folder:
                site=Path(folder);(site/'dist').mkdir();page=site/'dist/index.html';page.write_text(content)
                with patch.object(publisher,'SITE',site), patch.object(publisher,'ROOT',site/'missing-study'):
                    with self.assertRaisesRegex(RuntimeError,'Historical Gongguan markers'):
                        publisher.main()
                self.assertEqual(page.read_text(),content)
                self.assertEqual(sorted(str(p.relative_to(site)) for p in site.rglob('*')),['dist','dist/index.html'])

    def test_historical_publisher_can_replace_an_existing_historical_section(self):
        publisher = load('historical_publisher', ROOT.parent / 'gongguan-hotspots-2026-10-19/publish_results.py')
        with tempfile.TemporaryDirectory() as folder:
            site=Path(folder);(site/'dist/images').mkdir(parents=True)
            study=site/'study';study.mkdir()
            for name in ['results/summary.json','results/quality.json','government/government.json',
                         'government/government-plan.md', 'results/figures/activity-ranking.png',
                         'results/figures/activity-hours.png','results/figures/station-context.png']:
                target=study/name;target.parent.mkdir(parents=True,exist_ok=True)
                shutil.copyfile(publisher.ROOT/name,target)
            page=site/'dist/index.html';page.write_text('before<!-- gongguan-delivery:start -->old<!-- gongguan-delivery:end -->after')
            with patch.object(publisher,'SITE',site),patch.object(publisher,'ROOT',study):publisher.main()
            text=page.read_text()
            self.assertTrue(text.startswith('before<!-- gongguan-delivery:start -->'))
            self.assertTrue(text.endswith('<!-- gongguan-delivery:end -->after'))
            self.assertEqual(text.count('id="hotspot-heading"'),1)
            self.assertTrue((study/'README.md').exists())

    def test_coordinate_limits_and_invalid_values(self):
        for module in (city, local):
            for x, y in [(121.4, 24.9), (121.7, 25.25)]:
                self.assertEqual(module.point(x, y), (x, y))
            for x, y in [(121.399, 25), (121.701, 25), (121.5, 24.899),
                         (121.5, 25.251), ('', 25), ('nan', 25), (None, 25)]:
                self.assertIsNone(module.point(x, y))

    def test_spacing_boundaries_and_candidate_limit(self):
        def station(sid, x, events=10, eligible=True):
            return dict(station_id=sid, lon=x, lat=0, events=events, eligible=eligible)
        # Isolate the selection threshold from spherical floating-point rounding.
        with patch.object(city, 'distance', lambda a, b: abs(a[0] - b[0])):
            for gap in (150, 300, 500):
                for offset, expected in [(gap-1, ['a']), (gap, ['a', 'b']), (gap+1, ['a', 'b'])]:
                    self.assertEqual([r['station_id'] for r in city.select(
                        [station('b', offset), station('a', 0)], gap)], expected)
            rows = [station(str(i), i*600) for i in range(4)]
            rows += [station('inactive', 9000, 100, False), station('unknown', 10000, 0)]
            self.assertEqual([r['station_id'] for r in city.select(rows)], ['0', '1', '2'])

    def test_local_service_radius_boundaries(self):
        with patch.object(local, 'distance', lambda a, b: b[0]):
            for radius in (50, 100, 150):
                rows = [dict(lon=n, lat=0, source_row=i+2, name=str(n))
                        for i, n in enumerate((radius, radius+1))]
                result = local.service(dict(lon=0, lat=0), rows, 'bins')
                self.assertEqual(result[f'bins_rows_{radius}m'], 1)

    def test_citywide_source_pipeline_preserves_exclusions(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)/'study';root.mkdir();(root/'results').mkdir()
            prior = root.parent/'youbike-bin-screening-2026-10-18/inputs';prior.mkdir(parents=True)
            feedback = root.parent/'feedback-2026-10-17';feedback.mkdir()
            (feedback/'summary.json').write_text(json.dumps(dict(districtAnalysis={}, districts={})))
            stations = []
            for i, (name, active, lon) in enumerate([
                ('near', '1', '121.501'), ('far', '1', '121.50101'),
                ('inactive', '0', '121.51'), ('unknown', '1', '121.52'),
                ('duplicate', '1', '121.53'), ('duplicate', '1', '121.54'),
                ('bad-coordinate', '1', ''), ('campus', '1', '121.55')]):
                stations.append(dict(sno=str(i), sna='YouBike2.0_'+name, act=active,
                    longitude=lon, latitude='25', ar=name,
                    sarea=city.CAMPUS if name=='campus' else city.DISTRICTS[0]))
            (prior/'youbike.json').write_text(json.dumps(stations))
            for filename in ('bins-2026.csv', 'bins-2024.csv', 'venues.csv'):
                (prior/filename).write_text('行政區,地址,經度,緯度\n松山區,fixture,121.5,25\n')
            archive=root/'fixture.zip'
            header='rent_time,rent_station,return_time,return_station,rent,bike_type,infodate\n'
            rows=[f'2026-07-01 10:00:00,{name},2026-07-01 11:00:00,{name},1,2,2026-07-01\n'
                  for name in ('near','far','inactive','duplicate','bad-coordinate','campus','unmapped')]
            rows += ['2026-07-10 10:00:00,near,2026-07-11 11:00:00,far,1,2,2026-07-10\n',
                     'invalid,near,2026-08-01 11:00:00,far,1,2,invalid\n','malformed\n']
            with zipfile.ZipFile(archive,'w') as z:z.writestr('trips.csv',header+''.join(rows))
            (root/'protocol.md').write_text('Synthetic regression fixture')
            (root/'manifest.json').write_text(json.dumps(dict(
                trip_archive=dict(sha256=city.digest(archive)),
                protocol_sha256=city.digest(root/'protocol.md'),inputs=[])))
            with patch.object(city,'ROOT',root), patch.object(city,'distance',lambda a,b:abs(a[0]-b[0])*100000), contextlib.redirect_stdout(io.StringIO()):
                result=city.main(archive)
                saved={r['name']:r for r in city.read_csv(root/'results/stations.csv')}
                self.assertEqual(len(saved),7) # Duplicate names retain distinct station IDs in the CSV.
                self.assertEqual(len(city.read_csv(root/'results/stations.csv')),8)
                self.assertEqual(result['totals']['borrow_unmatched'],2)
                self.assertEqual(result['totals']['return_unmatched'],2)
                self.assertEqual(result['totals']['borrow_invalid_time'],1)
                self.assertEqual(result['totals']['return_outside_month'],1)
                self.assertEqual(result['totals']['malformed_rows'],1)
                self.assertEqual(saved['near']['events'],'3')
                self.assertEqual(saved['near']['events_excluding_flags'],'2')
                self.assertEqual(saved['far']['events_excluding_flags'],'2')
                self.assertEqual(saved['unknown']['activity_status'],'no_matched_observation_UNKNOWN')
                for name in ('inactive','duplicate','bad-coordinate'):
                    self.assertEqual(saved[name]['eligible'],'False')
                self.assertEqual(saved['near']['street_nearest_m'],'100.0')
                self.assertTrue(saved['near']['next_check'].startswith('先核實'))
                self.assertEqual(saved['far']['street_nearest_m'],'101.0')
                self.assertTrue(saved['far']['next_check'].startswith('先補'))
                self.assertEqual(result['districts'][-1]['source_area'],city.CAMPUS)
                self.assertEqual(result['districts'][-1]['events'],2)
                with zipfile.ZipFile(archive,'a') as z:z.writestr('changed.txt','changed')
                with self.assertRaises(AssertionError):city.main(archive)


if __name__ == '__main__':
    unittest.main()

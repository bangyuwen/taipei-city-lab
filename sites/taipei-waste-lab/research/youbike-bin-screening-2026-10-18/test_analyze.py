"""Boundary checks for the research rules, independent of the saved outputs."""

import math
import unittest
import contextlib
import csv
import hashlib
import io
import json
import tempfile
from pathlib import Path
from unittest.mock import patch

import analyze


class ScreeningRulesTest(unittest.TestCase):
    def test_street_radius_is_inclusive_and_has_precedence(self):
        for radius in (50, 100, 150):
            with self.subTest(radius=radius):
                self.assertEqual(analyze.classify(radius, 0, radius, 250), "既有街道紀錄查核")
                self.assertEqual(analyze.classify(radius + 1, 0, radius, 250), "場所服務與街道可達性查核")
                self.assertEqual(analyze.classify(radius, 9999, radius, 250), "既有街道紀錄查核")

    def test_venue_radius_is_inclusive_and_does_not_infer_missing_bins(self):
        for radius in (100, 250, 400):
            with self.subTest(radius=radius):
                self.assertEqual(analyze.classify(101, radius, 100, radius), "場所服務與街道可達性查核")
                self.assertEqual(analyze.classify(101, radius + 1, 100, radius), "現有資料不足")

    def test_coordinate_bounds_and_bad_source_values(self):
        for lon in (121.40, 121.70):
            for lat in (24.90, 25.25):
                self.assertEqual(analyze.point(lon, lat), (lon, lat))
        for lon, lat in [(121.39, 25), (121.71, 25), (121.5, 24.89), (121.5, 25.26), ("?121.595369", 24.968972), (None, 25), (math.nan, 25), (121.5, math.inf)]:
            with self.subTest(lon=lon, lat=lat):
                self.assertIsNone(analyze.point(lon, lat))

    def test_distance_has_expected_scale_and_symmetry(self):
        origin = (121.5, 25.0)
        north = (121.5, 25.001)
        self.assertEqual(analyze.distance(origin, origin), 0)
        self.assertAlmostEqual(analyze.distance(origin, north), 111.1949266, places=5)
        self.assertAlmostEqual(analyze.distance(origin, north), analyze.distance(north, origin), places=8)

    def run_fixture(self, station_distance, duplicate_id=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            inputs = root / "inputs"
            inputs.mkdir()
            anchor = (121.5, 25.0)
            latitude = anchor[1] + math.degrees(station_distance / analyze.RADIUS)
            # Make the exact boundary representable on its inclusive side.
            while analyze.distance(anchor, (anchor[0], latitude)) > station_distance:
                latitude = math.nextafter(latitude, anchor[1])
            self.assertAlmostEqual(analyze.distance(anchor, (anchor[0], latitude)), station_distance, places=6)
            common = {"sarea": "中正區", "ar": "fixture", "longitude": anchor[0]}
            stations = [
                {**common, "sno": "active", "sna": "Active fixture", "latitude": latitude, "act": "1"},
                {**common, "sno": "active" if duplicate_id else "inactive", "sna": "Inactive fixture", "latitude": anchor[1], "act": "0"},
            ]
            (inputs / "youbike.json").write_text(json.dumps(stations))
            for name in ("bins-2026.csv", "bins-2024.csv", "venues.csv"):
                with (inputs / name).open("w", encoding="utf-8", newline="") as f:
                    writer = csv.writer(f)
                    writer.writerow(["行政區", "地址", "經度", "緯度", "備註"])
                    for label in analyze.ANCHORS if name == "venues.csv" else ["fixture bin"]:
                        writer.writerow(["中正區", label, *anchor, "fixture"])
            (inputs / "bin-source-manifest.json").write_text('{"files": {}}')
            (root / "protocol.md").write_text("fixture protocol")
            manifest = {"copied_bin_inputs": {}, "protocol_sha256": hashlib.sha256((root / "protocol.md").read_bytes()).hexdigest(), "files": {}}
            for p in inputs.iterdir():
                data = p.read_bytes()
                manifest["files"][p.name] = {"bytes": len(data), "sha256": hashlib.sha256(data).hexdigest()}
            (root / "manifest.json").write_text(json.dumps(manifest))
            with patch.object(analyze, "ROOT", root), contextlib.redirect_stdout(io.StringIO()):
                analyze.main()
            with (root / "results" / "cases.csv").open(encoding="utf-8-sig") as f:
                cases = list(csv.DictReader(f))
            with (root / "results" / "stations.csv").open(encoding="utf-8-sig") as f:
                records = list(csv.DictReader(f))
            return cases, records

    def test_case_cutoff_400m_and_inactive_station_exclusion(self):
        cases, records = self.run_fixture(400)
        self.assertEqual(len(cases), 6)
        self.assertTrue(all(r["station_id"] == "active" for r in cases))
        self.assertEqual(records[1]["lane"], "非啟用站，不列候選")
        cases, _ = self.run_fixture(401)
        self.assertTrue(all(r["lane"] == "400m 內無匹配站" and not r["station_id"] for r in cases))

    def test_duplicate_station_ids_stop_instead_of_silently_deduplicating(self):
        with self.assertRaisesRegex(AssertionError, "Duplicate station IDs"):
            self.run_fixture(100, duplicate_id=True)


if __name__ == "__main__":
    unittest.main()

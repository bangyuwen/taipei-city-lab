"""Reproduce the fixed, offline YouBike/bin desktop screening using stdlib only."""

import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
RADIUS = 6_371_000
ANCHORS = ["西門捷運站", "公館捷運站", "龍山寺捷運站", "101站/世貿捷運站", "新北投捷運站", "南港捷運站"]
LANES = ["既有街道紀錄查核", "場所服務與街道可達性查核", "現有資料不足"]


def point(lon, lat):
    try:
        lon, lat = float(lon), float(lat)
    except (ValueError, TypeError):
        return None
    return (lon, lat) if 121.40 <= lon <= 121.70 and 24.90 <= lat <= 25.25 else None


def distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lon2 - lon1) / 2) ** 2
    return 2 * RADIUS * math.asin(math.sqrt(min(1.0, max(0.0, h))))


def cosine_distance(a, b):
    lon1, lat1, lon2, lat2 = map(math.radians, (*a, *b))
    c = math.sin(lat1) * math.sin(lat2) + math.cos(lat1) * math.cos(lat2) * math.cos(lon2 - lon1)
    return RADIUS * math.acos(min(1.0, max(-1.0, c)))


def read_csv(name):
    with (ROOT / "inputs" / name).open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def write_csv(path, rows):
    if not rows:
        path.write_text("", encoding="utf-8")
        return
    with path.open("w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def classify(bin_distance, venue_distance, bin_radius=100, venue_radius=250):
    if bin_distance <= bin_radius:
        return LANES[0]
    if venue_distance <= venue_radius:
        return LANES[1]
    return LANES[2]


def main():
    manifest = json.loads((ROOT / "manifest.json").read_text())
    for name, receipt in manifest["files"].items():
        data = (ROOT / "inputs" / name).read_bytes()
        assert len(data) == receipt["bytes"], name
        assert hashlib.sha256(data).hexdigest() == receipt["sha256"], name
    assert hashlib.sha256((ROOT / "protocol.md").read_bytes()).hexdigest() == manifest["protocol_sha256"]
    # Check copied historical inputs against the original, retained provenance.
    original = json.loads((ROOT / "inputs" / "bin-source-manifest.json").read_text())
    for name, src in manifest["copied_bin_inputs"].items():
        if src in original["files"]:
            assert manifest["files"][name]["sha256"] == original["files"][src]["sha256"], name

    raw = {"bins2026": read_csv("bins-2026.csv"), "bins2024": read_csv("bins-2024.csv"), "venues": read_csv("venues.csv")}
    valid, invalid = {}, []
    for source, rows in raw.items():
        valid[source] = []
        for row_id, row in enumerate(rows, 1):
            p = point(row["經度"], row["緯度"])
            if p is None:
                invalid.append({"source": source, "row_or_station_id": row_id, "reason": "invalid_or_outside_coordinate_bounds", "raw_json": json.dumps(row, ensure_ascii=False)})
            else:
                valid[source].append((row_id, row, p))
        assert len(rows) == len(valid[source]) + sum(x["source"] == source for x in invalid)

    stations = json.loads((ROOT / "inputs" / "youbike.json").read_text())
    assert len({x["sno"] for x in stations}) == len(stations), "Duplicate station IDs"
    records, distances, station_points = [], {}, {}
    for station in sorted(stations, key=lambda s: s["sno"]):
        sid = station["sno"]
        p = point(station.get("longitude"), station.get("latitude"))
        record = {"station_id": sid, "station_name": station["sna"], "source_area": station["sarea"], "address": station["ar"], "longitude": station.get("longitude", ""), "latitude": station.get("latitude", ""), "act": str(station["act"]), "source_update_time": station.get("srcUpdateTime", ""), "station_info_time": station.get("infoTime", ""), "coordinate_valid": p is not None}
        nearest = {}
        for source, items in valid.items():
            ordered = sorted(((distance(p, q), row_id, row, q) for row_id, row, q in items), key=lambda x: (x[0], x[1])) if p else []
            if ordered:
                d, row_id, row, q = ordered[0]
                nearest[source] = d
                record.update({f"{source}_nearest_row": row_id, f"{source}_nearest_name": row["地址"], f"{source}_nearest_district": row["行政區"], f"{source}_nearest_m": round(d, 2)})
            else:
                record.update({f"{source}_nearest_row": "", f"{source}_nearest_name": "", f"{source}_nearest_district": "", f"{source}_nearest_m": ""})
            if source == "bins2026":
                counts = []
                for radius in (50, 100, 150):
                    hits = [x for x in ordered if x[0] <= radius]
                    record[f"bins2026_rows_{radius}m"] = len(hits)
                    record[f"bins2026_unique_coordinates_{radius}m"] = len({x[3] for x in hits})
                    counts.append(len(hits))
                assert counts == sorted(counts)
        if p:
            distances[sid] = nearest
            station_points[sid] = p
            record["lane"] = classify(nearest["bins2026"], nearest["venues"]) if record["act"] == "1" else "非啟用站，不列候選"
        else:
            record["lane"] = "座標異常，不列候選"
            invalid.append({"source": "youbike", "row_or_station_id": sid, "reason": "invalid_or_outside_coordinate_bounds", "raw_json": json.dumps(station, ensure_ascii=False)})
        records.append(record)

    active = [r for r in records if r["act"] == "1" and r["coordinate_valid"]]
    assert active, "No valid active stations"
    sensitivity = []
    for br in (50, 100, 150):
        for vr in (100, 250, 400):
            counts = Counter(classify(distances[r["station_id"]]["bins2026"], distances[r["station_id"]]["venues"], br, vr) for r in active)
            assert sum(counts.values()) == len(active)
            sensitivity.append({"bin_radius_m": br, "venue_radius_m": vr, **{lane: counts[lane] for lane in LANES}, "denominator": len(active)})

    cases, checks = [], []
    for anchor in ANCHORS:
        matches = [x for x in valid["venues"] if x[1]["地址"] == anchor]
        assert matches, anchor
        coords = {x[2] for x in matches}
        assert len(coords) == 1, f"Ambiguous anchor coordinates: {anchor}"
        anchor_point = next(iter(coords))
        ordered = sorted(((distance(anchor_point, station_points[r["station_id"]]), r["station_id"], r) for r in active), key=lambda x: (x[0], x[1]))
        d, sid, record = ordered[0]
        if d > 400:
            cases.append({"anchor": anchor, "venue_source_rows": ";".join(str(x[0]) for x in matches), "anchor_to_station_m": "", **{k: "" for k in records[0]}, "map_url": ""})
            cases[-1]["lane"] = "400m 內無匹配站"
            continue
        cases.append({"anchor": anchor, "venue_source_rows": ";".join(str(x[0]) for x in matches), "anchor_to_station_m": round(d, 2), **record, "map_url": f"https://www.google.com/maps/search/?api=1&query={record['latitude']},{record['longitude']}"})
        b = next(x for x in valid["bins2026"] if x[0] == record["bins2026_nearest_row"])
        primary = distances[sid]["bins2026"]
        alternative = cosine_distance(station_points[sid], b[2])
        assert abs(primary - alternative) < 0.03
        checks.append({"anchor": anchor, "haversine_m": primary, "spherical_cosine_m": alternative, "difference_m": abs(primary - alternative)})

    district_rows = []
    for district in sorted({r["source_area"] for r in records}):
        subset = [r for r in active if r["source_area"] == district]
        counts = Counter(r["lane"] for r in subset)
        district_rows.append({"source_area": district, "active_valid_stations": len(subset), "raw_2026_bin_rows": sum(r["行政區"] == district for r in raw["bins2026"]) if district.endswith("區") and district != "臺大公館校區" else "not_comparable", **{lane: counts[lane] for lane in LANES}})

    summary = {"station_rows": len(stations), "active_valid_stations": len(active), "act_values": dict(Counter(str(r["act"]) for r in stations)), "source_update_times": sorted({r.get("srcUpdateTime", "") for r in stations}), "inputs": {source: {"raw_rows": len(raw[source]), "valid_coordinate_rows": len(valid[source]), "unique_valid_coordinates": len({x[2] for x in valid[source]})} for source in raw}, "lanes": dict(Counter(r["lane"] for r in active)), "sensitivity": sensitivity, "distance_cross_checks": checks, "invalid_rows": len(invalid), "limitations": ["Straight-line coordinate distances, not walking routes or same-side access", "Different source dates; street-bin citywide coverage is unverified", "Venue rows are service leads, not individual bins or measured demand", "No usage, garbage, sidewalk clearance, cost or causal-effect measurements", "Six fixed purposive cases are not a representative sample"]}
    summary["source_area_strata"] = {}
    for label, is_campus in [("臺大公館校區", True), ("其他來源區域", False)]:
        subset = [r for r in active if (r["source_area"] == "臺大公館校區") == is_campus]
        summary["source_area_strata"][label] = {"active_valid_stations": len(subset), "lanes": dict(Counter(r["lane"] for r in subset))}
    out = ROOT / "results"
    out.mkdir(exist_ok=True)
    write_csv(out / "stations.csv", records)
    write_csv(out / "cases.csv", cases)
    write_csv(out / "districts.csv", district_rows)
    write_csv(out / "sensitivity.csv", sensitivity)
    write_csv(out / "invalid-records.csv", invalid)
    (out / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"stations": len(records), "active_valid": len(active), "lanes": summary["lanes"], "invalid_rows": len(invalid), "cases": [{k: c[k] for k in ("anchor", "station_name", "bins2026_nearest_m", "bins2026_nearest_name", "bins2024_nearest_m", "lane")} for c in cases]}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

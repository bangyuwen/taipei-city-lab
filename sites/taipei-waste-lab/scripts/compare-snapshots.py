#!/usr/bin/env python3
"""Generate a deterministic, source-row comparison for the frozen snapshots."""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import re
import sys
import unicodedata
from collections import Counter, defaultdict, deque
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent.parent
RECOVERY_DIR = Path("research/source-recovery-2026-10-15")
PROTOCOL_PATH = Path("research/comparison-2024-2026/protocol.json")
OUTPUT_JSON = Path("dist/data/comparison-2024-2026.json")
OUTPUT_CSV = Path("dist/data/comparison-2024-2026.csv")
DISTRICTS = [
    "中正區", "大同區", "中山區", "松山區", "大安區", "萬華區",
    "信義區", "士林區", "北投區", "內湖區", "南港區", "文山區",
]
DISTRICT_RANK = {district: index for index, district in enumerate(DISTRICTS)}
COORDINATE_TOKEN = re.compile(
    r"[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?\Z"
)
SUMMARY_FIELDS = (
    "beforeRows", "afterRows", "deltaRows", "exactPairs", "sameAddressPairs",
    "ambiguousBeforeRows", "ambiguousAfterRows", "notReappearedRows",
    "notReappearedAddresses", "only2026Rows", "only2026Addresses",
)
RECORD_FIELDS = (
    "id", "sourceRow", "district", "address", "rawX", "rawY", "x", "y",
    "plottable", "quality",
)
CATEGORY_LABELS = {
    "same_fields": "地址及座標欄位相同",
    "same_address_changed": "同址座標不同，待核對",
    "ambiguous": "同址多筆，未能配對",
    "not_reappeared": "2024 地址未再出現",
    "only_2026": "只在 2026 出現的地址",
}
CATEGORY_RANK = {category: index for index, category in enumerate(CATEGORY_LABELS)}


def normalized_text(value: Any) -> str:
    text = unicodedata.normalize("NFKC", "" if value is None else str(value))
    return "".join(character for character in text if not character.isspace()).replace("臺", "台")


def finite_decimal(value: Any) -> Decimal | None:
    text = unicodedata.normalize("NFKC", "" if value is None else str(value)).strip()
    if not COORDINATE_TOKEN.fullmatch(text):
        return None
    try:
        number = Decimal(text)
    except InvalidOperation:
        return None
    return number if number.is_finite() else None


def coordinate_key(value: Any) -> tuple[str, Decimal | str]:
    number = finite_decimal(value)
    if number is not None:
        # Decimal equality and hashing compare numeric value without rounding.
        return ("number", number)
    return ("text", normalized_text(value))


def parse_address(row: dict[str, Any]) -> str:
    address = row.get("地址") or ""
    if address:
        return str(address)
    road = row.get("路名") or ""
    other = row.get("段、號及其他註明", row.get("段號及其他註明", "")) or ""
    road, other = str(road), str(other)
    return other if road and other.startswith(road) else road + other


def load_protocol(root: Path) -> dict[str, Any]:
    path = root / PROTOCOL_PATH
    protocol = json.loads(path.read_text(encoding="utf-8"))
    if protocol.get("frozenBeforeCalculation") is not True:
        raise ValueError("protocol must declare frozenBeforeCalculation=true")
    for side in ("before", "after"):
        source = protocol.get(side)
        if not isinstance(source, dict):
            raise ValueError(f"protocol is missing {side} source metadata")
        if Path(str(source.get("file", ""))).name != source.get("file"):
            raise ValueError(f"protocol {side}.file must be a filename")
        if not isinstance(source.get("expectedRows"), int) or source["expectedRows"] < 0:
            raise ValueError(f"protocol {side}.expectedRows must be a non-negative integer")
        if not source.get("sha256") or not source.get("date") or not source.get("key"):
            raise ValueError(f"protocol {side} source metadata is incomplete")
    for field in ("addressNormalization", "coordinateNormalization", "rules", "limits", "unit"):
        if field not in protocol:
            raise ValueError(f"protocol is missing {field}")
    return protocol


def read_source(root: Path, source: dict[str, Any]) -> tuple[list[dict[str, Any]], str]:
    path = root / RECOVERY_DIR / source["file"]
    payload = path.read_bytes()
    digest = hashlib.sha256(payload).hexdigest()
    if digest != source["sha256"]:
        raise ValueError(f"source hash mismatch for {source['file']}: expected {source['sha256']}, got {digest}")

    records: list[dict[str, Any]] = []
    with path.open(encoding="utf-8-sig", newline="") as stream:
        reader = csv.DictReader(stream)
        headers = reader.fieldnames
        if not headers:
            raise ValueError(f"source has no CSV header: {source['file']}")
        required = {"行政區", "經度", "緯度"}
        missing = sorted(required.difference(headers))
        if missing:
            raise ValueError(f"source is missing required columns in {source['file']}: {', '.join(missing)}")

        previous_end_line = reader.line_num
        for row_index, row in enumerate(reader, start=1):
            source_row = previous_end_line + 1
            if None in row:
                raise ValueError(f"source has extra CSV fields at physical line {source_row}: {source['file']}")
            previous_end_line = reader.line_num
            raw_x, raw_y = row.get("經度"), row.get("緯度")
            decimal_x, decimal_y = finite_decimal(raw_x), finite_decimal(raw_y)
            coordinates_valid = decimal_x is not None and decimal_y is not None
            if coordinates_valid:
                x, y = float(decimal_x), float(decimal_y)
                if not math.isfinite(x) or not math.isfinite(y):
                    raise ValueError(f"finite Decimal coordinate is outside JSON number range at {source['file']}:{source_row}")
                plottable = (
                    Decimal("121.4") < decimal_x < Decimal("121.7")
                    and Decimal("24.95") < decimal_y < Decimal("25.3")
                )
            else:
                x = y = None
                plottable = False

            district = "" if row.get("行政區") is None else str(row["行政區"])
            address = parse_address(row)
            record_id = f"{source['key']}-row-{row_index}"
            records.append({
                "id": record_id,
                "sourceRow": source_row,
                "district": district,
                "address": address,
                "rawX": raw_x,
                "rawY": raw_y,
                "x": x,
                "y": y,
                "plottable": plottable,
                "quality": "通過座標粗篩，尚未逐點核實" if plottable else "座標待核對，保留原始紀錄",
                "_rowIndex": row_index,
                "_districtKey": normalized_text(district),
                "_addressKey": normalized_text(address),
                "_coordinateKey": (coordinate_key(raw_x), coordinate_key(raw_y)),
            })

    if len(records) != source["expectedRows"]:
        raise ValueError(
            f"source row count mismatch for {source['file']}: "
            f"expected {source['expectedRows']}, got {len(records)}"
        )
    return records, digest


def public_record(record: dict[str, Any]) -> dict[str, Any]:
    return {field: record[field] for field in RECORD_FIELDS}


def make_entry(
    category: str,
    before: list[dict[str, Any]],
    after: list[dict[str, Any]],
    district: str,
    address: str,
    district_key: str,
) -> dict[str, Any]:
    return {
        "category": category,
        "district": district,
        "address": address,
        "before": [public_record(record) for record in before],
        "after": [public_record(record) for record in after],
        "_districtKey": district_key,
        "_beforeOrder": min((record["_rowIndex"] for record in before), default=10**12),
        "_afterOrder": min((record["_rowIndex"] for record in after), default=10**12),
    }


def compare_groups(
    before_records: list[dict[str, Any]], after_records: list[dict[str, Any]]
) -> list[dict[str, Any]]:
    before_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    after_groups: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    ordered_keys: list[tuple[str, str]] = []
    seen: set[tuple[str, str]] = set()
    for records, groups in ((before_records, before_groups), (after_records, after_groups)):
        for record in records:
            key = (record["_districtKey"], record["_addressKey"])
            groups[key].append(record)
            if key not in seen:
                seen.add(key)
                ordered_keys.append(key)

    entries: list[dict[str, Any]] = []
    for district_key, address_key in ordered_keys:
        key = (district_key, address_key)
        before = before_groups.get(key, [])
        after = after_groups.get(key, [])
        representative = (before or after)[0]
        district = representative["district"]
        address = representative["address"]

        after_by_coordinates: dict[Any, deque[int]] = defaultdict(deque)
        for after_index, record in enumerate(after):
            after_by_coordinates[record["_coordinateKey"]].append(after_index)
        matched_after: set[int] = set()
        unmatched_before: list[dict[str, Any]] = []
        for record in before:
            candidates = after_by_coordinates[record["_coordinateKey"]]
            if candidates:
                after_index = candidates.popleft()
                matched_after.add(after_index)
                entries.append(make_entry(
                    "same_fields", [record], [after[after_index]], district, address, district_key
                ))
            else:
                unmatched_before.append(record)
        unmatched_after = [record for index, record in enumerate(after) if index not in matched_after]

        if not before:
            entries.append(make_entry("only_2026", [], after, district, address, district_key))
        elif not after:
            entries.append(make_entry("not_reappeared", before, [], district, address, district_key))
        elif not unmatched_before and not unmatched_after:
            continue
        elif len(before) == 1 and len(after) == 1:
            entries.append(make_entry(
                "same_address_changed", unmatched_before, unmatched_after, district, address, district_key
            ))
        else:
            entries.append(make_entry(
                "ambiguous", unmatched_before, unmatched_after, district, address, district_key
            ))

    for entry in entries:
        if entry["_districtKey"] not in DISTRICT_RANK:
            raise ValueError(f"source contains an unlisted Taipei district: {entry['district']!r}")
    entries.sort(key=lambda entry: (
        DISTRICT_RANK[entry["_districtKey"]], entry["_beforeOrder"], entry["_afterOrder"],
        CATEGORY_RANK[entry["category"]],
        tuple(record["id"] for record in entry["before"]),
        tuple(record["id"] for record in entry["after"]),
    ))
    for index, entry in enumerate(entries, start=1):
        entry["id"] = f"comparison-{index:06d}"
    return entries


def summarize(entries: list[dict[str, Any]]) -> dict[str, int]:
    result = {field: 0 for field in SUMMARY_FIELDS}
    for entry in entries:
        before_count, after_count = len(entry["before"]), len(entry["after"])
        result["beforeRows"] += before_count
        result["afterRows"] += after_count
        if entry["category"] == "same_fields":
            result["exactPairs"] += 1
        elif entry["category"] == "same_address_changed":
            result["sameAddressPairs"] += 1
        elif entry["category"] == "ambiguous":
            result["ambiguousBeforeRows"] += before_count
            result["ambiguousAfterRows"] += after_count
        elif entry["category"] == "not_reappeared":
            result["notReappearedRows"] += before_count
            result["notReappearedAddresses"] += 1
        elif entry["category"] == "only_2026":
            result["only2026Rows"] += after_count
            result["only2026Addresses"] += 1
        else:
            raise ValueError(f"unknown comparison category: {entry['category']}")
    result["deltaRows"] = result["afterRows"] - result["beforeRows"]
    return result


def verify_conservation(
    entries: list[dict[str, Any]], before_records: list[dict[str, Any]], after_records: list[dict[str, Any]]
) -> tuple[dict[str, int], list[dict[str, Any]]]:
    before_ids = Counter(record["id"] for entry in entries for record in entry["before"])
    after_ids = Counter(record["id"] for entry in entries for record in entry["after"])
    expected_before_ids = Counter(record["id"] for record in before_records)
    expected_after_ids = Counter(record["id"] for record in after_records)
    if before_ids != expected_before_ids or any(count != 1 for count in before_ids.values()):
        raise ValueError("before-side row conservation failed: every source row must occur exactly once")
    if after_ids != expected_after_ids or any(count != 1 for count in after_ids.values()):
        raise ValueError("after-side row conservation failed: every source row must occur exactly once")

    totals = summarize(entries)
    districts: list[dict[str, Any]] = []
    for district in DISTRICTS:
        district_entries = [entry for entry in entries if entry["_districtKey"] == district]
        summary = summarize(district_entries)
        if summary["beforeRows"] != (
            summary["exactPairs"] + summary["sameAddressPairs"] + summary["ambiguousBeforeRows"]
            + summary["notReappearedRows"]
        ):
            raise ValueError(f"before-side district conservation failed for {district}")
        if summary["afterRows"] != (
            summary["exactPairs"] + summary["sameAddressPairs"] + summary["ambiguousAfterRows"]
            + summary["only2026Rows"]
        ):
            raise ValueError(f"after-side district conservation failed for {district}")
        summary["district"] = district
        districts.append(summary)

    if totals["beforeRows"] != (
        totals["exactPairs"] + totals["sameAddressPairs"] + totals["ambiguousBeforeRows"]
        + totals["notReappearedRows"]
    ):
        raise ValueError("before-side global conservation failed")
    if totals["afterRows"] != (
        totals["exactPairs"] + totals["sameAddressPairs"] + totals["ambiguousAfterRows"]
        + totals["only2026Rows"]
    ):
        raise ValueError("after-side global conservation failed")
    return totals, districts


def source_metadata(source: dict[str, Any], records: list[dict[str, Any]], digest: str) -> dict[str, Any]:
    return {
        "key": source["key"],
        "file": source["file"],
        "sha256": digest,
        "rows": len(records),
        "date": source["date"],
    }


def csv_safe(value: Any) -> Any:
    if not isinstance(value, str):
        return value
    if value.lstrip().startswith(("=", "+", "-", "@")):
        return "'" + value
    return value


def write_csv(path: Path, entries: list[dict[str, Any]], protocol: dict[str, Any], meta: dict[str, Any]) -> None:
    fields = (
        "comparisonid", "category", "categoryLabel", "version", "versiondate",
        "sourcefilename", "sourceRow", "id", "district", "address", "rawlongitude",
        "rawlatitude", "quality", "limitations",
    )
    limitation_text = "；".join(protocol["limits"])
    with path.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for entry in entries:
            for side in ("before", "after"):
                source = meta[side]
                for record in entry[side]:
                    row = {
                        "comparisonid": entry["id"],
                        "category": entry["category"],
                        "categoryLabel": CATEGORY_LABELS[entry["category"]],
                        "version": source["key"],
                        "versiondate": source["date"],
                        "sourcefilename": source["file"],
                        "sourceRow": record["sourceRow"],
                        "id": record["id"],
                        "district": record["district"],
                        "address": record["address"],
                        "rawlongitude": record["rawX"],
                        "rawlatitude": record["rawY"],
                        "quality": record["quality"],
                        "limitations": limitation_text,
                    }
                    writer.writerow({key: csv_safe(value) for key, value in row.items()})


def generate(root: Path) -> tuple[dict[str, Any], dict[str, int]]:
    protocol = load_protocol(root)
    before_records, before_digest = read_source(root, protocol["before"])
    after_records, after_digest = read_source(root, protocol["after"])
    entries = compare_groups(before_records, after_records)
    totals, districts = verify_conservation(entries, before_records, after_records)
    meta = {
        "protocolVersion": protocol["version"],
        "before": source_metadata(protocol["before"], before_records, before_digest),
        "after": source_metadata(protocol["after"], after_records, after_digest),
        "normalization": {
            "address": protocol["addressNormalization"],
            "coordinates": protocol["coordinateNormalization"],
        },
        "rules": protocol["rules"],
        "limits": protocol["limits"],
        "unit": protocol["unit"],
    }
    public_entries = [
        {key: value for key, value in entry.items() if not key.startswith("_")}
        for entry in entries
    ]
    payload = {"meta": meta, "totals": totals, "districts": districts, "entries": public_entries}

    json_path, csv_path = root / OUTPUT_JSON, root / OUTPUT_CSV
    json_path.parent.mkdir(parents=True, exist_ok=True)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    with json_path.open("w", encoding="utf-8", newline="\n") as stream:
        stream.write(json.dumps(payload, ensure_ascii=False, indent=2, allow_nan=False) + "\n")
    write_csv(csv_path, entries, protocol, meta)
    return payload, {"jsonBytes": json_path.stat().st_size, "csvBytes": csv_path.stat().st_size}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT, help="site root containing research/ and dist/")
    args = parser.parse_args(argv)
    root = args.root.resolve()
    try:
        payload, sizes = generate(root)
    except (OSError, ValueError, csv.Error) as error:
        print(f"compare-snapshots.py: error: {error}", file=sys.stderr)
        return 2
    print(
        "Generated comparison: "
        f"{payload['totals']['beforeRows']} before rows, "
        f"{payload['totals']['afterRows']} after rows, "
        f"{len(payload['entries'])} entries "
        f"(JSON {sizes['jsonBytes']} bytes, CSV {sizes['csvBytes']} bytes)."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

#!/usr/bin/env python3
"""Reproduce the bounded, offline checks for the Taipei cleaning-box source audit."""

from __future__ import annotations

import csv
import io
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
AUDIT = Path(__file__).resolve().parent
SOURCE = ROOT / "research" / "source-recovery-2026-10-15"
MANIFEST_PATH = SOURCE / "manifest.json"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def profile(filename: str) -> dict[str, object]:
    columns, rows = read_csv(SOURCE / filename)
    districts = Counter((row.get("行政區") or "").strip() for row in rows)
    return {
        "rows": len(rows),
        "columns": columns,
        "district_counts": dict(sorted(districts.items())),
        "empty_required_fields": {
            name: sum(not (row.get(name) or "").strip() for row in rows)
            for name in columns
        },
        "exact_duplicate_rows": len(rows) - len({tuple(row.get(c, "") for c in columns) for row in rows}),
    }


def main() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    file_checks: list[dict[str, object]] = []
    for relpath, expected in manifest["files"].items():
        path = SOURCE / relpath
        exists = path.is_file()
        actual_bytes = path.stat().st_size if exists else None
        actual_sha256 = sha256(path) if exists else None
        file_checks.append({
            "path": relpath,
            "exists": exists,
            "expected_bytes": expected["bytes"],
            "actual_bytes": actual_bytes,
            "expected_sha256": expected["sha256"],
            "actual_sha256": actual_sha256,
            "match": exists and actual_bytes == expected["bytes"] and actual_sha256 == expected["sha256"],
        })

    archive = profile("taipei-bins-2024-10-18-archive-utc.csv")
    published = profile("taipei-bins-2026-09-30-published.csv")
    parsed_catalog = json.loads((SOURCE / "raw" / "catalog-parsed.json").read_text(encoding="utf-8"))
    response_path = AUDIT / "receipts" / "02-statistics-and-records.json"
    response_text = response_path.read_text(encoding="utf-8")
    excerpt_path = AUDIT / "receipts" / "01-official-excerpts.json"
    excerpt_receipt = json.loads(excerpt_path.read_text(encoding="utf-8"))
    attempts_path = AUDIT / "raw" / "statistics-download-attempts.json"
    attempts = json.loads(attempts_path.read_text(encoding="utf-8"))
    stats_raw_path = AUDIT / "raw" / "environment-statistics-response.raw"
    stats_raw = stats_raw_path.read_bytes()
    stats_rows = list(csv.reader(io.StringIO(stats_raw.decode("utf-8-sig"))))
    stats_header = stats_rows[0]
    stats_column = stats_header.index("行人專用清潔箱[個]")
    annual_values = []
    for row in stats_rows[1:]:
        if not row:
            continue
        roc_year = int(row[0].removesuffix("年"))
        annual_values.append({
            "roc_year": roc_year,
            "gregorian_year": roc_year + 1911,
            "count": int(row[stats_column]),
            "unit": "個",
        })
    annual_csv_path = AUDIT / "annual-values.csv"
    with annual_csv_path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["民國年", "西元年", "行人專用清潔箱[個]"])
        for value in annual_values:
            writer.writerow([value["roc_year"], value["gregorian_year"], value["count"]])
    stats_attempt = next((row for row in attempts if row.get("http_status") == 200), {})
    stats_digest_matches = (
        stats_attempt.get("response_bytes") == len(stats_raw)
        and stats_attempt.get("response_sha256") == sha256(stats_raw_path)
    )
    annual_by_year = {value["gregorian_year"]: value["count"] for value in annual_values}

    report = {
        "inputs": {
            "manifest": str(MANIFEST_PATH.relative_to(ROOT)),
            "receipt_01": str(excerpt_path.relative_to(ROOT)),
            "receipt_01_sha256": sha256(excerpt_path),
            "receipt_02": str(response_path.relative_to(ROOT)),
            "receipt_02_sha256": sha256(response_path),
            "receipt_02_contains_statistics_fetch_error": "application/octet-stream" in response_text,
            "receipt_02_contains_2015_procedure": "清潔箱列管清冊" in response_text,
            "statistics_attempts": str(attempts_path.relative_to(ROOT)),
            "statistics_attempts_sha256": sha256(attempts_path),
            "statistics_raw": str(stats_raw_path.relative_to(ROOT)),
            "statistics_raw_bytes": len(stats_raw),
            "statistics_raw_sha256": sha256(stats_raw_path),
            "statistics_raw_hash_matches_http_receipt": stats_digest_matches,
        },
        "manifest_file_checks": file_checks,
        "all_manifest_files_match": all(check["match"] for check in file_checks),
        "datasets": {
            "2024-10-18-archive": archive,
            "2026-09-30-published": published,
        },
        "catalog": {
            "number_of_data": parsed_catalog.get("number_of_data"),
            "metadata_changed": parsed_catalog.get("metadata_changed"),
            "resource_last_modified": parsed_catalog["resources"][0].get("last_modified"),
            "declared_fields": parsed_catalog.get("field_description"),
            "temporal_coverage_start": parsed_catalog.get("coverage_temporal_start"),
            "temporal_coverage_end": parsed_catalog.get("coverage_temporal_end"),
            "catalog_count_equals_published_csv_rows": parsed_catalog.get("number_of_data") == published["rows"],
        },
        "annual_statistics": {
            "official_field": "行人專用清潔箱[個]",
            "http_status": stats_attempt.get("http_status"),
            "content_type": stats_attempt.get("response_headers", {}).get("Content-Type"),
            "encoding": "UTF-8 with optional BOM",
            "year_count": len(annual_values),
            "start_year": annual_values[0]["gregorian_year"] if annual_values else None,
            "end_year": annual_values[-1]["gregorian_year"] if annual_values else None,
            "annual_values_file": str(annual_csv_path.relative_to(ROOT)),
            "annual_values": annual_values,
            "statistical_2017_count": annual_by_year.get(2017),
            "statistical_2025_count": annual_by_year.get(2025),
            "catalog_2009_matches_2017_statistic": parsed_catalog.get("number_of_data") == annual_by_year.get(2017),
            "interpretation": "The annual statistical series is a separate aggregate measure with unit 個; no source-defined crosswalk to the current CSV row count was found.",
        },
        "required_observations": {
            "2024_rows": archive["rows"] == 1971,
            "2026_rows": published["rows"] == 681,
            "catalog_number_of_data_is_2009": parsed_catalog.get("number_of_data") == 2009,
            "catalog_count_conflicts_with_published_file": parsed_catalog.get("number_of_data") != published["rows"],
            "statistics_http_200_and_hash_match": stats_attempt.get("http_status") == 200 and stats_digest_matches,
            "statistics_has_30_annual_values": len(annual_values) == 30,
            "statistics_2017_value_is_2009": annual_by_year.get(2017) == 2009,
            "statistics_2025_value_is_1682": annual_by_year.get(2025) == 1682,
            "2024_beitou_rows": archive["district_counts"].get("北投區") == 98,
            "2026_beitou_rows": published["district_counts"].get("北投區", 0) == 0,
            "2024_nangang_rows": archive["district_counts"].get("南港區") == 94,
            "2026_nangang_rows": published["district_counts"].get("南港區") == 4,
            "five_location_fields_only": archive["columns"] == ["行政區", "地址", "經度", "緯度", "備註"] and published["columns"] == ["行政區", "地址", "經度", "緯度", "備註"],
            "public_csv_has_no_facility_id_or_survey_date_field": not any(any(token in column.lower() for token in ("id", "編號", "箱號", "日期", "時間", "狀態", "數量")) for column in published["columns"]),
            "no_empty_cells": not any(archive["empty_required_fields"].values()) and not any(published["empty_required_fields"].values()),
        },
        "source_ids_and_dates": {
            "dataset_id": manifest["dataset_id"],
            "resource_id": manifest["resource_id"],
            "archive_capture_utc": manifest["snapshots"][0]["capture_utc"],
            "archive_capture_taipei": manifest["snapshots"][0]["capture_taipei"],
            "archive_survey_date": manifest["snapshots"][0]["survey_date"],
            "published_source_updated_at": manifest["snapshots"][1]["source_updated_at_literal"],
            "published_survey_date": manifest["snapshots"][1]["survey_date"],
            "statistics_request_time_utc": stats_attempt.get("attempted_at_utc"),
            "statistics_response_date_header": stats_attempt.get("response_headers", {}).get("Date"),
            "excerpt_sources": len(excerpt_receipt["sources"]),
        },
        "interpretation_guardrails": [
            "Catalog metadata count 2009 and downloadable CSV row count 681 conflict; reconciliation is not established.",
            "Rows absent from a later version do not prove physical removal.",
            "Same-address rows with different coordinates do not prove identity or relocation.",
            "Snapshot/download/update/capture dates are not field-survey or event dates.",
            "Historical procedures establish a previous register workflow, not the current post-2022 process or public record availability.",
            "Neither snapshot proves complete citywide physical inventory.",
        ],
    }
    report["all_required_observations_pass"] = all(report["required_observations"].values())
    output = AUDIT / "verification.json"
    output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({
        "verification_file": str(output.relative_to(ROOT)),
        "manifest_files": len(file_checks),
        "all_manifest_files_match": report["all_manifest_files_match"],
        "datasets": {
            "2024_rows": archive["rows"],
            "2026_rows": published["rows"],
            "2026_beitou_rows": published["district_counts"].get("北投區", 0),
            "2026_nangang_rows": published["district_counts"].get("南港區", 0),
        },
        "catalog_number_of_data": report["catalog"]["number_of_data"],
        "all_required_observations_pass": report["all_required_observations_pass"],
    }, ensure_ascii=False, indent=2))
    if not report["all_manifest_files_match"] or not report["all_required_observations_pass"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
"""Fetch the already-receipted official statistics URL at most twice."""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

AUDIT = Path(__file__).resolve().parent
RECEIPT = AUDIT / "receipts" / "02-statistics-and-records.json"
ATTEMPTS = AUDIT / "raw" / "statistics-download-attempts.json"
RAW = AUDIT / "raw" / "environment-statistics-response.raw"


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def get_url() -> str:
    result = json.loads(RECEIPT.read_text(encoding="utf-8"))
    if not isinstance(result, str):
        raise TypeError("Expected the saved web tool response to be a text result")
    match = re.search(
        r"https://tsis\.dbas\.gov\.taipei/statis/webMain\.aspx\?[A-Za-z0-9_=&.-]+",
        result,
    )
    if not match:
        raise ValueError("The official statistics URL was not found in the existing receipt")
    return match.group(0)


def parse_payload(payload: bytes) -> dict[str, object]:
    attempted: list[dict[str, object]] = []
    text: str | None = None
    for encoding in ("utf-8-sig", "utf-8", "cp950", "big5", "utf-16"):
        try:
            text = payload.decode(encoding)
            attempted.append({"encoding": encoding, "decoded": True})
            break
        except UnicodeDecodeError as exc:
            attempted.append({"encoding": encoding, "decoded": False, "error": str(exc)})

    if text is None:
        return {
            "decode_attempts": attempted,
            "text_decoded": False,
            "target_found": False,
            "format_hint": "binary or unsupported text encoding",
        }

    lines = text.splitlines()
    hits = [line for line in lines if "行人專用清潔箱" in line]
    rows = list(csv.reader(io.StringIO(text)))
    csv_hits = [row for row in rows if any("行人專用清潔箱" in cell for cell in row)]
    header = rows[0] if rows else []
    target_column = next((i for i, cell in enumerate(header) if cell == "行人專用清潔箱[個]"), None)
    annual_values: list[dict[str, object]] = []
    if target_column is not None:
        for row in rows[1:]:
            if len(row) <= target_column:
                continue
            year_match = re.fullmatch(r"(\d+)年", row[0].strip()) if row else None
            if year_match:
                roc_year = int(year_match.group(1))
                annual_values.append({
                    "roc_year": roc_year,
                    "gregorian_year": roc_year + 1911,
                    "reported_count": row[target_column].strip(),
                    "unit": "個",
                })
    return {
        "decode_attempts": attempted,
        "text_decoded": True,
        "encoding_used": attempted[-1]["encoding"],
        "text_characters": len(text),
        "line_count": len(lines),
        "csv_row_count": len(rows),
        "csv_max_columns": max((len(row) for row in rows), default=0),
        "target_found": bool(hits or csv_hits),
        "matching_text_lines": hits[:30],
        "matching_csv_rows": csv_hits[:30],
        "annual_values": annual_values,
        "format_hint": "HTML-like text" if re.search(r"<\s*(html|table|tr|td)\b", text, re.I) else "delimited/text content",
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--escalated-retry",
        action="store_true",
        help="Permit one retry only after a logged connection-level failure on the first attempt.",
    )
    args = parser.parse_args()

    ATTEMPTS.parent.mkdir(parents=True, exist_ok=True)
    existing: list[dict[str, object]] = []
    if ATTEMPTS.exists():
        existing = json.loads(ATTEMPTS.read_text(encoding="utf-8"))
        if not args.escalated_retry or len(existing) != 1:
            print("Refusing to repeat the endpoint request; attempt receipt already exists.", file=sys.stderr)
            return 2
        prior = existing[0]
        if prior.get("http_status") is not None or prior.get("connection_error") is None:
            print("Escalated retry is allowed only after a connection-level failure.", file=sys.stderr)
            return 2

    url = get_url()
    record: dict[str, object] = {
        "attempt_number": len(existing) + 1,
        "attempted_at_utc": utc_now(),
        "url_from_existing_receipt": url,
        "method": "GET",
        "user_agent": "Taipei-waste-lab bounded source audit (Python urllib)",
        "http_status": None,
        "response_headers": {},
        "response_bytes": 0,
        "response_sha256": None,
        "raw_file": None,
        "connection_error": None,
        "decode": None,
    }

    request = urllib.request.Request(url, headers={"User-Agent": record["user_agent"]})
    body = b""
    try:
        with urllib.request.urlopen(request, timeout=25) as response:
            body = response.read()
            record["http_status"] = response.status
            record["response_headers"] = {
                key: value for key, value in response.headers.items()
                if key.lower() != "set-cookie"
            }
    except urllib.error.HTTPError as exc:
        body = exc.read()
        record["http_status"] = exc.code
        record["response_headers"] = {
            key: value for key, value in exc.headers.items()
            if key.lower() != "set-cookie"
        } if exc.headers else {}
        record["connection_error"] = f"HTTPError: {exc}"
    except Exception as exc:  # Record transport and sandbox failures without retrying here.
        record["connection_error"] = f"{type(exc).__name__}: {exc}"

    record["finished_at_utc"] = utc_now()
    record["omitted_response_headers"] = ["Set-Cookie"]
    if body:
        RAW.write_bytes(body)
        record["response_bytes"] = len(body)
        record["response_sha256"] = hashlib.sha256(body).hexdigest()
        record["raw_file"] = str(RAW.relative_to(AUDIT))
        record["decode"] = parse_payload(body)

    existing.append(record)
    ATTEMPTS.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(record, ensure_ascii=False, indent=2))
    return 0 if record["http_status"] == 200 else 1


if __name__ == "__main__":
    raise SystemExit(main())

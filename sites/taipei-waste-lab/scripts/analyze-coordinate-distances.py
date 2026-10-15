#!/usr/bin/env python3
"""Calculate spherical distances for the frozen same-address candidate pairs."""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable, Mapping

PROTOCOL_PATH = Path("research/coordinate-distances-2024-2026/protocol.json")
SOURCE_DIR = Path("research/source-recovery-2026-10-15")
RADIUS_METERS = 6_371_000
STORAGE_DECIMAL_PLACES = 9
CSV_HEADERS = [
    "排名", "比較ID（本站比對列號；非官方箱號）", "行政區", "地址", "距離公尺（儲存至小數9位）", "品質說明",
    "距離方法", "球面半徑公尺", "分析協定版本", "比較資料SHA256",
    "2024原始經度", "2024原始緯度", "2024來源ID（本站來源列號；非官方箱號）", "2024來源實體起始行號",
    "2024來源檔名", "2024來源SHA256", "2024來源日期",
    "2026原始經度", "2026原始緯度", "2026來源ID（本站來源列號；非官方箱號）", "2026來源實體起始行號",
    "2026來源檔名", "2026來源SHA256", "2026來源日期", "限制說明",
]
CSV_LIMIT = "同地址不證明同一實體；座標距離不證明遷移；來源精度未核實。"


class AnalysisError(ValueError):
    """Raised when a frozen input or provenance check fails."""


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_json(path: Path) -> Any:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise AnalysisError(f"cannot read JSON {path}: {exc}") from exc


def valid_position(record: Mapping[str, Any]) -> tuple[float, float] | None:
    """Return (longitude, latitude) only for finite, globally valid numbers."""
    longitude, latitude = record.get("x"), record.get("y")
    if isinstance(longitude, bool) or isinstance(latitude, bool):
        return None
    if not isinstance(longitude, (int, float)) or not isinstance(latitude, (int, float)):
        return None
    try:
        longitude, latitude = float(longitude), float(latitude)
    except (OverflowError, ValueError):
        return None
    if not math.isfinite(longitude) or not math.isfinite(latitude):
        return None
    if not (-180 <= longitude <= 180 and -90 <= latitude <= 90):
        return None
    return longitude, latitude


def haversine(
    lon1: Any, lat1: Any, lon2: Any, lat2: Any, radius: float = RADIUS_METERS
) -> float | None:
    """Return spherical shortest-surface distance, or None for invalid coordinates."""
    first = valid_position({"x": lon1, "y": lat1})
    second = valid_position({"x": lon2, "y": lat2})
    if first is None or second is None:
        return None
    if not math.isfinite(radius) or radius <= 0:
        raise ValueError("radius must be finite and positive")
    lon1, lat1 = map(math.radians, first)
    lon2, lat2 = map(math.radians, second)
    delta_lat, delta_lon = lat2 - lat1, lon2 - lon1
    a = math.sin(delta_lat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(delta_lon / 2) ** 2
    a = min(1.0, max(0.0, a))
    return 2 * radius * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def median(values: Iterable[float]) -> float | None:
    ordered = sorted(values)
    if not ordered:
        return None
    middle = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[middle]
    return (ordered[middle - 1] + ordered[middle]) / 2


def bucket_key(distance: float, buckets: list[Mapping[str, Any]]) -> str:
    for bucket in buckets:
        lower, upper = bucket["lower"], bucket["upper"]
        if distance >= lower and (upper is None or distance < upper):
            return str(bucket["key"])
    raise AnalysisError(f"distance does not fit a frozen bucket: {distance}")


def summary(pairs: list[Mapping[str, Any]], buckets: list[Mapping[str, Any]]) -> dict[str, Any]:
    distances = [p["distanceMeters"] for p in pairs if p["distanceMeters"] is not None]
    counts = {str(bucket["key"]): 0 for bucket in buckets}
    for distance in distances:
        counts[bucket_key(distance, buckets)] += 1
    return {
        "pairCount": len(pairs),
        "calculatedPairs": len(distances),
        "unavailablePairs": len(pairs) - len(distances),
        "coarseFlaggedPairs": sum(
            p["before"].get("plottable") is not True or p["after"].get("plottable") is not True
            for p in pairs
        ),
        "minMeters": min(distances) if distances else None,
        "medianMeters": median(distances),
        "maxMeters": max(distances) if distances else None,
        "buckets": [
            {"key": str(bucket["key"]), "label": str(bucket["label"]), "count": counts[str(bucket["key"])]}
            for bucket in buckets
        ],
    }


def check_relative_file(name: Any, label: str) -> Path:
    if not isinstance(name, str) or not name or Path(name).name != name:
        raise AnalysisError(f"{label} must be a source filename")
    return SOURCE_DIR / name


def load_and_validate(root: Path) -> tuple[dict[str, Any], dict[str, Any], list[dict[str, Any]], list[str], str]:
    protocol = read_json(root / PROTOCOL_PATH)
    if protocol.get("frozenBeforeCalculation") is not True:
        raise AnalysisError("coordinate protocol was not frozen before calculation")
    if protocol.get("expectedPairs") != 75 or protocol.get("selectedCategory") != "same_address_changed":
        raise AnalysisError("frozen protocol must select exactly 75 same_address_changed pairs")
    comparison_name = protocol.get("comparisonFile")
    if not isinstance(comparison_name, str) or Path(comparison_name).is_absolute() or ".." in Path(comparison_name).parts:
        raise AnalysisError("comparisonFile must be a relative path inside the root")
    comparison_path = root / comparison_name
    try:
        comparison_bytes = comparison_path.read_bytes()
    except OSError as exc:
        raise AnalysisError(f"cannot read comparison file: {exc}") from exc
    comparison_sha = sha256(comparison_bytes)
    if comparison_sha != protocol.get("comparisonSHA256"):
        raise AnalysisError("comparison SHA-256 does not match the frozen protocol")
    try:
        comparison = json.loads(comparison_bytes.decode("utf-8"))
    except (UnicodeError, json.JSONDecodeError) as exc:
        raise AnalysisError(f"cannot parse comparison JSON: {exc}") from exc
    metadata = comparison.get("meta", {})
    if metadata.get("protocolVersion") != protocol.get("comparisonProtocolVersion"):
        raise AnalysisError("comparison protocol version does not match the frozen protocol")
    for side in ("before", "after"):
        source = metadata.get(side)
        if not isinstance(source, dict):
            raise AnalysisError(f"comparison metadata is missing {side} source details")
        source_path = root / check_relative_file(source.get("file"), f"{side} file")
        try:
            source_sha = sha256(source_path.read_bytes())
        except OSError as exc:
            raise AnalysisError(f"cannot read {side} source file: {exc}") from exc
        if source_sha != source.get("sha256"):
            raise AnalysisError(f"{side} source SHA-256 does not match comparison metadata")
    district_rows = comparison.get("districts")
    if not isinstance(district_rows, list):
        raise AnalysisError("comparison districts must be an ordered list")
    district_order = [row.get("district") for row in district_rows if isinstance(row, dict)]
    if len(district_order) != len(district_rows) or len(district_order) != 12 or len(set(district_order)) != 12:
        raise AnalysisError("comparison must contain 12 unique districts in source order")
    entries = comparison.get("entries")
    if not isinstance(entries, list):
        raise AnalysisError("comparison entries must be a list")
    selected = [entry for entry in entries if entry.get("category") == protocol["selectedCategory"]]
    expected = protocol["expectedPairs"]
    if len(selected) != expected:
        raise AnalysisError(f"expected {expected} selected pairs, found {len(selected)}")
    ids = [entry.get("id") for entry in selected]
    if any(not isinstance(item, str) or not item for item in ids) or len(set(ids)) != expected:
        raise AnalysisError("selected comparison IDs must be present and unique")
    allowed_districts = set(district_order)
    for entry in selected:
        if not isinstance(entry.get("district"), str) or entry["district"] not in allowed_districts:
            raise AnalysisError(f"selected pair has an unknown district: {entry.get('id')}")
        if not isinstance(entry.get("address"), str):
            raise AnalysisError(f"selected pair has no address: {entry.get('id')}")
        for side in ("before", "after"):
            rows = entry.get(side)
            if not isinstance(rows, list) or len(rows) != 1 or not isinstance(rows[0], dict):
                raise AnalysisError(f"{entry.get('id')} must have exactly one {side} source row")
            record = rows[0]
            required = ("id", "sourceRow", "rawX", "rawY", "x", "y")
            if any(key not in record for key in required):
                raise AnalysisError(f"{entry.get('id')} {side} row is missing coordinate provenance")
    return protocol, comparison, selected, district_order, comparison_sha


def csv_safe(value: Any) -> Any:
    if isinstance(value, str) and value.lstrip()[:1] in ("=", "+", "-", "@"):
        return "'" + value
    return value


def display_distance(value: float | None) -> str:
    if value is None:
        return "—"
    if value < 0.1:
        return "<0.1 公尺"
    return f"{value:.1f} 公尺"


def markdown_cell(value: Any) -> str:
    return str(value).replace("|", "\\|").replace("\r", " ").replace("\n", " ")


def build_readme(
    protocol: dict[str, Any], comparison: dict[str, Any], output: dict[str, Any], radius: float
) -> str:
    meta, summary_data = output["meta"], output["summary"]
    sources = meta["sources"]
    lines = [
        "# 2024–2026 同地址座標距離分析",
        "",
        "本分析量化既有比較資料中的 75 組 `same_address_changed` 同地址候選列。它只計算兩筆原始座標之間的球面距離，不推論垃圾桶或設施已遷移。",
        "",
        "## 凍結來源與方法",
        "",
        f"- 分析協定：[{protocol['version']}](protocol.json)；比較協定版本：{meta['comparisonProtocolVersion']}。",
        f"- 比較檔 SHA-256：`{meta['comparisonSHA256']}`。分析使用的候選列、分類與配對沒有變更。",
        f"- 2024 來源：`{sources['before']['file']}`，{sources['before']['date']}，SHA-256 `{sources['before']['sha256']}`。",
        f"- 2026 來源：`{sources['after']['file']}`，{sources['after']['date']}，SHA-256 `{sources['after']['sha256']}`。",
        f"- 方法：球面 Haversine，半徑 {radius:,.0f} 公尺；座標以十進位經緯度解讀，使用最短球面路徑，不校正路線、高程或橢球體。",
        f"- 參考：[Haversine formula](https://www.movable-type.co.uk/scripts/latlong.html)。",
        "- 儲存修正：1.0.1 在計算後訂定小數 9 位公尺輸出，消除已觀察到的跨平台浮點末位差異；原始 [1.0.0 協定](protocol-v1.0.0.json) 保留。先以未四捨五入值排名、分組與計算統計，再統一輸出精度；儲存位數不代表測量精度。",
        "- 原始 `x` 為經度、`y` 為緯度；保留兩側完整原始列、原始座標、來源列 ID 與實體起始行號。",
        "",
        "## 整體結果",
        "",
        f"- 配對：{summary_data['pairCount']}；可計算：{summary_data['calculatedPairs']}；座標不可用：{summary_data['unavailablePairs']}。",
        f"- 至少一側未通過既有台北座標粗篩：{summary_data['coarseFlaggedPairs']} 組。全球座標有效時仍計算距離並標示需檢查。",
        f"- 最小／中位數／最大：{display_distance(summary_data['minMeters'])} / {display_distance(summary_data['medianMeters'])} / {display_distance(summary_data['maxMeters'])}。",
        "- 分組只使用未四捨五入的公尺值；下方顯示精度不代表來源座標精度。",
        "",
        "## 距離分布",
        "",
        "| 距離 | 配對數 |",
        "| --- | ---: |",
    ]
    for bucket in summary_data["buckets"]:
        lines.append(f"| {bucket['label']} | {bucket['count']} |")
    lines.extend([
        "",
        "## 行政區統計",
        "",
        "| 行政區 | 配對 | 可計算 | 不可用 | 粗篩需檢查 | 最小 | 中位數 | 最大 |",
        "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    ])
    for item in output["districts"]:
        lines.append(
            f"| {item['district']} | {item['pairCount']} | {item['calculatedPairs']} | {item['unavailablePairs']} | "
            f"{item['coarseFlaggedPairs']} | {display_distance(item['minMeters'])} | "
            f"{display_distance(item['medianMeters'])} | {display_distance(item['maxMeters'])} |"
        )
    lines.extend([
        "",
        "## 距離最大的 10 組",
        "",
        "排名只表示本批已計算距離的大小；同值依比較 ID 排序。座標字串照來源保留。",
        "",
        "| 排名 | 行政區／地址 | 距離 | 2024 座標（經度, 緯度）／本站來源列號（非官方箱號） | 2026 座標（經度, 緯度）／本站來源列號（非官方箱號） |",
        "| ---: | --- | ---: | --- | --- |",
    ])
    for pair in [p for p in output["pairs"] if p["distanceMeters"] is not None][:10]:
        before, after = pair["before"], pair["after"]
        address = markdown_cell(f"{pair['district']}／{pair['address']}")
        before_text = f"({before['rawX']}, {before['rawY']})／{before['id']}，實體起始行 {before['sourceRow']}"
        after_text = f"({after['rawX']}, {after['rawY']})／{after['id']}，實體起始行 {after['sourceRow']}"
        lines.append(
            f"| {pair['rank']} | {address} | {display_distance(pair['distanceMeters'])} | "
            f"{markdown_cell(before_text)} | {markdown_cell(after_text)} |"
        )
    lines.extend([
        "",
        "## 限制",
        "",
        "- 同一地址不證明兩筆資料是同一個實體垃圾桶；地址配對仍是待查候選。",
        "- 座標差異可能來自精度、修正、定位或輸入差異；距離不能證明遷移、移除或新增。",
        "- 球面距離是近似值，不是步行距離或測量結果；未做基準轉換或現地核對。座標來源精度未獲確認。",
        "- 2024 日期是臺北時間 2024-10-19 的封存擷取（UTC 2024-10-18），不是原始調查或更新日期。2026 來源更新日期為 2026-09-30，下載日期為 2026-10-15。",
        "- 兩份快照都沒有經核實的全市實體完整度。此表保留比較資料的 75 組既有成員，不將它解讀成全市搬遷統計。",
        "",
        "## 輸出",
        "",
        "- [完整 JSON 與原始列](../../dist/data/comparison-coordinate-distances.json)",
        "- [CSV 表格](../../dist/data/comparison-coordinate-distances.csv)",
        "",
    ])
    return "\n".join(lines)


def csv_rows(output: dict[str, Any], protocol: dict[str, Any], radius: float) -> list[list[Any]]:
    rows: list[list[Any]] = []
    for pair in output["pairs"]:
        before, after = pair["before"], pair["after"]
        sources = output["meta"]["sources"]
        row = [
            pair["rank"], pair["comparisonId"], pair["district"], pair["address"],
            pair["distanceMeters"], pair["qualityNote"], protocol["method"]["name"], radius,
            protocol["version"], output["meta"]["comparisonSHA256"],
            before["rawX"], before["rawY"], before["id"], before["sourceRow"],
            sources["before"]["file"], sources["before"]["sha256"], sources["before"]["date"],
            after["rawX"], after["rawY"], after["id"], after["sourceRow"],
            sources["after"]["file"], sources["after"]["sha256"], sources["after"]["date"],
            CSV_LIMIT,
        ]
        rows.append([csv_safe(value) for value in row])
    return rows


def analyze(root: Path) -> tuple[dict[str, Any], str, str, str]:
    protocol, comparison, selected, district_order, comparison_sha = load_and_validate(root)
    buckets = protocol.get("buckets")
    if not isinstance(buckets, list) or not buckets:
        raise AnalysisError("frozen protocol must contain distance buckets")
    method = protocol.get("method")
    if not isinstance(method, dict) or method.get("name") != "Haversine":
        raise AnalysisError("frozen method must be Haversine")
    radius = method.get("radiusMeters")
    if isinstance(radius, bool) or not isinstance(radius, (int, float)) or not math.isfinite(radius) or radius <= 0:
        raise AnalysisError("frozen Haversine radius must be finite and positive")
    pairs: list[dict[str, Any]] = []
    for entry in selected:
        before, after = entry["before"][0], entry["after"][0]
        first, second = valid_position(before), valid_position(after)
        distance = None if first is None or second is None else haversine(*first, *second, float(radius))
        coarse_ok = before.get("plottable") is True and after.get("plottable") is True
        if distance is None:
            quality = "unavailable"
            note = "至少一側座標不是有限且有效的全球經緯度；距離不可用，沒有以零代替。"
        elif not coarse_ok:
            quality = "needs_check"
            note = "座標全球範圍有效，仍計算距離；至少一側未通過既有台北粗篩，需檢查。"
        else:
            quality = "both_pass_coarse"
            note = "兩側均通過既有台北粗篩；這不代表座標精度或實體位置已核實。"
        pairs.append({
            "comparisonId": entry["id"], "district": entry["district"], "address": entry["address"],
            "before": before, "after": after, "distanceMeters": distance, "rank": None,
            "quality": quality, "qualityNote": note,
        })
    calculated = sorted(
        (pair for pair in pairs if pair["distanceMeters"] is not None),
        key=lambda pair: (-pair["distanceMeters"], pair["comparisonId"]),
    )
    for rank, pair in enumerate(calculated, start=1):
        pair["rank"] = rank
    unavailable = sorted(
        (pair for pair in pairs if pair["distanceMeters"] is None), key=lambda pair: pair["comparisonId"]
    )
    pairs = calculated + unavailable
    overall = summary(pairs, buckets)
    by_district = []
    for district in district_order:
        subset = [pair for pair in pairs if pair["district"] == district]
        by_district.append({"district": district, **summary(subset, buckets)})
    # Keep the frozen raw-value ranking, buckets and statistics. Normalize only
    # derived output numbers; do not round source coordinates or source rows.
    for pair in pairs:
        if pair["distanceMeters"] is not None:
            pair["distanceMeters"] = round(pair["distanceMeters"], STORAGE_DECIMAL_PLACES)
    for stats in [overall, *by_district]:
        for key in ("minMeters", "medianMeters", "maxMeters"):
            if stats[key] is not None:
                stats[key] = round(stats[key], STORAGE_DECIMAL_PLACES)
    comparison_meta = comparison["meta"]
    output = {
        "meta": {
            "analysisVersion": protocol["version"], "comparisonFile": protocol["comparisonFile"],
            "comparisonSHA256": comparison_sha,
            "comparisonProtocolVersion": protocol["comparisonProtocolVersion"],
            "sources": {"before": comparison_meta["before"], "after": comparison_meta["after"]},
            "method": method, "selection": protocol["selectedCategory"], "unit": protocol["unit"],
            "limitations": protocol["limits"],
            "storageDecimalPlaces": STORAGE_DECIMAL_PLACES,
        },
        "summary": overall, "districts": by_district, "pairs": pairs,
    }
    json_text = json.dumps(output, ensure_ascii=False, indent=2, allow_nan=False) + "\n"
    from io import StringIO
    buffer = StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n", quoting=csv.QUOTE_MINIMAL)
    writer.writerow(CSV_HEADERS)
    writer.writerows(csv_rows(output, protocol, float(radius)))
    csv_text = "\ufeff" + buffer.getvalue()
    readme_text = build_readme(protocol, comparison, output, float(radius))
    return output, json_text, csv_text, readme_text


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=Path(__file__).resolve().parent.parent)
    args = parser.parse_args(argv)
    root = args.root.resolve()
    try:
        output, json_text, csv_text, readme_text = analyze(root)
        research = root.parent.parent / 'topics/bins/research'
        if not research.is_dir():
            research = root / 'research'
        outputs = {
            root / "dist/data/comparison-coordinate-distances.json": json_text,
            root / "dist/data/comparison-coordinate-distances.csv": csv_text,
            research / "coordinate-distances-2024-2026/README.md": readme_text,
        }
        for path, content in outputs.items():
            path.parent.mkdir(parents=True, exist_ok=True)
            encoding = "utf-8-sig" if path.suffix == ".csv" else "utf-8"
            with path.open("w", encoding=encoding, newline="") as stream:
                stream.write(content.removeprefix("\ufeff") if encoding == "utf-8-sig" else content)
        print(
            f"Wrote 75 pairs: {output['summary']['calculatedPairs']} calculated, "
            f"{output['summary']['unavailablePairs']} unavailable, "
            f"{output['summary']['coarseFlaggedPairs']} coarse-flagged."
        )
        return 0
    except (AnalysisError, OSError, TypeError, KeyError, ValueError) as exc:
        print(f"coordinate analysis failed: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())

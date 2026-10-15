#!/usr/bin/env python3
"""Refresh topic-owned canonical data from official tree/bin source downloads.

Requires Python 3.11+ and pyproj. Run from the repository root:
  python -m pip install pyproj
  python scripts/prepare-data.py --refresh
  python scripts/prepare-data.py --offline --cache-dir <existing-raw-cache>

To rebuild the saved reviewed inputs without downloads or pyproj, use:
  python scripts/build-topic-data.py

The canonical files preserve transformed observations. They do not replace the
original raw download cache required by this script's --offline option.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import io
import json
import math
import re
import urllib.parse
import urllib.request
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BBOX = [121.51, 25.02, 121.57, 25.08]
BASE = "https://data.taipei"
TREE_URL = "https://tppkl.blob.core.windows.net/blobfs/TaipeiTree.json"
DATASETS = {
    "bins": "a835f3ba-7f50-4b0d-91a6-9df128632d1c",
    "sidewalks": "715d3a83-8445-4496-b6bf-b0900538b7e7",
    "complaints": "cb423c17-88eb-4231-a725-f1b93247d1bf",
    "metro": "63f31c7e-7fc3-418b-bd82-b95158755b4d",
    "vd": "47cb9090-e1c9-4b1d-b299-b11c375c5ee2",
    "bus": "90dd063e-2aca-49aa-a7fb-73130610313c",
    "buildings": "7889e8a0-a71e-44e0-95c7-2213a7db1474",
    "population": "a6394e3f-3514-4542-87bd-de4310a40db3",
    "soil": "ec40e067-930f-4058-b7dc-71399d5f3147",
    "fire": "7a800e92-eb22-461f-b29d-8def2127a1bc",
}
GRAINS = {
    "bins": "一列一個行人專用清潔箱位置；來源無唯一設施編號",
    "sidewalks": "人行道範圍幾何及其寬度、淨寬屬性",
    "complaints": "逐案分類、受理與結案日期；無地址或經緯度",
    "metro": "此下載資源為每月資料連結清單；另連結每日分時各站 OD 統計",
    "vd": "逐偵測器靜態位置、道路及車道屬性",
    "bus": "全市公車客運業務按統計期彙總；非逐站刷卡資料",
    "buildings": "全市建築物按統計期、樓層及兩種屋齡類別彙總",
    "population": "年月 × 里 × 性別 × 單歲年齡人口統計",
    "soil": "土壤液化潛勢區域幾何與類別",
    "fire": "列管消防通道與搶救困難地區清冊",
}
LIMITATIONS = {
    "bins": "只有位置，沒有容量、滿溢、清運頻率或行人需求；位置距離不等於可達步行距離。",
    "sidewalks": "僅查核資料目錄與欄位，尚未整合幾何；不得據此宣稱候選點可施工或已符合淨寬。",
    "complaints": "欄位沒有地址或座標，無法直接製作通報熱點；通報量也不等於實際事件發生率。",
    "metro": "尚未下載 OD 觀測檔；捷運進出量亦不能直接代表街道人流或公車站需求。",
    "vd": "本版只查核靜態資料目錄，未累積尖峰歷史流量；錯峰曲線是模擬，沒有因果效果估計。",
    "bus": "不能由全市年度／統計期總量推回各站需求；缺逐站上下車 OD 與駕駛實際勤務。",
    "buildings": "沒有逐棟地址、屋齡、結構或耐震檢測；屋齡僅未滿 30 年／30 年以上，不能推論逐棟安全。",
    "population": "只查核資料目錄，尚未整合統計或里界；人口不能直接當建築物住戶。",
    "soil": "只查核資料目錄，未疊合幾何；液化潛勢不等於建築物損壞機率或鑑定結果。",
    "fire": "只查核資料目錄，未下載或地理定位清冊；列管地區不等於逐棟搶救風險。",
}


def timestamp(epoch: float | None = None) -> str:
    value = datetime.fromtimestamp(epoch, timezone.utc) if epoch else datetime.now(timezone.utc)
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def download(url: str, cache_file: Path, mode: str) -> tuple[bytes, str]:
    if mode == "refresh" or not cache_file.exists():
        if mode == "offline":
            raise FileNotFoundError(f"Offline cache missing: {cache_file}")
        request = urllib.request.Request(url, headers={"User-Agent": "TaipeiCityLab/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            payload = response.read()
        cache_file.parent.mkdir(parents=True, exist_ok=True)
        cache_file.write_bytes(payload)
    return cache_file.read_bytes(), timestamp(cache_file.stat().st_mtime)


def read_metadata(payload: bytes) -> dict:
    page = payload.decode("utf-8")
    match = re.search(r'<script[^>]*id="__NUXT_DATA__"[^>]*>(.*?)</script>', page, re.S)
    if not match:
        raise ValueError("No public SSR dataset metadata found")
    values = json.loads(match.group(1))

    def resolve(index):
        value = values[index]
        if isinstance(value, dict):
            return {key: resolve(ref) for key, ref in value.items()}
        if isinstance(value, list):
            return [resolve(ref) for ref in value]
        return value

    index = next(i for i, value in enumerate(values)
                 if isinstance(value, dict) and "field_description" in value and "resources" in value)
    return resolve(index)


def number(value) -> float | None:
    try:
        result = float(value)
        return result if math.isfinite(result) else None
    except (ValueError, TypeError):
        return None


def nullable(value):
    return value if value not in (None, "") else None


def inside(x: float, y: float) -> bool:
    return BBOX[0] <= x <= BBOX[2] and BBOX[1] <= y <= BBOX[3]


def valid_position(x, y) -> bool:
    return x is not None and y is not None and 119 < x < 123 and 21 < y < 27


def build_trees(payload: bytes) -> tuple[list[dict], dict]:
    # Projection is needed only when importing raw observations. Metadata/help,
    # a missing-cache failure, and the separate canonical builder need no pyproj.
    import pyproj

    rows = json.loads(payload.decode("utf-8-sig"))
    transformer = pyproj.Transformer.from_crs(3826, 4326, always_xy=True)
    output, invalid = [], []
    for index, row in enumerate(rows):
        tx, ty = number(row.get("TWD97X")), number(row.get("TWD97Y"))
        x, y = transformer.transform(tx, ty) if tx is not None and ty is not None else (None, None)
        if not valid_position(x, y):
            invalid.append(index + 1)
            continue
        if not inside(x, y):
            continue
        output.append({
            "id": row["TreeID"], "x": round(x, 7), "y": round(y, 7),
            "height": number(row.get("TreeHeight")), "diameter": number(row.get("Diameter")),
            "species": nullable(row.get("TreeType")), "district": nullable(row.get("Dist")),
            "surveyDate": nullable(row.get("SurveyDate")), "updatedAt": nullable(row.get("UpdDate")),
        })
    quality = profile(rows, output, invalid)
    quality["coordinateTransform"] = "EPSG:3826 (TWD97 / TM2 zone 121) → EPSG:4326; always_xy=True"
    quality["pyprojVersion"] = pyproj.__version__
    quality["outlierCounts"] = tree_outliers(output)
    return output, quality


def tree_outliers(rows: list[dict]) -> dict:
    return {
        "heightAbove50": sum(row["height"] is not None and row["height"] > 50 for row in rows),
        "heightZero": sum(row["height"] == 0 for row in rows),
        "diameterZero": sum(row["diameter"] == 0 for row in rows),
        "surveyDate1900": sum(row["surveyDate"] == "1900-01-01" for row in rows),
    }


def build_bins(payload: bytes, encoding: str) -> tuple[list[dict], dict]:
    rows = list(csv.DictReader(io.StringIO(payload.decode(encoding))))
    output, invalid = [], []
    for index, row in enumerate(rows):
        x, y = number(row.get("經度")), number(row.get("緯度"))
        if not valid_position(x, y):
            invalid.append(index + 2)  # CSV line number includes header
            continue
        if inside(x, y):
            output.append({"id": f"BIN{index + 1:04d}", "x": x, "y": y,
                           "address": nullable(row.get("地址")), "district": nullable(row.get("行政區"))})
    quality = profile(rows, output, invalid)
    quality["encoding"] = encoding
    quality["identifierType"] = "衍生快照列編號；來源沒有官方唯一設施 ID"
    return output, quality


def profile(raw: list[dict], filtered: list[dict], invalid: list[int]) -> dict:
    fields = list(filtered[0]) if filtered else []
    dates = sorted(row["surveyDate"] for row in filtered if row.get("surveyDate"))
    return {
        "sourceCount": len(raw), "filteredCount": len(filtered),
        "invalidCoordinateCount": len(invalid), "invalidCoordinateSourceRows": invalid,
        "excludedOutsideScopeCount": len(raw) - len(filtered) - len(invalid),
        "nullCounts": {key: sum(row.get(key) is None for row in filtered) for key in fields},
        "duplicateIdCount": len(filtered) - len({row["id"] for row in filtered}),
        "duplicateCoordinateCount": len(filtered) - len({(row["x"], row["y"]) for row in filtered}),
        "districtCounts": dict(sorted(Counter(row["district"] for row in filtered).items())),
        "surveyDateRange": [dates[0], dates[-1]] if dates else None,
        "sampled": False, "sha256": None,
    }


def official_source(key: str, metadata: dict, retrieved: str) -> dict:
    resource = metadata["resources"][0]
    fields = [item["name"] for item in resource.get("field_desc", [])]
    return {
        "title": metadata["title"], "url": f"{BASE}/dataset/detail?id={DATASETS[key]}",
        "classification": "官方觀測" if key == "bins" else "官方資料目錄",
        "grain": GRAINS[key], "limitations": LIMITATIONS[key], "fields": fields,
        "retrievedAt": retrieved, "integrationStatus": "loaded" if key == "bins" else "metadata-only",
        "license": metadata.get("license_name"), "publisher": metadata.get("org_name"),
        "catalogUpdatedAt": metadata.get("changed"), "publishedAt": metadata.get("publish_date"),
        "resourceUpdatedAt": resource.get("last_modified"),
        "catalogRecordCount": metadata.get("number_of_data"),
        "resourceUrl": urllib.parse.urljoin(BASE, resource["url"]),
    }


def supplemental_sources(retrieved: str) -> dict:
    return {
        "trees": {
            "title": "臺北市行道樹及公園樹木分布圖", "url": "https://data.gov.tw/dataset/128274",
            "resourceUrl": TREE_URL, "classification": "官方觀測", "integrationStatus": "loaded",
            "grain": "一列一棵樹；逐樹調查日期與系統更新時間分開保存",
            "limitations": "沒有樹冠輪廓、遮蔭量、移除履歷或可施工樹穴。樹高有極端值，調查日有缺漏與 1900 年值；更新時間不代表重新量測。",
            "fields": ["TreeID", "Dist", "Region", "RegionRemark", "TreeType", "Diameter", "TreeHeight", "SurveyDate", "TWD97X", "TWD97Y", "UpdDate"],
            "retrievedAt": retrieved, "license": "政府資料開放授權條款-第1版",
            "timestampPolicy": "surveyDate 與 updatedAt 保留來源原字串；來源時間未標示時區",
        },
        "rat": {
            "title": "見鼠地圖 Rat Radar（題目列出的民間來源）", "url": "https://ratdar.taipei/reports",
            "classification": "民間通報", "integrationStatus": "not-loaded", "grain": "民眾自行通報；本版未下載",
            "limitations": "未驗證來源、授權、座標及去重；不得將模擬鼠患點說成民間或官方實際通報。",
            "fields": [], "retrievedAt": None, "referencedFrom": "puma",
        },
        "puma": {
            "title": "市政 debug松官方題目與規則", "url": "https://puma.taipei/hackathon",
            "classification": "活動題目", "integrationStatus": "metadata-only", "grain": "7 項議題、資料入口與模擬資料規則",
            "limitations": "題目敘述不是觀測資料；活動列出的資料入口仍需逐項確認欄位、粒度與授權。",
            "fields": ["議題", "資料入口", "資料缺口", "作品規則"], "retrievedAt": retrieved,
        },
    }


def write_json(path: Path, value: dict, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(value, ensure_ascii=False, allow_nan=False,
                      indent=2 if pretty else None, separators=None if pretty else (",", ":"))
    temporary = path.with_suffix(".json.tmp")
    temporary.write_text(text + "\n", encoding="utf-8")
    temporary.replace(path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache-dir", type=Path, default=Path("/tmp/taipei-city-lab-source-cache"))
    parser.add_argument("--output-dir", type=Path, default=ROOT / "dist/data")
    parser.add_argument("--canonical-root", type=Path, default=ROOT,
                        help="Repository root owning topics/ and shared/ canonical data")
    modes = parser.add_mutually_exclusive_group()
    modes.add_argument("--refresh", action="store_true")
    modes.add_argument("--offline", action="store_true")
    options = parser.parse_args()
    mode = "offline" if options.offline else "refresh" if options.refresh else "cache"
    tree_bytes, tree_retrieved = download(TREE_URL, options.cache_dir / "trees.json", mode)
    trees, tree_quality = build_trees(tree_bytes)
    sources = supplemental_sources(tree_retrieved)
    catalogs = {}
    for key, dataset_id in DATASETS.items():
        url = f"{BASE}/dataset/detail?id={dataset_id}"
        payload, retrieved = download(url, options.cache_dir / f"{key}.html", mode)
        catalogs[key] = read_metadata(payload)
        sources[key] = official_source(key, catalogs[key], retrieved)
    bin_bytes, bin_retrieved = download(sources["bins"]["resourceUrl"], options.cache_dir / "bins.csv", mode)
    encoding = catalogs["bins"]["resources"][0].get("encoding") or "big5"
    bins, bin_quality = build_bins(bin_bytes, encoding)
    tree_quality["sha256"] = hashlib.sha256(tree_bytes).hexdigest()
    bin_quality["sha256"] = hashlib.sha256(bin_bytes).hexdigest()
    bin_quality["catalogCountMismatch"] = sources["bins"]["catalogRecordCount"] != bin_quality["sourceCount"]
    sources["trees"]["counts"] = tree_quality
    sources["bins"]["counts"] = bin_quality
    sources["bins"]["retrievedAt"] = bin_retrieved
    puma_bytes, puma_retrieved = download(sources["puma"]["url"], options.cache_dir / "puma.html", mode)
    sources["puma"]["retrievedAt"] = puma_retrieved
    sources["puma"]["sha256"] = hashlib.sha256(puma_bytes).hexdigest()
    latest_retrieval = max(source["retrievedAt"] for source in sources.values() if source["retrievedAt"])
    snapshot = {"meta": {"retrievedAt": latest_retrieval, "builtAt": timestamp(), "buildStatus": "complete", "bbox": BBOX,
                         "scope": "臺北市中心示範範圍；保留框內所有有效樹木與清潔箱，並非全市分析",
                         "coordinateSystem": "EPSG:4326; x=longitude, y=latitude", "sampled": False},
                "trees": trees, "bins": bins, "sources": sources,
                "quality": {"trees": tree_quality, "bins": bin_quality}}
    # Do not touch canonical/deployment data until every download and transform
    # has succeeded. The topic builder validates row accounting and ownership
    # before persisting any refreshed, transformed observations.
    spec = importlib.util.spec_from_file_location("topic_data", ROOT / "scripts/build-topic-data.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    builder.write_canonical(snapshot, options.canonical_root)
    builder.build_deployment_data(options.canonical_root, options.output_dir)
    print(json.dumps({"trees": len(trees), "bins": len(bins), "bbox": BBOX,
                      "output": str(options.output_dir)}, ensure_ascii=False))


if __name__ == "__main__":
    main()

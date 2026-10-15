#!/usr/bin/env python3
"""Rebuild deployment data from the checked, topic-owned canonical snapshots.

This needs only Python's standard library, never downloads anything, and keeps
the original observation/source timestamps. It reproduces the reviewed,
transformed snapshot; the original raw source download cache is not included.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TOPIC_IDS = ("shade", "bins", "rat", "traffic", "bus", "buildings", "audit")
OWNED_SOURCES = {
    "shade": ("trees", "sidewalks"),
    "bins": ("bins",),
    "rat": ("complaints", "rat"),
    "traffic": ("vd",),
    "bus": ("bus",),
    "buildings": ("buildings", "population", "soil", "fire"),
}
TOPIC_SOURCES = {
    "shade": ("trees", "sidewalks", "puma"),
    "bins": ("bins", "metro", "puma"),
    "rat": ("complaints", "rat", "puma"),
    "traffic": ("vd", "metro", "puma"),
    "bus": ("bus", "metro", "puma"),
    "buildings": ("buildings", "soil", "fire", "population", "puma"),
}
SHARED_SOURCES = ("metro", "puma")
OBSERVATIONS = {"shade": "trees", "bins": "bins"}
SOURCE_IDS = ("trees", "rat", "puma", "bins", "sidewalks", "complaints", "metro",
              "vd", "bus", "buildings", "population", "soil", "fire")


def read_json(path: Path):
    def invalid_constant(value):
        raise ValueError(f"Non-finite JSON value {value} in {path}")
    return json.loads(path.read_text(encoding="utf-8"), parse_constant=invalid_constant)


def json_bytes(value, pretty: bool = False) -> bytes:
    return (json.dumps(value, ensure_ascii=False, allow_nan=False,
                       indent=2 if pretty else None,
                       separators=None if pretty else (",", ":")) + ("\n" if pretty else "")).encode("utf-8")


def write_json(path: Path, value, pretty: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_bytes(json_bytes(value, pretty))
    temporary.replace(path)


def validate_snapshot(snapshot: dict) -> None:
    """Reject incomplete migration/refresh output rather than filling gaps."""
    if set(snapshot) != {"meta", "trees", "bins", "sources", "quality"}:
        raise ValueError("Snapshot must preserve meta, trees, bins, sources and quality")
    meta, sources, quality = snapshot["meta"], snapshot["sources"], snapshot["quality"]
    if set(sources) != set(SOURCE_IDS):
        raise ValueError("Snapshot must preserve all 13 reviewed source IDs")
    if not isinstance(meta.get("bbox"), list) or len(meta["bbox"]) != 4:
        raise ValueError("Snapshot requires its original coordinate bounding box")
    if not all(isinstance(value, (int, float)) and math.isfinite(value) for value in meta["bbox"]):
        raise ValueError("Bounding box must contain finite coordinates")
    for field in ("retrievedAt", "builtAt", "buildStatus", "scope", "coordinateSystem", "sampled"):
        if field not in meta:
            raise ValueError(f"Snapshot metadata missing {field}")
    if set(quality) != {"trees", "bins"}:
        raise ValueError("Quality data must remain attached to the two observed datasets")
    loaded = {key for key, source in sources.items() if source.get("integrationStatus") == "loaded"}
    if loaded != {"trees", "bins"}:
        raise ValueError("Only the reviewed tree and bin observations are loaded")
    for key, source in sources.items():
        if source.get("integrationStatus") not in {"loaded", "metadata-only", "not-loaded"}:
            raise ValueError(f"Unknown integration status for {key}")
        if not all(source.get(field) for field in ("title", "url", "grain", "limitations")):
            raise ValueError(f"Incomplete source boundaries for {key}")
    west, south, east, north = meta["bbox"]
    for key in ("trees", "bins"):
        rows = snapshot[key]
        if not isinstance(rows, list) or quality[key].get("filteredCount") != len(rows):
            raise ValueError(f"Observed row count disagrees with quality for {key}")
        if sources[key].get("counts") != quality[key]:
            raise ValueError(f"Source and dataset quality disagree for {key}")
        counts = quality[key]
        if counts["sourceCount"] != len(rows) + counts["excludedOutsideScopeCount"] + counts["invalidCoordinateCount"]:
            raise ValueError(f"Source-row accounting does not reconcile for {key}")
        if len({row["id"] for row in rows}) != len(rows):
            raise ValueError(f"Duplicate observation IDs in {key}")
        for row in rows:
            x, y = row.get("x"), row.get("y")
            if (not isinstance(x, (int, float)) or not isinstance(y, (int, float))
                    or not math.isfinite(x) or not math.isfinite(y)
                    or not (west <= x <= east and south <= y <= north)):
                raise ValueError(f"Invalid/out-of-scope observation coordinate in {key}")


def write_canonical(snapshot: dict, root: Path = ROOT) -> None:
    """Save a validated transformed snapshot by owner; used by source refresh.

    This does not manufacture raw downloads or change existing values/dates.
    Call only once all source downloads and transformations have succeeded.
    """
    root = Path(root)
    validate_snapshot(snapshot)
    sources = snapshot["sources"]
    write_json(root / "shared/data/snapshot-meta.json", snapshot["meta"], True)
    write_json(root / "shared/data/sources.json", {key: sources[key] for key in SHARED_SOURCES}, True)
    for topic_id, source_ids in OWNED_SOURCES.items():
        directory = root / "topics" / topic_id / "data"
        write_json(directory / "sources.json", {key: sources[key] for key in source_ids}, True)
        if topic_id in OBSERVATIONS:
            key = OBSERVATIONS[topic_id]
            write_json(directory / "observations.json", {key: snapshot[key]})
            write_json(directory / "quality.json", {key: snapshot["quality"][key]}, True)
    write_json(root / "topics/audit/data/catalog.json", {
        "sourceIds": list(sources),
        "observationStatus": "user-input-only",
        "limitations": "這裡只引用各題來源目錄，不複製其他題的觀測值；使用者 CSV 僅在瀏覽器本機處理，不存入 repository。",
    }, True)


def assemble_snapshot(root: Path = ROOT) -> dict:
    """Return the original flat compatibility snapshot from canonical inputs."""
    root = Path(root)
    meta = read_json(root / "shared/data/snapshot-meta.json")
    sources = {}
    for directory, expected in [(root / "shared/data", SHARED_SOURCES)] + [
            (root / "topics" / topic / "data", ids) for topic, ids in OWNED_SOURCES.items()]:
        owned = read_json(directory / "sources.json")
        if set(owned) != set(expected):
            raise ValueError(f"Unexpected source ownership in {directory}")
        if set(sources) & set(owned):
            raise ValueError(f"Duplicated canonical source ID in {directory}")
        sources.update(owned)
    catalog = read_json(root / "topics/audit/data/catalog.json")
    ids = catalog["sourceIds"]
    if len(ids) != len(set(ids)) or set(ids) != set(sources):
        raise ValueError("Audit catalogue must reference every source ID exactly once")
    sources = {key: sources[key] for key in ids}
    observed, quality = {}, {}
    for topic, key in OBSERVATIONS.items():
        directory = root / "topics" / topic / "data"
        rows, checked = read_json(directory / "observations.json"), read_json(directory / "quality.json")
        if set(rows) != {key} or set(checked) != {key}:
            raise ValueError(f"Unexpected observation ownership in {directory}")
        observed[key], quality[key] = rows[key], checked[key]
    snapshot = {"meta": meta, "trees": observed["trees"], "bins": observed["bins"],
                "sources": sources, "quality": quality}
    validate_snapshot(snapshot)
    return snapshot


def per_topic_snapshot(topic_id: str, root: Path = ROOT) -> dict:
    """Return a standalone site's inputs, without another topic's observations.

    Metadata retains original retrieval/build times; source entries retain their
    original integration state. In audit those entries describe the catalogue,
    not observations loaded into the audit site.
    """
    if topic_id not in TOPIC_IDS:
        raise ValueError(f"Unknown topic: {topic_id}")
    snapshot = assemble_snapshot(root)
    source_ids = list(snapshot["sources"]) if topic_id == "audit" else TOPIC_SOURCES[topic_id]
    key = OBSERVATIONS.get(topic_id)
    scopes = {
        "shade": "臺北市中心示範範圍；保留框內所有有效樹木，並非全市分析；缺少實測樹冠與遮蔭。",
        "bins": "臺北市中心示範範圍；保留框內所有有效清潔箱，並非全市存量或撤除紀錄。",
        "audit": "跨題來源目錄與本機 CSV 健檢；本站未載入其他題的樹木、清潔箱或其他觀測列。",
    }
    scope = scopes.get(topic_id, "僅載入本題已查核的來源目錄，尚未整合觀測資料；互動情境不得視為真實通報、車流、需求或逐棟紀錄。")
    meta = {**snapshot["meta"], "topicId": topic_id, "scope": scope,
            "observationStatus": "loaded" if key else "catalog-only" if topic_id == "audit" else "not-loaded"}
    output = {"meta": meta, "sources": {source: snapshot["sources"][source] for source in source_ids}}
    if key:
        output[key] = snapshot[key]
        output["quality"] = {key: snapshot["quality"][key]}
    return output


def build_deployment_data(root: Path = ROOT, output_dir: Path | None = None, check: bool = False) -> dict:
    """Write/check the two legacy deployment JSONs, without updating dates."""
    root = Path(root)
    output_dir = Path(output_dir) if output_dir else root / "dist/data"
    snapshot = assemble_snapshot(root)
    outputs = {"snapshot.json": json_bytes(snapshot),
               "source-catalog.json": json_bytes({"meta": snapshot["meta"], "sources": snapshot["sources"]}, True)}
    different = []
    for name, payload in outputs.items():
        destination = output_dir / name
        if check:
            if not destination.exists() or destination.read_bytes() != payload:
                different.append(str(destination))
        else:
            destination.parent.mkdir(parents=True, exist_ok=True)
            temporary = destination.with_suffix(destination.suffix + ".tmp")
            temporary.write_bytes(payload)
            temporary.replace(destination)
    if different:
        raise ValueError("Deployment data differs from canonical inputs: " + ", ".join(different))
    return snapshot


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--root", type=Path, default=ROOT)
    parser.add_argument("--output-dir", type=Path)
    parser.add_argument("--check", action="store_true", help="Fail if deployment files differ; never write")
    options = parser.parse_args()
    try:
        snapshot = build_deployment_data(options.root, options.output_dir, options.check)
    except (ValueError, KeyError, OSError) as error:
        parser.exit(1, f"{error}\n")
    print(json.dumps({"status": "checked" if options.check else "built", "topics": list(TOPIC_IDS),
                      "trees": len(snapshot["trees"]), "bins": len(snapshot["bins"]),
                      "timestamps": "preserved from canonical metadata"}, ensure_ascii=False))


if __name__ == "__main__":
    main()

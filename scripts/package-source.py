"""Create a portable source download without Site identity or repository state."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
target = root / "sites/taipei-city-lab/dist/source.zip"
inputs = [root / name for name in ("README.md", "LICENSE", "package.json", "package-lock.json")]
for folder in ("tests", "scripts", "topics", "shared", "sites", "archive/development-tools/agents"):
    inputs.extend((root / folder).rglob("*"))
inputs.extend(root / name for name in (
    "archive/README.md", "archive/git-history/README.md",
    "archive/development-tools/README.md", "archive/development-tools/impeccable/design.json",
) if (root / name).exists())
target.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(target, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(inputs):
        if not path.is_file() or path == target:
            continue
        if "__pycache__" in path.parts or path.name.endswith(".pyc"):
            continue
        if any(part in {'.git', '.openai', 'node_modules', 'qa'} for part in path.relative_to(root).parts):
            continue
        if path.is_relative_to(root / "archive/development-tools/agents/skills/impeccable/scripts/bin"):
            continue
        if path == root / "shared/docs/citizen-finish-review.md":
            continue
        archive.write(path, "taipei-city-lab/" + str(path.relative_to(root)))
print(f"Portable source package: {target.stat().st_size:,} bytes")

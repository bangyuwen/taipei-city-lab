"""Create a portable source download without Site identity or repository state."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
target = root / "sites/taipei-city-lab/dist/source.zip"
inputs = [root / name for name in ("README.md", "AGENTS.md", "LICENSE", "package.json", "package-lock.json")]
for folder in ("tests", "scripts", "topics", "shared", "sites"):
    inputs.extend((root / folder).rglob("*"))
target.parent.mkdir(parents=True, exist_ok=True)
with ZipFile(target, "w", ZIP_DEFLATED, compresslevel=9) as source_zip:
    for path in sorted(inputs):
        if not path.is_file() or path == target:
            continue
        if "__pycache__" in path.parts or path.name.endswith(".pyc"):
            continue
        if any(part in {'.git', '.openai', 'node_modules', 'qa'} for part in path.relative_to(root).parts):
            continue
        if path.is_relative_to(root / 'shared/skills/impeccable/scripts/bin'):
            continue
        source_zip.write(path, "taipei-city-lab/" + str(path.relative_to(root)))
print(f"Portable source package: {target.stat().st_size:,} bytes")

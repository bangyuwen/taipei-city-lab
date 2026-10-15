"""Create a portable source download without Site identity or repository state."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
target = root / "dist/source.zip"
inputs = [root / name for name in ("README.md", "LICENSE", "CONTRACT.md", "package.json", "package-lock.json")]
inputs.extend(root / name for name in ("DESIGN.md", "PRODUCT.md", ".impeccable/design.json") if (root / name).exists())
for folder in ("dist", "tests", "scripts", "docs", ".agents", "topics", "shared", "sites"):
    inputs.extend((root / folder).rglob("*"))
with ZipFile(target, "w", ZIP_DEFLATED, compresslevel=9) as archive:
    for path in sorted(inputs):
        if not path.is_file() or path == target:
            continue
        if "__pycache__" in path.parts or path.name.endswith(".pyc"):
            continue
        if any(part in {'.git', '.openai', 'node_modules', 'qa'} for part in path.relative_to(root).parts):
            continue
        if path.is_relative_to(root / ".agents/skills/impeccable/scripts/bin"):
            continue
        if path == root / "docs/citizen-finish-review.md":
            continue
        if path == root / "shared/docs/citizen-finish-review.md":
            continue
        archive.write(path, "taipei-city-lab/" + str(path.relative_to(root)))
print(f"Portable source package: {target.stat().st_size:,} bytes")

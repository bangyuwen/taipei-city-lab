"""Stage only the fixed public runtime assets; preserve the full private dist tree."""
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent.parent
ASSETS = (
    'index.html', 'app.js', 'history.js', 'data-utils.js', 'styles.css', 'mark.svg',
    'comparison-ui.js', 'comparison-utils.js', 'comparison.css',
    'design-ui.js', 'design-model.js', 'bin-scene.js', 'design.css',
    'research-ui.js', 'research.css', 'fonts/city-serif.woff', 'fonts/OFL.txt',
    'vendor/three/three.module.js', 'vendor/three/three.core.js',
    'vendor/three/OrbitControls.js', 'vendor/three/LICENSE',
    'vendor/leaflet/leaflet-src.esm.js', 'vendor/leaflet/leaflet.css',
    'vendor/leaflet/LICENSE', 'vendor/leaflet/images/layers.png',
    'vendor/leaflet/images/layers-2x.png', 'vendor/leaflet/images/marker-icon.png',
    'vendor/leaflet/images/marker-icon-2x.png', 'vendor/leaflet/images/marker-shadow.png',
    'data/datasets.json', 'data/comparison-2024-2026.json',
    'data/comparison-coordinate-distances.json',
    'research/execution-2026-10-15/desk-results.json',
)


def prepare():
    source = ROOT / 'dist'
    output = ROOT / 'out'
    # Validate all inputs before touching the previous generated output.
    for name in ASSETS:
        path = source / name
        if any(part.is_symlink() for part in (path, *path.parents)):
            raise ValueError(f'Public input must not be a symlink: {name}')
        if not path.is_file():
            raise FileNotFoundError(f'Missing required public input: {name}')
    if output.parent != ROOT or output.name != 'out' or output.is_symlink():
        raise ValueError('Unsafe public output root')
    if output.exists():
        if not output.is_dir():
            raise ValueError('Public output must be a directory')
        # Refuse to traverse links, including stale files from earlier staging.
        if any(path.is_symlink() for path in output.rglob('*')):
            raise ValueError('Public output contains a symlink')
        shutil.rmtree(output)
    output.mkdir()
    for name in ASSETS:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, target)
    print(f'Staged {len(ASSETS)} public runtime assets in out/')


if __name__ == '__main__':
    prepare()

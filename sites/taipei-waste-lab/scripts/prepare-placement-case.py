"""Build the Zhongshan case separately from allowlist-only publication staging."""
from pathlib import Path
import runpy
import shutil

ROOT = Path(__file__).resolve().parent.parent


def prepare():
    canonical = ROOT.parents[1] / 'topics/bins/research/placement-case-2026-10-23'
    packaged = ROOT / 'research/placement-case-2026-10-23'
    if canonical.is_dir():
        packaged.mkdir(parents=True, exist_ok=True)
        for name in ('README.md', 'page.html', 'render.py', 'inputs.json'):
            shutil.copyfile(canonical / name, packaged / name)
    runpy.run_path(str(packaged / 'render.py'), run_name='__main__')


if __name__ == '__main__':
    prepare()

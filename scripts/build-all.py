"""Rebuild all deployable sites from topic-owned sources without downloading data."""
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
for script in ['scripts/build-topic-models.py', 'scripts/build-topic-data.py',
               'scripts/build-topic-sites.py', 'sites/taipei-waste-lab/scripts/prepare-data.py']:
    subprocess.run([sys.executable, str(ROOT / script)], cwd=ROOT, check=True)

"""Run the Node Playwright browser QA harness with the same command-line interface."""
import shutil
import subprocess
import sys
from pathlib import Path


def main():
    node = shutil.which("node")
    if node is None:
        raise SystemExit("Node.js is required to run scripts/check-design-browser.mjs")
    script = Path(__file__).with_name("check-design-browser.mjs")
    result = subprocess.run([node, str(script), *sys.argv[1:]], check=False)
    raise SystemExit(result.returncode)


if __name__ == "__main__":
    main()

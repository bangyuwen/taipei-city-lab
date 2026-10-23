"""Prepare youtong from clean, CI-passed GitHub main; never deploy credentials."""
import argparse
import hashlib
import json
import shutil
import subprocess
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent
REPO = SITE.parents[1]
POLICY = json.loads((SITE / 'deploy/production.json').read_text())


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args], text=True).strip()


def remote_main(root):
    repository = POLICY['repository']
    if git(root, 'remote', 'get-url', 'origin').rstrip('/') not in (
        f'https://github.com/{repository}', f'https://github.com/{repository}.git',
        f'git@github.com:{repository}.git',
    ):
        raise ValueError('Production requires the configured GitHub origin')
    lines = git(root, 'ls-remote', '--exit-code', 'origin', 'refs/heads/main').splitlines()
    if len(lines) != 1 or lines[0].split()[1] != 'refs/heads/main':
        raise ValueError('Cannot establish remote main')
    return lines[0].split()[0]


def require_clean_main(root, main_sha):
    if git(root, 'status', '--porcelain', '--untracked-files=all'):
        raise ValueError('Production requires a clean checkout')
    if git(root, 'rev-parse', 'HEAD') != main_sha:
        raise ValueError('Production HEAD must equal current remote main')


def require_ci(sha, pages):
    runs = [run for page in pages for run in page['workflow_runs']
            if run['head_sha'] == sha and run['head_branch'] == 'main'
            and run['event'] == 'push']
    if not runs:
        raise ValueError('No main-push Topic sites CI for this commit')
    latest = max(runs, key=lambda run: run['id'])
    if latest['status'] != 'completed' or latest['conclusion'] != 'success':
        raise ValueError('Latest main-push Topic sites CI has not passed')
    return latest['id']


def prepare(output):
    if POLICY['branch'] != 'main' or POLICY['project_id'] == POLICY['test_project_id']:
        raise ValueError('Invalid production destination policy')
    # Resolve before any write; never replace an existing source checkout.
    if output.exists() or output.is_symlink():
        raise ValueError('Use a new, empty output path')
    sha = remote_main(REPO)
    require_clean_main(REPO, sha)
    endpoint = (f"repos/{POLICY['repository']}/actions/workflows/topic-sites.yml/runs"
                f'?event=push&head_sha={sha}&per_page=100')
    pages = json.loads(subprocess.check_output(
        ['gh', 'api', '--paginate', '--slurp', endpoint], text=True))
    ci_run = require_ci(sha, pages)
    # Existing owners enforce the public allowlist and rebuild retained inputs.
    for command in (['npm', 'run', 'prepare-data'], ['npm', 'test'],
                    ['npm', 'run', 'check', '--', '--require-hosting']):
        subprocess.run(command, cwd=SITE, check=True)
    require_clean_main(REPO, sha)
    if remote_main(REPO) != sha:
        raise ValueError('Main advanced during preparation; retry from its new head')
    public = SITE / 'public'
    files = {}
    for path in sorted(public.rglob('*')):
        if path.is_symlink():
            raise ValueError('Symlink in public output')
        if path.is_file():
            files[path.relative_to(public).as_posix()] = hashlib.sha256(path.read_bytes()).hexdigest()
    if 'index.html' not in files or 'release.json' in files:
        raise ValueError('Invalid public output or reserved receipt name')
    output.mkdir(parents=True)
    shutil.copytree(public, output / 'out')
    (output / '.openai').mkdir()
    manifest = {'project_id': POLICY['project_id'], 'static': {'directory': 'out'}}
    (output / '.openai/hosting.json').write_text(json.dumps(manifest, indent=2) + '\n')
    receipt = {'repository': POLICY['repository'], 'branch': 'main', 'commit_sha': sha,
               'ci_run_id': ci_run, 'files': files}
    encoded = json.dumps(receipt, indent=2) + '\n'
    (output / 'release.json').write_text(encoded)
    (output / 'out/release.json').write_text(encoded)
    print(json.dumps({'source_commit': sha, 'project_id': POLICY['project_id'],
                      'output': str(output), 'runtime_files': len(files)}))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True, type=Path)
    prepare(parser.parse_args().output.absolute())

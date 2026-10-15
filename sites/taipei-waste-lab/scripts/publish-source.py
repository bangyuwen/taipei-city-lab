"""Static-site source synchronization when the Sites helper is unavailable.

The native Sites write credential is accepted once on hidden stdin, retained only
in process memory and passed to Git through its process environment. No token is
written to disk or embedded in a remote URL.
"""
import gzip
import io
import json
import os
import runpy
import subprocess
import sys
import tarfile
import termios
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
os.chdir(ROOT)
if sys.stdin.isatty():
    settings = termios.tcgetattr(sys.stdin)
    settings[3] &= ~termios.ECHO
    termios.tcsetattr(sys.stdin, termios.TCSANOW, settings)
print('Ready for Site credential JSON on stdin (input is hidden).', flush=True)
request = json.loads(sys.stdin.readline())
credential = request['credential']
manifest = json.loads((ROOT / '.openai/hosting.json').read_text())
if request['project_id'] != manifest['project_id']:
    raise ValueError('Project identity mismatch')
if manifest.get('static', {}).get('directory') != 'out':
    raise ValueError('Expected public output directory out')
public = runpy.run_path(str(ROOT / 'scripts/prepare-public.py'))
public['prepare']()
if credential['auth_mode'] != 'http_extra_header':
    raise ValueError('Unsupported Git authentication mode')
env = os.environ.copy()
slot = int(env.get('GIT_CONFIG_COUNT', '0'))
env['GIT_CONFIG_COUNT'] = str(slot + 1)
env[f'GIT_CONFIG_KEY_{slot}'] = 'http.' + credential['remote_url'] + '.extraHeader'
env[f'GIT_CONFIG_VALUE_{slot}'] = 'Authorization: Bearer ' + credential['token']
env['GIT_TERMINAL_PROMPT'] = '0'

def git(*args, check=True):
    result = subprocess.run(['git', *args], cwd=ROOT, env=env, text=True,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    if check and result.returncode:
        error = result.stderr.replace(credential['token'], '[redacted]')
        raise RuntimeError('Git operation failed: ' + error[:1200])
    return result

if not (ROOT / '.git').exists():
    git('init', '-b', credential['branch'])
    git('remote', 'add', 'origin', credential['remote_url'])
    git('fetch', 'origin')
    if git('rev-parse', '--verify', 'refs/remotes/origin/' + credential['branch'], check=False).returncode == 0:
        # New checkout only: retain the remote baseline without overwriting files.
        git('reset', '--mixed', 'refs/remotes/origin/' + credential['branch'])
else:
    if git('remote', 'get-url', 'origin').stdout.strip() != credential['remote_url']:
        raise ValueError('Existing source repository mismatch')
    git('fetch', 'origin')
if not git('config', 'user.name', check=False).stdout.strip():
    git('config', 'user.name', 'Codex')
if not git('config', 'user.email', check=False).stdout.strip():
    git('config', 'user.email', 'codex@openai.com')
git('add', '-A')
if git('diff', '--cached', '--quiet', check=False).returncode:
    git('commit', '-m', request.get('message', 'Update Taipei bin distribution and removal research site'))
git('push', 'origin', 'HEAD:refs/heads/' + credential['branch'])
commit = git('rev-parse', 'HEAD').stdout.strip()
remote_sha = git('ls-remote', 'origin', 'refs/heads/' + credential['branch']).stdout.split()[0]
if remote_sha != commit:
    raise ValueError('Remote source does not match local HEAD')
archive = Path('/tmp/taipei-waste-lab-deployment.tar.gz')
# Archive committed bytes only, renaming the approved runtime files into out/.
source_names = {'.openai/hosting.json', *(f'dist/{name}' for name in public['ASSETS'])}
archive_result = subprocess.run(['git', 'archive', '--format=tar', commit, *sorted(source_names)],
                                cwd=ROOT, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
if archive_result.returncode:
    raise RuntimeError('Static archive generation failed')
packed = io.BytesIO()
seen = set()
with tarfile.open(fileobj=io.BytesIO(archive_result.stdout), mode='r:') as source_tar:
    with tarfile.open(fileobj=packed, mode='w') as target_tar:
        for entry in source_tar:
            if entry.isdir():
                continue
            if entry.name not in source_names or not entry.isfile():
                raise ValueError('Unexpected public archive entry')
            seen.add(entry.name)
            content = source_tar.extractfile(entry)
            if entry.name.startswith('dist/'):
                entry.name = 'out/' + entry.name.removeprefix('dist/')
            target_tar.addfile(entry, content)
if seen != source_names:
    raise ValueError('Public archive is incomplete')
archive.write_bytes(gzip.compress(packed.getvalue(), mtime=0))
with tarfile.open(archive) as tar:
    package_manifest = json.load(tar.extractfile('.openai/hosting.json'))
    if package_manifest != manifest:
        raise ValueError('Archived hosting manifest mismatch')
    expected = {'.openai/hosting.json', *(f'out/{name}' for name in public['ASSETS'])}
    if set(tar.getnames()) != expected or 'out/index.html' not in tar.getnames():
        raise ValueError('Public archive allowlist mismatch')
print(json.dumps({'project_id':manifest['project_id'], 'commit_sha':commit,
                  'archive':str(archive), 'remote_verified':True}), flush=True)

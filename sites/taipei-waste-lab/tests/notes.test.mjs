import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';

const root = new URL('../', import.meta.url);
function python(code) {
  const result = spawnSync(process.env.PYTHON_BIN || 'python3', ['-c', code], {
    cwd: root, encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
}

test('private notes retain closed reading content, unknowns, tables and source links', () => {
  python(String.raw`
import runpy
from pathlib import Path
m = runpy.run_path('scripts/prepare-notes.py')
html = '''<section id="panel-test" hidden><nav>Skip navigation</nav>
<h2>Current proposal</h2><p>Not executed; outcome unknown.</p>
<details><summary>Archived plan</summary><p>Superseded, not a current schedule.</p></details>
<dl><dt>Final disposal</dt><dd></dd></dl>
<table><caption>Evidence limits</caption><thead><tr><th>Record</th><th>Result</th></tr></thead>
<tbody><tr><td>E06</td><td>Self-reported completion<br>Not measured | not prevalence</td></tr></tbody></table>
<ol start="3"><li>Keep evidence<ul><li>Keep counterexample</li></ul></li><li>Keep unknown</li></ol>
<a href="../#problem">Problem</a><a href="https://example.org/a?q=1&amp;v=2">Source</a>
<img src="../images/citywide/district-activity.png" alt="Activity chart">
<button>Skip control</button><script>Skip script</script></section>'''
node = m['Document'](html).select('#panel-test')
note = m['Markdown'](Path.cwd() / 'dist/cases/zhongshan.html').render(node)
for text in ['## Current proposal', 'Not executed; outcome unknown.', 'Archived plan',
             'Superseded, not a current schedule.', '**Final disposal**',
             '| E06 | Self-reported completion<br>Not measured \\| not prevalence |',
             '3. Keep evidence', '   - Keep counterexample', '4. Keep unknown',
             '../dist/index.html#problem', 'https://example.org/a?q=1&v=2',
             '![Activity chart](<../dist/images/citywide/district-activity.png>)']:
    assert text in note, (text, note)
for text in ['Skip navigation', 'Skip control', 'Skip script']:
    assert text not in note
blank = m['Document']('<dl><dt>Final disposal</dt><dd></dd></dl>').select('dl')
assert m['clean'](m['Markdown'](Path.cwd() / 'dist/index.html').render(blank)) == '**Final disposal**'
`);
});

test('inventory covers every research panel and generated notes preserve all reading text', () => {
  python(String.raw`
import hashlib, json, re, runpy
from pathlib import Path
from urllib.parse import unquote, urlsplit
m = runpy.run_path('scripts/prepare-notes.py')
root = Path.cwd()
inventory = json.loads((root / 'docs/website-notes.json').read_text())
paths = {root / e['page'] for e in inventory}
before = {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}
files = m['build']()
assert files == m['build'](), 'Reading export must be deterministic'
assert len(files) == 21
index = files['README.md']
assert '## 本次補齊的 20 份筆記' in index
for entry in inventory:
    if entry.get('output'):
        assert f'- [{entry["title"]}]({entry["output"]})' in index
    for name in entry['notes']:
        title = m['note_title'](name)
        assert re.search(r'[\u4e00-\u9fff]', title), (name, title)
        assert f'[{title}](<' in index
        assert f'[{Path(name).parent.name}/{Path(name).name}]' not in index
assert before == {p: hashlib.sha256(p.read_bytes()).hexdigest() for p in paths}

def visible_leaves(node):
    if isinstance(node, str):
        yield node
    elif not m['skipped'](node):
        for child in node.children:
            yield from visible_leaves(child)

def normalize(text):
    return re.sub(r'\s|\\', '', text)

for entry in inventory:
    if 'output' not in entry:
        continue
    node = m['Document']((root / entry['page']).read_text()).select(entry['selector'])
    output = normalize(files[entry['output']])
    for leaf in visible_leaves(node):
        assert normalize(leaf) in output, (entry['output'], leaf)
    assert '自動產生的私人閱讀副本' in files[entry['output']]
    assert '未知' in files[entry['output']]

link_ids = {}
for name, text in files.items():
    for target in re.findall(r'\]\(<([^>]+)>\)', text):
        parts = urlsplit(target)
        if parts.scheme or parts.netloc or target.startswith('/'):
            continue
        path = (root / 'notes' / unquote(parts.path)).resolve()
        assert path.is_file(), (name, target)
        if parts.fragment and path.suffix == '.html':
            if path not in link_ids:
                doc = m['Document'](path.read_text())
                link_ids[path] = {n.attrs.get('id') for n in doc.root.walk()}
            ids = link_ids[path]
            # Panel hashes are application routes, not necessarily element IDs.
            assert parts.fragment in ids or 'panel-' + parts.fragment in ids, (name, target)
assets = runpy.run_path('scripts/prepare-public.py')['ASSETS']
assert not any(name.startswith('notes/') or name.endswith('.md') for name in assets)
`);
});

test('freshness check rejects changed content and inventory drift', () => {
  python(String.raw`
import json, runpy, sys, tempfile
from pathlib import Path
m = runpy.run_path('scripts/prepare-notes.py')
globals_ = m['main'].__globals__
with tempfile.TemporaryDirectory() as directory:
    root = Path(directory)
    (root / 'dist').mkdir()
    (root / 'docs').mkdir()
    html = root / 'dist/index.html'
    html.write_text('<section class="page-panel" id="panel-spec"><h2>Draft</h2><p>Unknown</p></section>')
    item = dict(title='Draft', page='dist/index.html', selector='#panel-spec',
                coverage='缺少完整正文', reason='fixture', notes=[],
                owners=['dist/index.html'], output='spec.md')
    (root / 'docs/website-notes.json').write_text(json.dumps([item]))
    globals_['ROOT'] = root
    globals_['OUTPUT'] = root / 'notes'
    sys.argv = ['prepare-notes.py']
    m['main']()
    sys.argv = ['prepare-notes.py', '--check']
    m['main']()
    retired = root / 'notes/retired.md'
    retired.write_text('Former reading export')
    try:
        m['main']()
    except SystemExit as error:
        assert error.code == 1
    else:
        raise AssertionError('A retired export passed freshness validation')
    retired.unlink()
    m['main']()
    html.write_text(html.read_text().replace('Unknown', 'Still unknown'))
    try:
        m['main']()
    except SystemExit as error:
        assert error.code == 1
    else:
        raise AssertionError('Stale notes passed validation')
    html.write_text(html.read_text() + '<section class="page-panel" id="panel-new"></section>')
    try:
        m['build']()
    except ValueError as error:
        assert 'Panel inventory drift' in str(error)
    else:
        raise AssertionError('An unmapped panel passed validation')
`);
});

"""Package preserved research inputs and field templates for private offline use."""
import html
import json
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
DOCS = ('bin-reduction.md', 'bin-removal-history.md', 'global-bin-practices.md', 'bin-design.md')


def inline_markdown(text):
    """Render only escaped text, emphasis and source links from local notes."""
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https://[^\s)]+)\)',
                  r'<a href="\2" target="_blank" rel="noopener noreferrer">\1 ↗</a>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)


def reference_record(item):
    esc = html.escape
    kind = '論文' if item['kind'] == 'academic' else '實務紀錄'
    method_label = '研究怎麼做' if item['kind'] == 'academic' else '實際怎麼做'
    sources = (item.get('sources') or [{'label': item['sourceLabel'], 'url': item['url']}])
    links = ''.join(f'<a href="{esc(source["url"], quote=True)}" target="_blank" rel="noopener noreferrer">{esc(source["label"])}</a>' for source in sources)
    return (f'<article class="research-reference" aria-labelledby="reference-{esc(item["id"])}">'
            f'<h4 id="reference-{esc(item["id"])}" tabindex="-1">{esc(item["title"])}</h4>'
            f'<p class="research-reference-meta">{esc(item["id"])} · {kind} · {esc(item["attribution"])}</p>'
            f'<p class="research-reference-method"><strong>{method_label}：</strong>{esc(item["method"])}</p>'
            '<dl class="research-reference-facts">'
            f'<div><dt>得到什麼</dt><dd>{esc(item["finding"])}</dd></div>'
            f'<div><dt>對台北的啟發 · 本站解讀</dt><dd>{esc(item["lesson"])}</dd></div></dl>'
            f'<p class="research-reference-limit"><strong>判讀界線：</strong>{esc(item["limitation"])}</p>'
            f'<details class="research-reference-source"><summary>來源與查閱範圍</summary><p>{esc(item["readingScope"])}</p><p>{esc(item["citation"])}</p>{links}</details></article>')


def render_references(index_text, catalog):
    items = catalog['items']
    by_id = {item['id']: item for item in items}
    assert len(items) == len(by_id), 'Duplicate reference ID'
    for item in items:
        assert re.fullmatch(r'[A-Z][0-9]{2}', item['id']), 'Invalid reference ID'
        assert item['kind'] in ('academic', 'practice'), 'Invalid reference kind'
        for source in (item.get('sources') or [{'label': item['sourceLabel'], 'url': item['url']}]):
            assert source['url'].startswith('https://'), 'Reference source must use HTTPS'
    sections = {
        'research-paper-records': '\n'.join(reference_record(item) for item in items if item['kind'] == 'academic'),
        'research-practice-records': '\n'.join(reference_record(item) for item in items if item['kind'] == 'practice')
    }
    synthesis = []
    for item in catalog['synthesis']:
        links = []
        for key in item['references']:
            assert key in by_id, f'Unknown synthesis reference: {key}'
            links.append(f'<button type="button" data-research-target="reference-{html.escape(key)}">{html.escape(key)} · {html.escape(by_id[key]["title"])}</button>')
        synthesis.append('<article class="research-synthesis-item"><h4>' + html.escape(item['title']) + '</h4><p>' +
                         html.escape(item['takeaway']) + '</p><p><strong>可以先做：</strong>' + html.escape(item['action']) +
                         '</p><p><strong>如何確認有用：</strong>' + html.escape(item['check']) +
                         '</p><div class="research-synthesis-sources"><span>回看依據</span>' + ''.join(links) + '</div></article>')
    sections['research-synthesis'] = '\n'.join(synthesis)
    for marker, body in sections.items():
        index_text, count = re.subn(f'<!-- {marker}-start -->.*?<!-- {marker}-end -->',
                                   lambda match: f'<!-- {marker}-start -->\n{body}\n<!-- {marker}-end -->',
                                   index_text, flags=re.S)
        assert count == 1, f'Missing reference marker: {marker}'
    return index_text


def main():
    canonical = ROOT.parent.parent / 'topics/bins/research'
    docs = {name: (ROOT / 'data/research' / name).read_text() for name in DOCS}
    if canonical.is_dir():
        if (ROOT / 'research').exists():
            shutil.rmtree(ROOT / 'research')
        shutil.copytree(canonical, ROOT / 'research',
                        ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    # The portable copy links to the retained flat documents, not monorepo docs/.
    for note in (ROOT / 'research').rglob('*.md'):
        note.write_text(re.sub(r'(?<=\]\()\.\./\.\./docs/',
                               '../../dist/research/', note.read_text()))
    destination = DIST / 'research'
    if destination.exists():
        shutil.rmtree(destination)
    shutil.copytree(ROOT / 'research', destination,
                    ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for note in destination.rglob('*.md'):
        text = re.sub(r'(?<=\]\()\.\./\.\./dist/data/', '../../data/', note.read_text())
        text = re.sub(r'(?<=\]\()\.\./\.\./dist/research/', '../', text)
        note.write_text(text)
    for name, text in docs.items():
        (destination / name).write_text(re.sub(r'(?<=\]\()\.\./data/history/', '../data/', text))
    literature = (ROOT / 'research/literature-2026-10-15/README.md').read_text()
    papers = re.findall(r'^### (L\d{2} [^\n]+)\n(.*?)(?=^### |^## |\Z)',
                        literature, re.M | re.S)
    assert len(papers) == 13
    cards = []
    for title, body in papers:
        paragraphs = [p for p in body.strip().split('\n\n') if p.startswith('**')]
        cards.append('<details><summary>' + html.escape(title) + '</summary>' +
                     ''.join('<p>' + inline_markdown(p) + '</p>' for p in paragraphs) + '</details>')
    index = DIST / 'index.html'
    text = index.read_text()
    text, count = re.subn(r'<!-- research-literature-start -->.*?<!-- research-literature-end -->',
                         '<!-- research-literature-start -->\n' + '\n'.join(cards) +
                         '\n<!-- research-literature-end -->', text, flags=re.S)
    assert count == 1
    catalog = json.loads((ROOT / 'research/reference-guide-2026-10-16/catalog.json').read_text())
    text = render_references(text, catalog)
    index.write_text(text)

    # Preserve the original relative paths so lineage checks work after extraction.
    paths = [p for p in (ROOT / 'research').rglob('*')
             if p.is_file() and '__pycache__' not in p.parts and p.suffix != '.pyc']
    paths += [p for p in (DIST / 'data').glob('*') if p.is_file()]
    paths += [p for p in (DIST / 'research').glob('*.md') if p.is_file()]
    paths += [ROOT / 'data/research' / name for name in DOCS]
    paths += [DIST / 'index.html', ROOT / 'scripts/package-research.py',
              ROOT / 'scripts/prepare-research-execution.py',
              ROOT / 'scripts/compare-snapshots.py', ROOT / 'scripts/analyze-coordinate-distances.py',
              ROOT / 'scripts/estimate-budget.py']
    destination = DIST / 'research/research-execution-2026-10-15.zip'
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(set(paths)):
            info = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), (2026, 10, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            payload = path.read_bytes()
            if path.parent == DIST / 'research' and path.suffix == '.md':
                # The archive keeps full notes under research/, not duplicate subtrees.
                payload = re.sub(r'(?<=\]\()\.\./research/', '../../research/',
                                 payload.decode('utf-8')).encode('utf-8')
            archive.writestr(info, payload)
    print(f'Packaged {len(set(paths))} files and {len(papers)} literature cards: {destination.name}')


if __name__ == '__main__':
    main()

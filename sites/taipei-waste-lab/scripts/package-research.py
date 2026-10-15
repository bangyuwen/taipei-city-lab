"""Package preserved research inputs and field templates for private offline use."""
import html
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

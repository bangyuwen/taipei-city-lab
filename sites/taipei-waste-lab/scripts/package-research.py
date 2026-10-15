"""Package preserved research inputs and field templates for the static site."""
import html
import re
import shutil
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / 'dist'
FOLDERS = ['execution-2026-10-15', 'research-plan-2026-10-15', 'literature-2026-10-15', 'service-strategy-2026-10-15', 'budget-2026-10-15']


def inline_markdown(text):
    """Render only escaped text, emphasis and source links from local notes."""
    text = html.escape(text)
    text = re.sub(r'\[([^\]]+)\]\((https://[^\s)]+)\)',
                  r'<a href="\2" target="_blank" rel="noopener noreferrer">\1 ↗</a>', text)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<strong>\1</strong>', text)
    return re.sub(r'\*([^*]+)\*', r'<em>\1</em>', text)


def main():
    canonical = ROOT.parent.parent / 'topics/bins/research'
    if canonical.is_dir():
        shutil.copytree(canonical, ROOT / 'research', dirs_exist_ok=True,
                        ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
    for folder in FOLDERS:
        shutil.copytree(ROOT / 'research' / folder, DIST / 'research' / folder,
                        dirs_exist_ok=True, ignore=shutil.ignore_patterns('__pycache__', '*.pyc'))
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
    paths += [ROOT / 'scripts/prepare-research-execution.py',
              ROOT / 'scripts/compare-snapshots.py', ROOT / 'scripts/analyze-coordinate-distances.py',
              ROOT / 'scripts/estimate-budget.py']
    destination = DIST / 'research/research-execution-2026-10-15.zip'
    with zipfile.ZipFile(destination, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in sorted(set(paths)):
            info = zipfile.ZipInfo(path.relative_to(ROOT).as_posix(), (2026, 10, 15, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            archive.writestr(info, path.read_bytes())
    print(f'Packaged {len(set(paths))} files and {len(papers)} literature cards: {destination.name}')


if __name__ == '__main__':
    main()

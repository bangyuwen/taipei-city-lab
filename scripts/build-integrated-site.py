#!/usr/bin/env python3
"""Rebuild the existing integrated site from shared templates and canonical inputs.

This standard-library-only build never downloads data and never changes Site
identity. source.zip is built separately by package-source.py, not a template.
"""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
SITE = Path('sites/taipei-city-lab')
TEMPLATE = Path('shared/web/template')
DOWNLOAD_DOCS = {
    'RESEARCH.md': 'research-overview.md',
    'RESEARCH-REVIEW.md': 'research-review.md',
    'DEEPENING-REVIEW.md': 'deepening-review.md',
    'THREE-REVIEW.md': 'three-review.md',
    'MAP-REVIEW.md': 'map-review.md',
    'DATA-REVIEW.md': 'data-review.md',
}


def load_script(root: Path, name: str):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), root / 'scripts' / name)
    if spec is None or spec.loader is None:
        raise ValueError(f'Cannot load build API: {name}')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def download_document(root: Path, source: str) -> bytes:
    """Resolve canonical Markdown links to generated download URLs."""
    text = (root / 'shared/docs' / source).read_text(encoding='utf-8')
    downloads = {canonical: target for target, canonical in DOWNLOAD_DOCS.items()}

    def resolve(match):
        path, fragment = match.group(1), match.group(2) or ''
        if '://' in path or path.startswith('mailto:'):
            return match.group(0)
        canonical = path.removeprefix('./')
        if canonical not in downloads:
            raise ValueError(f'Unmapped local Markdown link in {source}: {path}')
        return '](' + downloads[canonical] + fragment + ')'

    text = re.sub(r'\]\(([^\s)#]+\.md)(#[^\s)]*)?\)', resolve, text)
    return text.encode('utf-8')


def outputs(root: Path = ROOT) -> dict[Path, bytes]:
    """Return every generated deployable file, excluding the portable archive."""
    root = Path(root)
    destination = root / SITE / 'dist'
    template = root / TEMPLATE
    result = {}
    for source in sorted(template.rglob('*')):
        if not source.is_file():
            continue
        relative = source.relative_to(template)
        if (relative.parts[0] in {'modules', 'data', '.openai'}
                or relative.as_posix() in {'source.zip', 'geo.js', 'contracts.js'}):
            raise ValueError(f'Generated or canonical-library input found in web template: {relative}')
        if len(relative.parts) == 1 and source.suffix.lower() == '.md':
            raise ValueError(f'Research documents belong in shared/docs, not the web template: {relative}')
        result[destination / relative] = source.read_bytes()
    if destination / 'index.html' not in result:
        raise ValueError('The shared web template is missing index.html')
    for download, source in DOWNLOAD_DOCS.items():
        result[destination / download] = download_document(root, source)
    model_builder = load_script(root, 'build-topic-models.py')
    result.update(model_builder.outputs(root))
    data_builder = load_script(root, 'build-topic-data.py')
    snapshot = data_builder.assemble_snapshot(root)
    result[destination / 'data/snapshot.json'] = data_builder.json_bytes(snapshot)
    result[destination / 'data/source-catalog.json'] = data_builder.json_bytes({
        'meta': snapshot['meta'], 'sources': snapshot['sources'],
    }, True)
    return result


def build_integrated_site(root: Path = ROOT, check: bool = False) -> None:
    """Write/check template, model, library and data copies without changing dates."""
    root = Path(root)
    stale = []
    expected = outputs(root)
    destination = root / SITE / 'dist'
    # This directory is generated. Remove obsolete outputs so deleted templates
    # do not survive a rebuild. The source archive has its own packaging step.
    for target in destination.rglob('*'):
        if not target.is_file() or target in expected or target == destination / 'source.zip':
            continue
        if check:
            stale.append(str(target.relative_to(root)) + ' (unexpected)')
        else:
            target.unlink()
    for target, payload in expected.items():
        if check:
            if not target.is_file() or target.read_bytes() != payload:
                stale.append(str(target.relative_to(root)))
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
    if not check:
        for directory in sorted((path for path in destination.rglob('*') if path.is_dir()),
                                key=lambda path: len(path.parts), reverse=True):
            if not any(directory.iterdir()):
                directory.rmdir()
    if stale:
        raise ValueError('Integrated site differs from canonical inputs: ' + ', '.join(stale))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--check', action='store_true', help='Check existing output without writing files')
    options = parser.parse_args()
    try:
        build_integrated_site(options.root, options.check)
    except (ValueError, OSError, KeyError) as error:
        parser.exit(1, f'{error}\n')
    print('Integrated site matches shared templates and canonical inputs.' if options.check
          else 'Built sites/taipei-city-lab/dist from shared templates and canonical inputs.')


if __name__ == '__main__':
    main()

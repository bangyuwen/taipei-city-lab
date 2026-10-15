"""Connect shared skills and project context to their standard discovery paths."""
import argparse
import os
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
LINKS = {
    '.agents/skills/impeccable': 'shared/skills/impeccable',
    'PRODUCT.md': 'shared/docs/product.md',
    'DESIGN.md': 'shared/docs/design.md',
    '.impeccable/config.json': 'shared/skills/impeccable.config.json',
    '.impeccable/design.json': 'shared/docs/design.json',
    '.impeccable/surfaces/shared-web-template-index-html.md':
        'shared/docs/surfaces/shared-web-template-index-html.md',
}


def setup(root: Path, check: bool = False) -> None:
    pending = []
    for alias, source in LINKS.items():
        link, target = root / alias, root / source
        if not target.exists():
            raise ValueError(f'Missing skill/context source: {source}')
        if link.is_symlink() and link.resolve() == target.resolve():
            continue
        if link.exists() or link.is_symlink():
            raise ValueError(f'Refusing to replace existing content at {alias}; expected a link to {source}')
        pending.append((link, target))
    if check and pending:
        raise ValueError('Run npm run setup-skills to create: ' + ', '.join(
            str(link.relative_to(root)) for link, _ in pending))
    launcher = root / 'shared/skills/impeccable/scripts/impeccable'
    if os.name != 'nt' and not launcher.stat().st_mode & 0o100:
        if check:
            raise ValueError('Run npm run setup-skills to restore the launcher executable permission')
        launcher.chmod(launcher.stat().st_mode | 0o111)
    for link, target in pending:
        link.parent.mkdir(parents=True, exist_ok=True)
        link.symlink_to(os.path.relpath(target, link.parent), target_is_directory=target.is_dir())


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', type=Path, default=ROOT)
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    try:
        setup(args.root.resolve(), args.check)
    except (OSError, ValueError) as error:
        parser.exit(1, f'{error}\n')
    print('Shared skill and project-context discovery links are ready.')

"""Build deployable model copies from the seven topic-owned source modules."""
import argparse
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INTEGRATED_DIST = Path('sites/taipei-city-lab/dist')
TOPICS = ('shade', 'bins', 'rat', 'traffic', 'bus', 'buildings', 'audit')


def outputs(root=ROOT):
    result = {}
    for topic in TOPICS:
        text = (root / 'topics' / topic / 'model.js').read_text()
        text = text.replace("from '../../shared/lib/spatial.js'", "from './spatial.js'")
        text = text.replace("from '../../shared/lib/contracts.js'", "from '../contracts.js'")
        result[root / INTEGRATED_DIST / 'modules' / f'{topic}.js'] = text.encode()
    for name, target in [('spatial.js', 'modules/spatial.js'),
                         ('geo.js', 'geo.js'), ('contracts.js', 'contracts.js')]:
        result[root / INTEGRATED_DIST / target] = (root / 'shared/lib' / name).read_bytes()
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    options = parser.parse_args()
    stale = []
    for target, payload in outputs().items():
        if options.check:
            if not target.exists() or target.read_bytes() != payload:
                stale.append(str(target.relative_to(ROOT)))
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(payload)
    if stale:
        raise SystemExit('Rebuild model copies with npm run build-models: ' + ', '.join(stale))
    print('Seven topic models and shared library copies match.' if options.check else 'Built seven topic models and shared libraries.')


if __name__ == '__main__':
    main()

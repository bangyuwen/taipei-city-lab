"""Join explicit planning choices to frozen recheck evidence, without re-ranking demand."""
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def read(path):
    return json.loads(path.read_text())


def build():
    manifest = read(HERE / 'inputs.json')
    for item in manifest['sources']:
        assert hashlib.sha256((HERE / item['path']).read_bytes()).hexdigest() == item['sha256'], item['path']
    rechecks = [read(HERE / f'../{name}-recheck-2026-10-20/results.json')
                for name in ['beitou-nangang', 'other-districts']]
    evidence = {c['candidate_id']: c for result in rechecks for c in result['candidates']}
    summary = read(HERE / '../taipei-citywide-2026-10-19/results/summary.json')
    original = [c for c in summary['candidates'] if c['candidate_id'] in evidence]
    assert len(original) == len(evidence) == 36
    choices = read(HERE / 'choices.json')
    first = {c['candidate_id']: c for c in choices}
    assert len(first) == len(choices) == 12 and set(first) <= set(evidence)
    groups = [
        {'id': 'selection', 'label': '先釐清選點與共用來源', 'count': 3},
        {'id': 'boundary', 'label': '先釐清場所與候選場域的邊界', 'count': 5},
        {'id': 'comparison', 'label': '核實跨區或近距離紀錄，保留對照', 'count': 4},
    ]
    assert all(sum(c['group'] == g['id'] for c in choices) == g['count'] for g in groups)
    districts, points = [], []
    for district in summary['districts'][:12]:
        area = district['source_area']
        selected = [c for c in original if c['source_area'] == area]
        picked = [c for c in selected if c['candidate_id'] in first]
        assert len(selected) == 3 and len(picked) == 1
        ordered = picked + [c for c in selected if c not in picked]
        districts.append({'area': area, 'code': picked[0]['candidate_id'][1:3],
                          'candidate_ids': [c['candidate_id'] for c in ordered]})
        for number, c in enumerate(ordered, 1):
            point = evidence[c['candidate_id']]
            assert c['station_id'] == point['station_id'] and c['events'] == point['events']
            assert all(value is None for value in point['field_status'].values())
            choice = first.get(c['candidate_id'])
            points.append({**point, 'wave': f'W{number}', 'original_area_activity_rank': c['area_rank'],
                           'choice': choice,
                           'planning_reason': choice['reason'] if choice else '首點之後，依原候選次序補查；不表示需求或問題較少。',
                           'field_check': choice['confirm'] if choice else point['next_check'],
                           'ready_for_siting': False})
    result = {'date': '2026-10-20', 'status': 'proposed_not_observed',
              'basis': 'manual_inspection_order_from_frozen_rechecks_not_demand_ranking',
              'groups': groups, 'districts': districts, 'candidates': points,
              'sources': manifest['sources'], 'city_candidate_count': 36,
              'first_wave_count': 12, 'campus_unchanged': True}
    (HERE / 'priority.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


if __name__ == '__main__':
    result = build()
    print(f"Built {result['first_wave_count']} proposed first inspections; all 36 city candidates retained.")

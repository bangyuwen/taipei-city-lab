"""Build desk-research queues from preserved snapshots without inferring events."""
import csv
import hashlib
import json
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RESEARCH = ROOT.parent.parent / 'topics/bins/research'
if not RESEARCH.is_dir():
    RESEARCH = ROOT / 'research'
OUT = RESEARCH / 'execution-2026-10-15'


def read_json(path):
    return json.loads(path.read_text(encoding='utf-8'))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_csv(name, rows):
    with (OUT / name).open('w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)


def main():
    comparison_path = ROOT / 'dist/data/comparison-2024-2026.json'
    distances_path = ROOT / 'dist/data/comparison-coordinate-distances.json'
    comparison = read_json(comparison_path)
    distances = read_json(distances_path)
    assert digest(comparison_path) == distances['meta']['comparisonSHA256']
    for side in ['before', 'after']:
        source = comparison['meta'][side]
        assert digest(ROOT / 'dist/data' / source['file']) == source['sha256']
    entries = {entry['id']: entry for entry in comparison['entries']}
    pairs = distances['pairs']
    assert {p['comparisonId'] for p in pairs} == {
        e['id'] for e in entries.values() if e['category'] == 'same_address_changed'}
    review = []
    for p in pairs:
        before, after = p['before'], p['after']
        review.append({
            'comparison_id': p['comparisonId'], 'district': p['district'],
            'address': p['address'], 'before_id': before['id'],
            'before_source_row': before['sourceRow'], 'before_longitude': before['rawX'],
            'before_latitude': before['rawY'], 'after_id': after['id'],
            'after_source_row': after['sourceRow'], 'after_longitude': after['rawX'],
            'after_latitude': after['rawY'], 'distance_m': p['distanceMeters'],
            'rank': p['rank'], 'coordinate_quality': p['quality'],
            'desk_check': '原始列與既有配對一致；距離不是步行距離或事件證據',
            'verification_status': '待獨立證據', 'evidence_url': '',
            'evidence_date': '', 'observed_at': '', 'event_type': '',
            'event_date': '', 'reviewer': '',
            'next_evidence': '官方定位方式及更正紀錄；具日期異動單；現勘僅核對現況'})
    write_csv('coordinate-verification-75.csv', review)

    queue = []
    for e in entries.values():
        queue.append({
            'comparison_id': e['id'], 'source_category': e['category'],
            'district': e['district'], 'address': e['address'],
            'before_ids': '|'.join(p['id'] for p in e['before']),
            'after_ids': '|'.join(p['id'] for p in e['after']),
            'before_rows': len(e['before']), 'after_rows': len(e['after']),
            'verification_status': '待獨立證據', 'evidence_url': '',
            'evidence_date': '', 'event_type': '', 'event_date': '',
            'conclusion': '', 'reviewer': ''})
    write_csv('all-comparison-verification.csv', queue)

    selection = read_json(OUT / 'candidate-selection.json')
    candidates = []
    for item in selection['candidates']:
        e = entries[item['comparisonId']]
        assert len(e['after']) == 1
        point = e['after'][0]
        assert point['plottable']
        candidates.append({**item, 'district': e['district'], 'address': e['address'],
            'category': e['category'], 'sourceId': point['id'],
            'sourceRow': point['sourceRow'], 'longitude': point['rawX'],
            'latitude': point['rawY'], 'status': '桌面候選，尚未現勘',
            'boundary': '以來源地址為錨點，約100公尺單側範圍待現場固定',
            'length_m': None, 'start_landmark': None, 'end_landmark': None,
            'service_verified_at': None, 'manager': None,
            'next_check': '核實設施、用途、安全觀察位置、實際邊界、清運及替代點；三種情境各選2條',
            'selection_note': '欄位相同不代表運作正常；六條正式樣本尚未選定'})
    write_csv('candidate-segments-18.csv', candidates)
    output = {
        'date': selection['date'], 'status': 'desk_ready_field_pending',
        'method': selection['method'], 'sourceGrain': 'published source row',
        'sources': comparison['meta'],
        'counts': {'candidateSegments': len(candidates), 'coordinateChecks': len(review),
                   'comparisonGroups': len(queue),
                   'categoryGroups': dict(Counter(e['category'] for e in entries.values())),
                   'completedFieldVisits': 0, 'completedUserTasks': 0, 'completedInterventions': 0},
        'candidates': candidates, 'exclusions': selection['exclusions'],
        'coordinateReview': {'status': '來源列及原計算已核對，75對實體身分與事件均待獨立證據',
                             'summary': distances['summary']},
        'inputHashes': {'comparison': digest(comparison_path),
                        'distances': digest(distances_path),
                        'selection': digest(OUT / 'candidate-selection.json')}}
    (OUT / 'desk-results.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(output['counts'], ensure_ascii=False))


if __name__ == '__main__':
    main()

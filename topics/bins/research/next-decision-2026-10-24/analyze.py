"""Reconcile four retained comment contexts with explicitly proposed desk cases."""
import csv
import hashlib
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent


def analyze(root=HERE):
    inputs = json.loads((root / 'inputs.json').read_text())
    for source in inputs['sources']:
        if hashlib.sha256((root / source['path']).read_bytes()).hexdigest() != source['sha256']:
            raise ValueError('Changed research input: ' + source['path'])
    assessment = json.loads((root / 'assessment.json').read_text())
    if assessment['observed_events'] or assessment['scheduled_visits']:
        raise ValueError('Desk cases cannot introduce field events or a visit schedule')
    journeys = json.loads((root / '../demand-evidence-2026-10-20/journey-table.json').read_text())['rows']
    candidates = {row['candidate_id']: row for row in csv.DictReader(
        (root / '../taipei-citywide-2026-10-19/results/candidates.csv').open(encoding='utf-8-sig'))}
    checks = json.loads((root / '../other-districts-recheck-2026-10-20/point-checks.json').read_text())
    forms = json.loads((root / '../taipei-citywide-2026-10-19/delivery/field-record-forms.json').read_text())
    journey_fields = {field['key'] for form in forms['forms'] if form['id'] == 'journey' for field in form['fields']}
    if not set(assessment['join_fields']) <= journey_fields:
        raise ValueError('Join contract is out of sync with the existing event form')
    if [row['e'] for row in journeys] != [case['evidence_id'] for case in assessment['scenarios']]:
        raise ValueError('Persona evidence scope changed')
    rows = []
    for source, case in zip(journeys, assessment['scenarios']):
        # These retained source projections contain no event-time/site keys.
        # Never infer a person's event identity from a proposed desk case.
        if any(source.get(key) for key in ('event_id', 'event_time', 'candidate_id', 'service_point_record_ids')):
            raise ValueError('New event evidence requires a reviewed linkage revision')
        lead = None
        if case['candidate_id']:
            candidate = candidates[case['candidate_id']]
            lead = {key: candidate[key] for key in ('candidate_id', 'name', 'address', 'street_name', 'venue_name')}
            lead.update({key: float(candidate[key]) for key in ('street_nearest_m', 'venue_nearest_m')})
            lead['venue_relation'] = checks[case['candidate_id']]['relation']
            lead['physical_identity'] = None
            lead['walkable_distance_m'] = None
            lead['usable_now'] = None
        rows.append({**case, 'source_last_stage': source['stages'][4] or None,
                     'event_time': None, 'verified_candidate_id': None,
                     'link_status': 'unverified', 'desk_lead': lead})
    return {'prepared_on': assessment['date'], 'status': assessment['status'],
            'source_personas': len(rows), 'verified_event_links': 0,
            'source_disposal_completed_accounts': sum(bool(row['source_last_stage']) for row in rows),
            'other_source_final_outcomes_unknown': sum(row['source_last_stage'] is None for row in rows),
            'proposed_desk_cases': sum(row['desk_lead'] is not None for row in rows),
            'observed_events': [], 'scheduled_visits': [], 'scenarios': rows}


if __name__ == '__main__':
    result = analyze()
    (HERE / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({key: value for key, value in result.items() if key != 'scenarios'}, ensure_ascii=False))

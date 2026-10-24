"""Validate and aggregate manual removal judgments; source text is never classified."""
import argparse
from collections import Counter
import csv
import hashlib
import html
import json
from pathlib import Path

FOLDER = 'feedback-removal-2026-10-18'
PRIVACY_NOTICE = '個別留言與可重建個人內容已因隱私移除。'
EFFECTS = {'E1': '找桶、繞路、攜帶', 'E2': '轉移亂丟', 'E3': '環境與健康困擾', 'E4': '具體活動受阻', 'E5': '替代場所承壓', 'E6': '泛稱不便', 'E7': '其他明述後果'}
REQUESTS = {'R1': '恢復、保留、停止撤除', 'R2': '增設、重配', 'R3': '清運、清潔、人力', 'R4': '防混投、管理、家戶分流', 'R5': '設備與設計', 'R6': '資訊、說明、政策評估', 'R7': '其他或泛稱改善', 'R8': '減少、限制、反對恢復'}
STATUSES = {'reported': '描述已發生變動', 'restore_only': '只要求恢復', 'anticipated': '預期或擔心撤除', 'unclear': '無法確定變動語意'}
ROLES = {'affected': '受影響／希望恢復', 'alternative': '替代投放', 'comparison': '比較案例', 'unclear': '關係未明'}
KINDS = {'station', 'park', 'road', 'intersection', 'neighborhood', 'district', 'city', 'other'}
FIELDS = {'r', 'places', 'time', 'status', 'effects', 'requests', 'meaning'}
AUDIT_FIELDS = ('places', 'time', 'status', 'effects', 'requests')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_annotations(path, expected):
    result = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if set(row) != FIELDS or type(row['r']) is not int or row['r'] not in expected or row['r'] in result:
            raise ValueError('Unexpected, duplicate or out-of-scope removal annotation')
        if row['status'] not in STATUSES or not isinstance(row['places'], list):
            raise ValueError('Invalid change status or places')
        if row['time'] is not None and (not isinstance(row['time'], str) or not row['time'].strip() or len(row['time']) > 150):
            raise ValueError('Invalid stated time')
        for place in row['places']:
            if (not isinstance(place, dict) or set(place) != {'name', 'kind', 'role'}
                    or not isinstance(place['name'], str) or not place['name'].strip()
                    or len(place['name']) > 100 or place['kind'] not in KINDS or place['role'] not in ROLES):
                raise ValueError('Invalid named place')
        if len({(p['name'], p['kind'], p['role']) for p in row['places']}) != len(row['places']):
            raise ValueError('Duplicate named-place judgment')
        for field, labels in [('effects', EFFECTS), ('requests', REQUESTS)]:
            values = row[field]
            if not isinstance(values, list) or any(not isinstance(v, str) or v not in labels for v in values) or values != sorted(set(values)):
                raise ValueError('Invalid removal labels')
        if 'E6' in row['effects'] and len(row['effects']) > 1:
            raise ValueError('General inconvenience cannot overlap a specific effect')
        if not isinstance(row['meaning'], str) or not row['meaning'].strip() or len(row['meaning']) > 300:
            raise ValueError('Missing individual meaning')
        result[row['r']] = row
    if set(result) != set(expected):
        raise ValueError('Incomplete removal annotation coverage')
    return result


def sample_rows(rows, selected, source_hash):
    result = []
    for district in dict.fromkeys(row[1] for row in rows):
        pool = [r for r in selected if rows[r - 1][1] == district]
        result.extend(sorted(pool, key=lambda r: hashlib.sha256(f'{source_hash}:removal-v1:{r}'.encode()).hexdigest())[:12])
    return sorted(result)


def equal_field(a, b, field):
    if field == 'places':
        return sorted((p['name'], p['kind'], p['role']) for p in a[field]) == sorted((p['name'], p['kind'], p['role']) for p in b[field])
    return a[field] == b[field]


def group(items):
    return {
        'selectedRecords': len(items),
        'statuses': {key: sum(x['status'] == key for x in items) for key in STATUSES},
        'effects': {key: sum(key in x['effects'] for x in items) for key in EFFECTS},
        'requests': {key: sum(key in x['requests'] for x in items) for key in REQUESTS},
        'noEffect': sum(not x['effects'] for x in items),
        'noRequest': sum(not x['requests'] for x in items),
        'namedPlace': sum(bool(x['places']) for x in items),
        'statedTime': sum(x['time'] is not None for x in items),
        'placeAndTime': sum(bool(x['places']) and x['time'] is not None for x in items),
    }


def summarize(rows, prior, initial, secondary, final, sample, decisions, assignments, comparisons):
    selected = set(final)
    if selected != {r for r, value in prior.items() if 'D3' in value['difficulties']} or set(initial) != selected or set(secondary) != set(sample):
        raise ValueError('Scope must exactly match the retained D3 cohort')
    disagreement = {r for r in sample if any(not equal_field(initial[r], secondary[r], key) for key in AUDIT_FIELDS)}
    changed = {r for r in selected if initial[r] != final[r]}
    decision_rows = [x['r'] for x in decisions]
    if len(set(decision_rows)) != len(decision_rows) or set(decision_rows) != disagreement | changed or any(not x.get('reason', '').strip() for x in decisions):
        raise ValueError('Every disagreement and correction needs one retained decision')
    catalog = {p['id']: p for p in comparisons['places']}
    expected_slots = {(r, i) for r, row in final.items() for i in range(len(row['places']))}
    actual_slots = [(a['r'], a['index']) for a in assignments]
    if len(set(actual_slots)) != len(actual_slots) or set(actual_slots) != expected_slots or any(a['placeId'] not in catalog or not a.get('reason', '').strip() for a in assignments):
        raise ValueError('Every named-place slot needs one manual reconciliation')
    members = {key: set() for key in catalog}
    role_members = {key: {role: set() for role in ROLES} for key in catalog}
    for a in assignments:
        r, i, key = a['r'], a['index'], a['placeId']
        members[key].add(r)
        role_members[key][final[r]['places'][i]['role']].add(r)
    if any(not rs for rs in members.values()):
        raise ValueError('Public catalog contains a place not mentioned in this cohort')
    places = [{'id': key, 'mentions': len(members[key]), 'roles': {role: len(rs) for role, rs in role_members[key].items()}, **group([final[r] for r in sorted(members[key])])} for key in catalog]
    districts = {district: group([final[r] for r in sorted(selected) if rows[r - 1][1] == district]) for district in dict.fromkeys(row[1] for row in rows)}
    return {
        'schemaVersion': 1, 'analysisDate': '2026-10-18', 'overall': group(list(final.values())), 'districts': districts, 'places': places,
        'audit': {'sampleSize': len(sample), 'initialAgreement': {key: sum(equal_field(initial[r], secondary[r], key) for r in sample) for key in AUDIT_FIELDS},
                  'disagreementRows': len(disagreement), 'adjudicatedRows': len(disagreement), 'changedRows': len(changed), 'decisionRecords': len(decisions)},
    }


def validate(data, prior):
    if data.get('privacyNotice') and data['privacyNotice'] != PRIVACY_NOTICE:
        raise ValueError('Unknown privacy redaction boundary')
    if not data['places'] and data['overall']['namedPlace'] and data.get('privacyNotice') != PRIVACY_NOTICE:
        raise ValueError('Withheld place evidence requires an explicit privacy boundary')
    if data['schemaVersion'] != 1 or set(data['districts']) != set(prior['districts']):
        raise ValueError('Removal summary scope changed')
    if data['source']['sourceSha256'] != prior['source']['sourceSha256'] or data['source']['accessFinalSha256'] != prior['source']['finalSha256']:
        raise ValueError('Removal summary belongs to different original or access labels')
    if data['overall']['selectedRecords'] != prior['overall']['difficulties']['D3']:
        raise ValueError('Overall D3 denominator changed')
    for district, g in data['districts'].items():
        if g['selectedRecords'] != prior['districts'][district]['difficulties']['D3']:
            raise ValueError('District D3 denominator changed')
    quality = ('selectedRecords', 'noEffect', 'noRequest', 'namedPlace', 'statedTime', 'placeAndTime')
    for g in [data['overall'], *data['districts'].values(), *data['places']]:
        n = g['selectedRecords']
        if type(n) is not int or n < 0:
            raise ValueError('Invalid removal denominator')
        for key in quality:
            if type(g[key]) is not int or not 0 <= g[key] <= n:
                raise ValueError('Invalid removal coverage count')
        for field, labels in [('statuses', STATUSES), ('effects', EFFECTS), ('requests', REQUESTS)]:
            if set(g[field]) != set(labels) or any(type(v) is not int or not 0 <= v <= n for v in g[field].values()):
                raise ValueError('Invalid removal group counts')
        if sum(g['statuses'].values()) != n or g['placeAndTime'] > min(g['namedPlace'], g['statedTime']):
            raise ValueError('Removal exclusive counts do not reconcile')
        for field, missing in [('effects', 'noEffect'), ('requests', 'noRequest')]:
            counts = list(g[field].values())
            if not max(counts, default=0) <= n - g[missing] <= sum(counts):
                raise ValueError('Invalid removal multi-label coverage')
        specific = [v for k, v in g['effects'].items() if k != 'E6']
        if not max(specific, default=0) <= n - g['noEffect'] - g['effects']['E6'] <= sum(specific):
            raise ValueError('General inconvenience overlaps specific effects')
    for key in quality:
        if sum(g[key] for g in data['districts'].values()) != data['overall'][key]:
            raise ValueError('Removal district totals do not reconcile')
    for field in ('statuses', 'effects', 'requests'):
        for key, value in data['overall'][field].items():
            if sum(g[field][key] for g in data['districts'].values()) != value:
                raise ValueError('Removal district labels do not reconcile')
    ids = [p['id'] for p in data['places']]
    if len(set(ids)) != len(ids):
        raise ValueError('Duplicate reconciled place')
    for p in data['places']:
        if p['mentions'] != p['selectedRecords'] or set(p['roles']) != set(ROLES) or any(type(v) is not int or not 0 <= v <= p['mentions'] for v in p['roles'].values()) or not max(p['roles'].values(), default=0) <= p['mentions'] <= sum(p['roles'].values()):
            raise ValueError('Invalid distinct-message place counts')
    audit = data['audit']; n = sum(min(12, g['selectedRecords']) for g in data['districts'].values())
    if audit['sampleSize'] != n or audit['adjudicatedRows'] != audit['disagreementRows'] or not 0 <= audit['disagreementRows'] <= n:
        raise ValueError('Incomplete removal audit')
    if set(audit['initialAgreement']) != set(AUDIT_FIELDS) or any(type(v) is not int or not 0 <= v <= n for v in audit['initialAgreement'].values()):
        raise ValueError('Invalid initial agreement evidence')
    if not 0 <= audit['changedRows'] <= data['overall']['selectedRecords'] or not max(audit['changedRows'], audit['disagreementRows']) <= audit['decisionRecords'] <= audit['changedRows'] + audit['disagreementRows']:
        raise ValueError('Invalid removal correction evidence')


def load(research, prior):
    folder = research / FOLDER
    data = json.loads((folder / 'summary.json').read_text())
    for key, path in [('protocolSha256', folder / 'protocol.md'), ('accessSummarySha256', research / 'feedback-access-2026-10-18/summary.json'), ('adjudicationNotesSha256', folder / 'adjudication.md'), ('comparisonsSha256', folder / 'comparisons.json'), ('sourceCheckSha256', folder / 'source-check.json')]:
        if digest(path) != data['source'][key]:
            raise ValueError('Retained removal evidence changed: ' + key)
    comparisons = json.loads((folder / 'comparisons.json').read_text())
    receipt = json.loads((folder / 'source-check.json').read_text())
    for item in receipt['sources']:
        path = folder / item['file']
        if digest(path) != item['sha256'] or path.stat().st_size != item['bytes']:
            raise ValueError('Fetched source differs from retained receipt')
    validate(data, prior)
    validate_comparisons(research, comparisons, data)
    return data, comparisons


def validate_comparisons(research, comparisons, data):
    if data.get('privacyNotice'):
        if comparisons.get('privacyNotice') != data['privacyNotice'] or any(comparisons.get(key) for key in ('places', 'examples', 'featuredPlaces')):
            raise ValueError('Privacy-redacted comparisons cannot retain individual or place-linked examples')
    if {p['id'] for p in comparisons['places']} != {p['id'] for p in data['places']} or len(comparisons['places']) != len(data['places']):
        raise ValueError('Place comparison coverage differs from semantic summary')
    sources = comparisons['sources']
    tables = {}
    for key, source in sources.items():
        path = research / source['path']
        if digest(path) != source['sha256']:
            raise ValueError('Inventory or removal source changed: ' + key)
        if source['format'] == 'csv':
            with path.open(encoding=source['encoding'], newline='') as stream:
                tables[key] = list(csv.reader(stream))[1:]
            if len(tables[key]) != source['rows']:
                raise ValueError('Inventory row count changed')
    event_ids = {e['id'] for e in comparisons['events']}
    if len(event_ids) != len(comparisons['events']):
        raise ValueError('Duplicate official record ID')
    for event in comparisons['events']:
        if event['source'] not in sources or sources[event['source']]['format'] != 'pdf' or type(event['page']) is not int or event['page'] < 1:
            raise ValueError('Invalid dated removal evidence')
    for place in comparisons['places']:
        if place['scale'] not in ('point', 'corridor', 'area', 'coarse', 'ambiguous') or not place['reading'].strip() or not place['nextCheck'].strip():
            raise ValueError('Missing scale or manual comparison reasoning')
        refs = [(ref['source'], ref['row']) for ref in place['inventoryRefs']]
        if len(set(refs)) != len(refs) or any(count > 3 for count in Counter(source for source, _ in refs).values()):
            raise ValueError('Duplicate or excessive illustrative candidates')
        for ref in place['inventoryRefs']:
            if ref['source'] not in tables or type(ref['row']) is not int or not 1 <= ref['row'] <= len(tables[ref['source']]):
                raise ValueError('Invalid inventory candidate row')
            if ref['values'] != tables[ref['source']][ref['row'] - 1]:
                raise ValueError('Candidate does not match the retained inventory row')
        if any(key not in event_ids for key in place['eventRefs']):
            raise ValueError('Unknown removal event reference')
        if place['eventMatch'] not in ('unresolved', 'confirmed'):
            raise ValueError('Invalid event-match judgment')
        if place['eventMatch'] == 'confirmed' and (not place['eventRefs'] or not place.get('eventMatchReason', '').strip()):
            raise ValueError('A confirmed event needs retained date and place reasoning')


def percent(value, n):
    return f'{100 * value / n:.1f}%' if n else '—'


def narrative(data):
    g = data['overall']; n = g['selectedRecords']
    return (f'重讀「撤除／變動」{n:,} 則後，{g["statuses"]["reported"]} 則描述已發生變動，'
            f'{g["statuses"]["restore_only"]} 則只要求恢復，{g["statuses"]["anticipated"]} 則是預期或擔心撤除，'
            f'{g["statuses"]["unclear"]} 則語意未明。這些是留言的說法，不是 {n} 次已確認撤除。')


def render(data, comparisons, heat_colors):
    esc = html.escape; g = data['overall']; n = g['selectedRecords']
    statistics = {p['id']: p for p in data['places']}
    sources = comparisons['sources']
    page = ['<section class="feedback-removal" aria-labelledby="feedback-removal">',
            '<h4 id="feedback-removal" tabindex="-1">撤除之後，投放困難去了哪裡？</h4>',
            f'<p class="feedback-removal-lead">{esc(narrative(data))}</p>',
            '<p>留言呈現三條查核路線：原本順路的桶變得難以使用、垃圾轉到街道或其他設施，以及恢復桶位與維護管理之間的取捨。下列後果包含經驗、推測與擔憂，尚未證實是撤桶造成。</p>',
            '<dl class="feedback-removal-facts">']
    facts = [(g['effects']['E1'], '找桶、繞路或攜帶', '有具體路線與投放困難'),
             (g['effects']['E2'], '垃圾轉移亂丟', '含已見到的現象與擔憂'),
             (g['requests']['R1'], '要求恢復或保留', '不等同所有人都主張增桶'),
             (g['noEffect'], '未明說撤除後果', '不能據此推成沒有影響')]
    for count, title, note in facts:
        page.append(f'<div><dt>{esc(title)}</dt><dd><strong>{count}</strong><span>／{n} 則 · {percent(count,n)}</span><small>{esc(note)}</small></dd></div>')
    page += ['</dl>', '<p id="feedback-removal-scope" class="feedback-note">以下分母固定為這 913 則；困難與訴求可複選，不能加總。原本七大類與六種困難的分類及分母保留。這份檔案是台北市意見回饋中篩出的垃圾訊息，收集日期與招募方式未知。</p>',
             '<div class="feedback-removal-charts">']
    md = ['# 撤除／變動回饋：地點、困難、改善方向與資料交叉比對', '',
          '分析整理日：2026-10-18；不是留言日期。', '', narrative(data), '',
          '分析母體固定為前輪 D3 的 913 則，不重算原始 2,663 則、A 類 1,737 則或 D3 標籤。這是篩選後的意見訊息，不是全市民意、已證實的撤除事件或人口發生率。各項後果保留敘述、推測、擔憂，不作因果推論。', '']
    for field, labels, title, missing in [('effects', EFFECTS, '他們說遇到什麼困難', 'noEffect'), ('requests', REQUESTS, '他們希望怎麼改善', 'noRequest')]:
        page += [f'<figure class="feedback-chart"><figcaption><strong>{title}</strong> · 則數／{n} 則；長度固定 0–100%</figcaption><ol>']
        md += [f'## {title}', '', '| 類別 | 則數 | 占913則 |', '| --- | ---: | ---: |']
        for code, label in labels.items():
            count = g[field][code]; share = percent(count,n)
            page.append(f'<li data-removal-count="{code}"><div class="feedback-bar-label"><strong>{esc(label)}</strong><span>{count} · {share}</span></div><div class="feedback-bar-track" aria-hidden="true"><span style="width:{share}"></span></div></li>')
            md.append(f'| {label} | {count} | {share} |')
        page.append(f'</ol><p class="feedback-note">未明說這組內容：{g[missing]} 則（{percent(g[missing],n)}）。</p></figure>')
        md += [f'| 未明說這組內容 | {g[missing]} | {percent(g[missing],n)} |', '']
    if data.get('privacyNotice'):
        notice = data['privacyNotice'] + ' 地點連結與逐則例子已撤下；以下只保留整體與行政區彙總，不代表原始資料沒有地點或例子。'
        page += ['</div>', f'<p class="feedback-note" data-feedback-privacy="redacted">{esc(notice)}</p>']
        md += ['## 隱私與保留範圍', '', notice, '']
        for event in comparisons['events']:
            source = sources[event['source']]
            page.append(f'<p><a href="{esc(source["url"],quote=True)}" target="_blank" rel="noopener noreferrer">{esc(event["title"])}</a> · 官方紀錄獨立保存，不與個別留言連結。</p>')
            md += [f'[{event["title"]}]({source["url"]}) · 官方紀錄獨立保存，不與個別留言連結。', '']
    else:
        page += ['</div>', '<details class="feedback-codebook"><summary>同樣說「撤桶」，需要的處理方式不同</summary>', '<dl class="feedback-removal-examples">']
        md += ['## 具體怎麼說，以及先查什麼', '', '以下是逐則回讀後的改寫，不是逐字引文。例子說明機制，不代表該地多數人的看法，也不把一則留言中的後果套到其所有地名。', '']
        for example in comparisons['examples']:
            page.append(f'<div><dt>{esc(example["title"])}</dt><dd><p>{esc(example["account"])}</p><p><strong>對應查核：</strong>{esc(example["action"])}</p></dd></div>')
            md += [f'### {example["title"]}', '', example['account'], '', '對應查核（尚未執行）：' + example['action'], '']
        page += ['</dl></details>', '<details class="feedback-codebook"><summary>查看地點與官方紀錄的交叉比對</summary><h5 id="feedback-removal-evidence" tabindex="-1">現有清冊能對上地點，還不能對上同一次撤除</h5>',
                 f'<p>{g["namedPlace"]} 則含命名地點，但包含「台北市」等大範圍、外地比較與無關參照。{g["statedTime"]} 則有時間線索，多為相對時間、任期或事件期間；其中 {g["placeAndTime"]} 則同時有地名與時間，也不一定能定位到一個桶。留言收集日未知，不能把「今年」直接換成 2026 年。</p>',
                 '<p>本次重新取得的街頭清冊有 681 列，場域清單有 130 筆，與先前保存版本相同；街頭列、場所紀錄及歷史列分開比對。地圖上的場所標記仍只表示查核入口。</p>']
        md += ['## 地點與時間的可比程度', '', f'含命名地點 {g["namedPlace"]} 則；有時間線索 {g["statedTime"]} 則；兩者皆有 {g["placeAndTime"]} 則。地名可能是全市、全區、替代投放處、比較案例或無關參照。相對日期不能以分析日錨定。', '',
               '本次重新取得街頭681列與場域130筆，內容指紋與既有保存版相同。2024快照1971列只作歷史候選，不是撤除清單。各類別與日期不同，不相減為已撤除數量。', '']
        for event in comparisons['events']:
            src = sources[event['source']]
            page.append(f'<div class="feedback-removal-record"><h6>{esc(event["title"])}</h6><p>{esc(event["account"])}</p><p class="feedback-note">{esc(event["limit"])}</p><a href="{esc(src["url"],quote=True)}" target="_blank" rel="noopener noreferrer">官方會議原件 · 第 {event["page"]} 頁</a></div>')
            md += [f'### {event["title"]}', '', event['account'], '', event['limit'], '', f'[官方原件，第{event["page"]}頁]({src["url"]})；[保存檔]({src["path"].removeprefix(FOLDER+"/")})。', '']
        for context in comparisons.get('context', []):
            source = sources[context['source']]
            page.append(f'<p>{esc(context["text"])} <a href="{esc(source["url"],quote=True)}" target="_blank" rel="noopener noreferrer">{esc(context["label"])}</a></p>')
            md += [context['text'] + f' [{context["label"]}]({source["url"]})', '']
        unresolved = sum(p['eventMatch'] == 'unresolved' for p in comparisons['places'])
        confirmed = len(comparisons['places']) - unresolved
        page += [f'<p class="feedback-check"><strong>本輪可核實的界線：</strong>人工整理 {len(comparisons["places"])} 組地名後，{confirmed} 組能與已取得的官方紀錄連結為同一次撤除。其餘 {unresolved} 組仍待確認。已有桶位紀錄不會推翻未定日期的留言，沒有清冊列也不能證明現場無桶。</p>',
                 '<p>下表每來源至多列三個人工核對的代表候選，不是該地的全部桶數。道路或公園同名，只支持查核同一範圍；尤其要分辨站內外、公園內外及實際步行路線。場所清單中的數字與街頭列不能相加。</p><p>「留言中的困難與訴求」列出提及該地的留言中最多三類；一則可提多地，這些類別不自動歸因於該地，仍須回查原述關係。</p>']
        md += [f'人工整理 {len(comparisons["places"])} 組地名；同一次官方撤除事件連結 {confirmed} 組，待確認 {unresolved} 組。這不表示沒有撤除，只表示目前沒有足夠時空證據把這些留言與已取得事件相接。', '',
               '各地困難與訴求列提及該地留言的前三類；一則可提多地，不能將整則後果套到每一地點。每來源最多列三個代表候選，均經人工閱讀，不是地區桶位總量；同名道路、公園、車站不等於同一桶。角色分開，alternative 同時涵蓋轉往設施或不當丟棄處，不是合法投放建議。', '']

        def place_table(places, title):
            block = [f'<div class="feedback-removal-scroll" role="region" aria-label="{esc(title)}，可左右捲動" tabindex="0"><table class="feedback-removal-table"><caption>{esc(title)} · 提及數以不同留言計，一則可含多地</caption><thead><tr><th scope="col">地點與角色</th><th scope="col">留言中的困難與訴求</th><th scope="col">現有／歷史候選</th><th scope="col">可以怎麼讀</th><th scope="col">下一步查核</th></tr></thead><tbody>']
            lines = [f'### {title}', '', '| 地點與角色 | 提及該地留言的前三類困難與訴求 | 現有／歷史代表候選 | 判讀 | 下一步查核 |', '| --- | --- | --- | --- | --- |']
            for place in places:
                stats = statistics[place['id']]
                roles = '；'.join(f'{ROLES[key]} {count}' for key,count in stats['roles'].items() if count)
                themes = []
                for field, labels, title, missing in [('effects', EFFECTS, '困難', 'noEffect'), ('requests', REQUESTS, '訴求', 'noRequest')]:
                    top = sorted(((key, value) for key, value in stats[field].items() if value), key=lambda pair: (-pair[1], pair[0]))[:3]
                    listed = '、'.join(f'{labels[key]} {value}則' for key,value in top) or '未標到具體類別'
                    themes.append(f'{title}：{listed}；未明說 {stats[missing]}／{stats["mentions"]}則')
                theme_text = '。'.join(themes)
                refs = []
                for ref in place['inventoryRefs']:
                    label = {'street':'街頭2026-09-30', 'venue':'場域2026-08-18', 'history2024':'歷史2024-10-18'}[ref['source']]
                    refs.append(f'{label} 第{ref["row"]}列：{ref["values"][1]}')
                reference = '；'.join(refs) if refs else '本輪未列可支持的點位候選；不是現場無桶的證明。'
                block.append(f'<tr data-removal-place="{place["id"]}"><th scope="row">{esc(place["label"])}<small>{stats["mentions"]} 則 · {esc(roles)}</small></th><td>{esc(theme_text)}</td><td>{esc(reference)}</td><td>{esc(place["reading"])}</td><td>{esc(place["nextCheck"])}</td></tr>')
                lines.append('| ' + ' | '.join(value.replace('|','／').replace('\n',' ') for value in [f'{place["label"]}（{stats["mentions"]}則；{roles}）',theme_text,reference,place['reading'],place['nextCheck']]) + ' |')
            block.append('</tbody></table></div>')
            return '\n'.join(block), lines

        featured = set(comparisons['featuredPlaces'])
        table, lines = place_table([p for p in comparisons['places'] if p['id'] in featured], '先看幾個能說明差異的地點')
        page += [table, '<details class="feedback-codebook"><summary>完整地名對照：包含大範圍、替代處、比較及無法定位的線索</summary>']
        md += lines + ['']
        table, lines = place_table([p for p in comparisons['places'] if p['id'] not in featured], '其餘地名與待確認線索')
        page += [table, '</details></details>']; md += lines + ['']
    page += ['<details class="feedback-codebook"><summary>十二區的困難與訴求組成：區內「撤除／變動」留言為分母</summary>',
             '<p>行政區沿用原檔標籤，未確認為事件所在地。這裡比較同一子群的組成，不是撤除率、缺桶排名或因果差異。顏色固定 0–100%；0 表示本次未標到，空白資訊仍留在分母。</p>']
    for field, labels, title in [('effects', EFFECTS, '撤除後困難'), ('requests', REQUESTS, '改善訴求')]:
        page += [f'<div class="feedback-access-scroll" role="region" aria-label="十二區{title}，可左右捲動" tabindex="0"><table class="feedback-access-table" data-removal-table="{field}"><caption>十二區{title} · 區內D3留言占比／則數</caption><thead><tr><th scope="col">行政區<br>D3則數</th>']
        page.extend(f'<th scope="col">{esc(label)}</th>' for label in labels.values()); page += ['</tr></thead><tbody>']
        md += [f'## 十二區{title}', '', '| 行政區（D3則數） | ' + ' | '.join(labels.values()) + ' |', '| --- | '+' | '.join(['---:']*len(labels))+' |']
        for district, values in data['districts'].items():
            count = values['selectedRecords']; cells=[]
            page.append(f'<tr><th scope="row">{esc(district)}<small>{count} 則</small></th>')
            for key in labels:
                value=values[field][key]; share=percent(value,count); color,ink=heat_colors(value/count) if count else ('#f2f6f7','#000000')
                page.append(f'<td data-district="{esc(district)}" data-code="{key}" style="--heat-bg:{color};--heat-ink:{ink}"><strong>{share}</strong><span>{value}／{count} 則</span></td>')
                cells.append(f'{value}（{share}）')
            page.append('</tr>');md.append(f'| {district}（{count}） | '+' | '.join(cells)+' |')
        page += ['</tbody></table></div>'];md.append('')
    coverage = '；'.join(f'{d}：{v["noEffect"]}／{v["noRequest"]}' for d,v in data['districts'].items())
    page += [f'<p class="feedback-note">各區未明說困難／未明說訴求則數：{esc(coverage)}。</p>', '</details>',
             '<h5>下一步：先補撤除前後的服務路線</h5>', '<ol class="feedback-check-steps">']
    md += ['各區未明說困難／訴求則數：'+coverage+'。', '', '## 下一步與目前缺口', '']
    for action in comparisons['nextSteps']:
        page.append(f'<li><strong>{esc(action["title"])}</strong><p>{esc(action["text"])}</p></li>')
        md.append('- **'+action['title']+'**：'+action['text'])
    page += ['</ol>']
    a = data['audit']
    agreement = '、'.join(f'{label} {a["initialAgreement"][key]}/{a["sampleSize"]}' for key,label in [('places','地點'),('time','時間'),('status','變動語意'),('effects','困難整組'),('requests','訴求整組')])
    method = (f'三個子代理逐則閱讀全部 {n} 則，不使用關鍵字分類。每區抽12則，共{a["sampleSize"]}則，由另一代理盲讀。'
              f'裁決前完全一致：{agreement}；{a["disagreementRows"]}則有分歧，已全部回讀裁決。另回查具體地名與時間線索，'
              f'合計保留{a["decisionRecords"]}筆裁決理由、{a["changedRows"]}則最終標註異於初判。這是初判一致性，不是正確率；沒有全量獨立雙編。')
    if data.get('privacyNotice'):
        method = '歷史彙總記載：' + method.replace('合計保留', '當時記錄') + ' 本清理版不保留逐則裁決理由。'
    retention = ('本清理版不保存原文、逐則標註、盲讀、裁決或地點改寫。只保留原有彙總與獨立官方來源，不能由本包重做逐則語意稽核。'
                 if data.get('privacyNotice') else '原文、逐則標註、盲讀與裁決留在本地私有分析目錄。公開頁面僅有彙總與地點改寫。')
    page += ['<details class="feedback-codebook"><summary>閱讀規則、完整性與抽樣查核</summary>', f'<p>{esc(method)}</p>',
             '<p>只有要求恢復，不自行當作已發生撤除；只提到用途，不自動當作使用受阻；家戶垃圾、鼠患與其他城市議題，未明說與撤桶相連便不當後果。泛稱不便不與具體困難重複。地點名稱由人工歸併；程式只檢查、加總與排版。</p>',
             f'<p>{esc(retention)} 資料仍缺留言日期、核實舊桶位置、管理機關、撤移工單及前後使用觀察；來源清冊也未證實完整。</p>',
             '</details><p><a href="#feedback-access">回到六種困難</a> · <a href="#map">看街頭桶位與場域線索地圖</a></p></section>']
    md += ['', '## 方法、稽核與限制', '', method, '',
           '有時間或地點不等於可定位事件。只有恢復要求不自行視為已發生撤除；用途與目的不自動當已發生困難。泛稱不便與具體困難互斥。比較、來源、影響位置及垃圾轉移處不能混用。', '',
           '[凍結規約](protocol.md)、[裁決與事後邊界](adjudication.md)、[彙總](summary.json)、[人工來源比對](comparisons.json)、[來源取得收據](source-check.json)、[額外定向檢索紀錄](source-search.md)。', '',
           '## 頁面重建與私有重算的界線', '', '公開版本與離線研究包只支援從已保存彙總重建頁面，無法單獨重做或獨立稽核逐則語意分析。原文、逐則判斷及裁決已封存在資料持有人的本地私有檔案；尚未建立其他維護者可取用的遠端備份。指紋僅供持有原檔者核對，不能取代輸入。', '', '一般頁面重建在網站目錄執行 `python scripts/package-research.py`。只有持有完整私有封存資料並解壓後，才可執行下列分析重算；`/private/removal-coding` 是待替換的示例路徑：', '',
           '```sh', 'python scripts/feedback_removal.py --private-dir /private/removal-coding', 'python scripts/package-research.py', '```', '',
           '一般建置只讀取保存的彙總與人工比對，不需要公開原文或重跑語意判讀。', '', '## 來源指紋', '', *[f'- {key}: `{value}`' for key,value in data['source'].items()]]
    if data.get('privacyNotice'):
        start = md.index('## 頁面重建與私有重算的界線')
        end = md.index('## 來源指紋', start)
        md[start:end] = ['## 清理版重建與可重現範圍', '', retention, '',
                         '在網站目錄執行 `python scripts/package-research.py`，可從保存彙總重建頁面與離線包。這不會恢復已移除的逐則內容。先前來源指紋只記錄歷史身分，不代表原始內容可取回。', '']
    return '\n'.join(page), '\n'.join(md)


def home(data):
    g=data['overall']
    return ('<div class="home-access-reading"><h4>撤除回饋指向「原來順路的投放點」</h4>'
            f'<p>細讀913則撤除／變動留言，{g["effects"]["E1"]}則提到找桶、繞路或攜帶，{g["effects"]["E2"]}則描述或擔心垃圾轉移亂丟，'
            f'{g["requests"]["R1"]}則要求恢復或保留。另有{g["noEffect"]}則未明說後果。</p>'
            '<p>現有街頭與場域清冊提供地點線索，仍缺留言日期和逐點撤移紀錄。先查外圍與內部、站外與站內、替代路線及維護負荷，再判斷恢復、重配或加強清運。</p>'
            '<a href="#feedback-removal">看困難、改善訴求與獨立官方紀錄</a></div>')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--private-dir', type=Path, required=True)
    parser.add_argument('--research-root', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    canonical = root.parent.parent / 'topics/bins/research'
    research = args.research_root or (canonical if canonical.is_dir() else root / 'research')
    folder = research / FOLDER; private = args.private_dir
    manifest = json.loads((private / 'manifest.json').read_text())
    inputs = private / 'retained-inputs'
    prior_path = research / 'feedback-access-2026-10-18/summary.json'
    prior_summary = json.loads(prior_path.read_text())
    source_path = inputs / 'source.tsv'; prior_labels = inputs / 'access-final.jsonl'
    for key, path in [('sourceSha256', source_path), ('accessFinalSha256', prior_labels), ('accessSummarySha256', prior_path), ('protocolSha256', folder / 'protocol.md')]:
        if digest(path) != manifest[key]:
            raise ValueError('Frozen removal input changed: ' + key)
    with source_path.open(encoding='utf-8-sig', newline='') as stream:
        parsed = list(csv.reader(stream, delimiter='\t', strict=True))
    if parsed[0] != ['匿名編號', '行政區', '原議題', '心情', '去識別內容'] or any(len(row) != 5 for row in parsed[1:]):
        raise ValueError('Invalid feedback source shape')
    rows = parsed[1:]
    prior_list = [json.loads(line) for line in prior_labels.read_text().splitlines() if line.strip()]
    prior = {row['r']: row for row in prior_list}
    if len(prior_list) != len(prior) or any(r < 1 or r > len(rows) for r in prior):
        raise ValueError('Invalid retained access labels')
    selected = sorted(r for r, value in prior.items() if 'D3' in value['difficulties'])
    sample = sample_rows(rows, selected, manifest['sourceSha256'])
    if selected != manifest['selectedRows'] or sample != manifest['sampleRows']:
        raise ValueError('Frozen cohort or sample changed')
    if any(manifest['primaryOwners'][str(r)] == manifest['secondaryOwners'][str(r)] for r in sample):
        raise ValueError('Removal blind audit must use a different coder')
    paths = {key: private / (key + '.jsonl') for key in ('initial', 'secondary', 'final')}
    initial = read_annotations(paths['initial'], selected); secondary = read_annotations(paths['secondary'], sample); final = read_annotations(paths['final'], selected)
    decisions_path = private / 'decisions.json'; assignments_path = private / 'place-assignments.json'
    comparisons_path = folder / 'comparisons.json'
    comparisons = json.loads(comparisons_path.read_text())
    data = summarize(rows, prior, initial, secondary, final, sample, json.loads(decisions_path.read_text()), json.loads(assignments_path.read_text()), comparisons)
    data['source'] = {key: digest(path) for key, path in [
        ('sourceSha256', source_path), ('accessFinalSha256', prior_labels), ('accessSummarySha256', prior_path), ('protocolSha256', folder / 'protocol.md'),
        ('initialSha256', paths['initial']), ('secondarySha256', paths['secondary']), ('finalSha256', paths['final']), ('manifestSha256', private / 'manifest.json'),
        ('decisionsSha256', decisions_path), ('placeAssignmentsSha256', assignments_path), ('comparisonsSha256', comparisons_path),
        ('adjudicationNotesSha256', folder / 'adjudication.md'), ('sourceCheckSha256', folder / 'source-check.json')]}
    validate(data, prior_summary); validate_comparisons(research, comparisons, data)
    (folder / 'summary.json').write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
    print(f'Aggregated {len(final)} manually authored removal judgments, {len(sample)} blind audit rows')


if __name__ == '__main__':
    main()

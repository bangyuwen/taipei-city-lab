"""Aggregate retained, manually authored access judgments; never classify source text."""
import argparse
from collections import Counter
import csv
import hashlib
import html
import json
from pathlib import Path

FOLDER = 'feedback-access-2026-10-18'
DIFFICULTIES = {
    'D1': '泛稱不足／增設', 'D2': '難找／距離遠', 'D3': '撤除／變動',
    'D4': '分布不相稱', 'D5': '滿溢／容量耗盡', 'D6': '投放設計難用',
}
CONTEXTS = {
    'X1': '通勤與交通', 'X2': '飲食、購物與觀光', 'X3': '公園、河濱與休閒',
    'X4': '遛狗與寵物', 'X5': '親子、照護與校園', 'X6': '活動與市集', 'X7': '家戶與工作投放',
}
STANCES = {
    'more': '增設／恢復／保留', 'less': '減少／撤除／反對', 'conditional': '附條件支持',
    'mixed': '混合／權衡', 'unspecified': '方向未明', 'none': '未表達公共桶立場',
}
CHECKS = {
    'D1': '先補問位置、時段與要投放的垃圾，再確認具體障礙。',
    'D2': '沿實際步行路線查桶距、可見性、繞路及替代點能否使用。',
    'D3': '核對點位變動的時間、原因、替代位置與告知方式。',
    'D4': '對照實際人流、用途及配置規則，確認是否集中或錯置。',
    'D5': '同點觀察尖峰桶況、容量、巡收間隔及混投來源。',
    'D6': '現場檢查開口、擋板、觸碰及操作障礙，再比較設計調整。',
}
FIELDS = {'r', 'difficulties', 'contexts', 'stance', 'clarity', 'meaning'}
AUDIT_FIELDS = ('difficulties', 'contexts', 'stance', 'clarity')


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_annotations(path, expected):
    result = {}
    for line in path.read_text().splitlines():
        if not line.strip():
            continue
        row = json.loads(line)
        if set(row) != FIELDS or type(row['r']) is not int or row['r'] not in expected or row['r'] in result:
            raise ValueError('Unexpected, duplicate or out-of-scope annotation')
        for field, labels in [('difficulties', DIFFICULTIES), ('contexts', CONTEXTS)]:
            values = row[field]
            if not isinstance(values, list) or any(not isinstance(v, str) or v not in labels for v in values) or values != sorted(set(values)):
                raise ValueError('Invalid semantic labels')
        if 'D1' in row['difficulties'] and len(row['difficulties']) > 1:
            raise ValueError('General insufficiency must not duplicate a specific difficulty')
        if row['stance'] not in STANCES or row['clarity'] not in ('clear', 'unclear'):
            raise ValueError('Invalid stance or clarity')
        if not isinstance(row['meaning'], str) or not row['meaning'].strip() or len(row['meaning']) > 300:
            raise ValueError('Missing individual semantic meaning')
        result[row['r']] = row
    if set(result) != set(expected):
        raise ValueError('Incomplete annotation coverage')
    return result


def sample_rows(rows, selected, source_hash):
    districts = dict.fromkeys(row[1] for row in rows)
    result = []
    for district in districts:
        pool = [r for r in selected if rows[r - 1][1] == district]
        result.extend(sorted(pool, key=lambda r: hashlib.sha256(f'{source_hash}:access-v1:{r}'.encode()).hexdigest())[:12])
    return sorted(result)


def summarize(rows, prior, initial, secondary, final, sample, decisions):
    selected = set(final)
    if selected != {r for r, value in prior.items() if 'A' in value['themes']} or set(initial) != selected or set(secondary) != set(sample):
        raise ValueError('The detail scope must exactly match the prior A scope')
    disagreement = {r for r in sample if any(initial[r][key] != secondary[r][key] for key in AUDIT_FIELDS)}
    changed = {r for r in selected if initial[r] != final[r]}
    decision_rows = [x['r'] for x in decisions]
    if len(set(decision_rows)) != len(decision_rows) or set(decision_rows) != disagreement | changed or any(not x.get('reason', '').strip() for x in decisions):
        raise ValueError('Every disagreement and correction needs one retained decision')

    def group(ordinals):
        items = [final[r] for r in ordinals]
        return {
            'selectedRecords': len(items),
            'difficulties': {key: sum(key in x['difficulties'] for x in items) for key in DIFFICULTIES},
            'contexts': {key: sum(key in x['contexts'] for x in items) for key in CONTEXTS},
            'stances': {key: sum(x['stance'] == key for x in items) for key in STANCES},
            'noDifficulty': sum(not x['difficulties'] for x in items),
            'noContext': sum(not x['contexts'] for x in items),
            'unclear': sum(x['clarity'] == 'unclear' for x in items),
            'priorStanceChanged': sum(final[r]['stance'] != prior[r]['stance'] for r in ordinals),
        }

    districts = {}
    for district, total in Counter(row[1] for row in rows).items():
        members = sorted(r for r in selected if rows[r - 1][1] == district)
        districts[district] = {'allRecords': total, **group(members)}
    return {
        'schemaVersion': 1, 'analysisDate': '2026-10-18', 'allRecords': len(rows),
        'overall': group(sorted(selected)), 'districts': districts,
        'audit': {
            'sampleSize': len(sample),
            'initialAgreement': {key: sum(initial[r][key] == secondary[r][key] for r in sample) for key in AUDIT_FIELDS},
            'disagreementRows': len(disagreement), 'adjudicatedRows': len(disagreement),
            'changedRows': len(changed), 'decisionRecords': len(decisions),
        },
    }


def validate(data, prior):
    if data['schemaVersion'] != 1 or data['allRecords'] != prior['records'] or set(data['districts']) != set(prior['districts']):
        raise ValueError('Detail summary does not match the full feedback scope')
    if data['source']['sourceSha256'] != prior['source']['sha256'] or data['source']['priorAnnotationSha256'] != prior['semantic']['annotationSha256']:
        raise ValueError('Detail summary belongs to different source annotations')
    for district, group in data['districts'].items():
        if group['allRecords'] != prior['districts'][district] or group['selectedRecords'] != prior['districtAnalysis'][district]['themes']['A']:
            raise ValueError('District denominators differ from retained A scope')
    for group in [data['overall'], *data['districts'].values()]:
        n = group['selectedRecords']
        if type(n) is not int or n < 0:
            raise ValueError('Invalid selected denominator')
        for field, labels in [('difficulties', DIFFICULTIES), ('contexts', CONTEXTS), ('stances', STANCES)]:
            if set(group[field]) != set(labels) or any(type(v) is not int or not 0 <= v <= n for v in group[field].values()):
                raise ValueError('Count outside selected denominator')
        for key in ('noDifficulty', 'noContext', 'unclear', 'priorStanceChanged'):
            if type(group[key]) is not int or not 0 <= group[key] <= n:
                raise ValueError('Invalid classification quality count')
        if sum(group['stances'].values()) != n:
            raise ValueError('Exclusive stances do not reconcile')
        for field, missing in [('difficulties', 'noDifficulty'), ('contexts', 'noContext')]:
            counts = group[field].values()
            if not max(counts) <= n - group[missing] <= sum(counts):
                raise ValueError('Invalid multilabel coverage')
        specific = [group['difficulties'][k] for k in DIFFICULTIES if k != 'D1']
        remaining = n - group['noDifficulty'] - group['difficulties']['D1']
        if not max(specific) <= remaining <= sum(specific):
            raise ValueError('General and specific difficulty coverage overlaps')
    total = data['overall']
    for field in ('difficulties', 'contexts', 'stances'):
        for key, value in total[field].items():
            if sum(g[field][key] for g in data['districts'].values()) != value:
                raise ValueError('Detail columns do not reconcile')
    for key in ('selectedRecords', 'noDifficulty', 'noContext', 'unclear', 'priorStanceChanged'):
        if sum(g[key] for g in data['districts'].values()) != total[key]:
            raise ValueError('Detail quality totals do not reconcile')
    audit = data['audit']
    expected_sample = sum(min(12, g['selectedRecords']) for g in data['districts'].values())
    if audit['sampleSize'] != expected_sample or audit['adjudicatedRows'] != audit['disagreementRows'] or not 0 <= audit['disagreementRows'] <= expected_sample:
        raise ValueError('Incomplete blind sample adjudication')
    if set(audit['initialAgreement']) != set(AUDIT_FIELDS) or any(type(v) is not int or not 0 <= v <= expected_sample for v in audit['initialAgreement'].values()):
        raise ValueError('Invalid blind agreement evidence')
    if not 0 <= audit['changedRows'] <= total['selectedRecords'] or not max(audit['changedRows'], audit['disagreementRows']) <= audit['decisionRecords'] <= audit['changedRows'] + audit['disagreementRows']:
        raise ValueError('Invalid correction evidence')


def load(research, prior):
    folder = research / FOLDER
    data = json.loads((folder / 'summary.json').read_text())
    if digest(folder / 'protocol.md') != data['source']['protocolSha256'] or digest(research / 'feedback-2026-10-17/summary.json') != data['source']['priorSummarySha256']:
        raise ValueError('Detail protocol or prior summary changed')
    if digest(folder / 'adjudication.md') != data['source']['adjudicationNotesSha256']:
        raise ValueError('Detail adjudication notes changed')
    validate(data, prior)
    return data


def percent(value, n):
    return f'{100 * value / n:.1f}%' if n else '—'


def leaders(counts):
    positive = [key for key, value in counts.items() if value > 0]
    return [key for key in positive if counts[key] == max(counts.values())] if positive else []


def district_reading(group):
    n = group['selectedRecords']
    general = group['difficulties']['D1']
    specific = {key: value for key, value in group['difficulties'].items() if key != 'D1'}
    top = leaders(specific)
    detail = '、'.join(f'{DIFFICULTIES[k]} {specific[k]} 則（{percent(specific[k], n)}）' for k in top)
    reading = f'泛稱不足／增設 {general} 則（{percent(general, n)}）；' + (f'具體困難以{detail}最多。' if top else '本次未標到其他具體困難。')
    action = ' '.join(CHECKS[k] for k in top) if top else CHECKS['D1']
    context_top = leaders(group['contexts'])
    context = '、'.join(f'{CONTEXTS[k]} {group["contexts"][k]} 則' for k in context_top) if context_top else '未標到所列使用情境'
    return reading, context, action


def shared_pattern(data):
    common = set(DIFFICULTIES) - {'D1'}
    for group in data['districts'].values():
        common &= set(leaders({key: count for key, count in group['difficulties'].items() if key != 'D1'}))
    if not common:
        return '各區差異應連同其他困難與明示情境閱讀，不能簡化為單一主因。'
    names = '、'.join(DIFFICULTIES[key] for key in DIFFICULTIES if key in common)
    return (f'{len(data["districts"])} 區最多的具體困難都包含「{names}」。'
            '各區差異需再看其他困難與明示情境的組合，不能解讀成每區各有一個完全不同的主因。')


def narrative(data):
    group = data['overall']; n = group['selectedRecords']
    concrete = n - group['noDifficulty'] - group['difficulties']['D1']
    return (f'在 {n:,} 則桶位相關留言中，{group["difficulties"]["D1"]:,} 則只泛稱不足或要求增設，'
            f'{concrete:,} 則提到至少一種具體困難，另有 {group["noDifficulty"]:,} 則未能標入這六類。'
            '三者不重疊；具體困難之間仍可複選。未標入不表示沒有問題，也包含反對、討論或資訊不足的內容。' + shared_pattern(data))


def render(data, heat_colors):
    esc = html.escape
    total = data['overall']['selectedRecords']
    description = (f'這次逐則細標原先「桶位與投放便利」的 {total:,} 則。分母改為各區這一類的全部留言，'
                   '包含反對、未表態、未標到六類與資訊不足的內容；不是上方七大類表使用的各區全部留言。'
                   '困難與情境可複選，比例不能相加；D1「泛稱不足」僅在未標到其他具體困難時使用。')
    page = ['<section class="feedback-access" aria-labelledby="feedback-access"><h4 id="feedback-access" tabindex="-1">垃圾桶「不夠」：十二區的六種困難</h4>',
            f'<p>{esc(narrative(data))}</p><p id="feedback-access-scope">{esc(description)}</p>',
            '<p class="feedback-note">色階仍固定 0–100%。顏色是這批桶位留言的組成，不是缺桶程度或嚴重性；0% 是本次未標到。原文描述或擔憂尚未現勘核實，行政區標記與事件地點、日期也未確認。</p>']
    md = ['# 桶位回饋細分：六種困難、使用情境與立場', '', '整理日：2026-10-18；非留言收集日期。', '', narrative(data), '', description, '',
          '原文、逐則標註與回查資訊留在本地；網頁只呈現彙總與改寫。行政區不是已核實的事件地點，結果不是人口發生率或實際缺桶排名。', '']

    def matrix(field, labels, key, title):
        block = [f'<div class="feedback-access-scroll" role="region" aria-label="{esc(title)}，可左右捲動" tabindex="0" aria-describedby="feedback-access-scope"><table class="feedback-access-table" data-access-table="{key}"><caption>{esc(title)} · 每格：區內桶位留言占比／則數</caption><thead><tr><th scope="col">行政區<br>細標／全部留言</th>']
        block.extend(f'<th scope="col">{esc(label)}</th>' for label in labels.values())
        block.append('</tr></thead><tbody>')
        table_md = [f'## {title}', '', '| 行政區（細標／全部） | ' + ' | '.join(labels.values()) + ' |', '| --- | ' + ' | '.join(['---:'] * len(labels)) + ' |']
        for index, (district, group) in enumerate(data['districts'].items(), 1):
            n = group['selectedRecords']
            block.append(f'<tr><th scope="row"><a href="#feedback-access-district-{index}">{esc(district)}</a><small>{n}／{group["allRecords"]} 則</small></th>')
            values = []
            for code in labels:
                count = group[field][code]; share = percent(count, n)
                color, ink = heat_colors(count / n) if n else ('#f2f6f7', '#000000')
                block.append(f'<td data-district="{esc(district)}" data-code="{code}" style="--heat-bg:{color};--heat-ink:{ink}"><strong>{share}</strong><span>{count}／{n} 則</span></td>')
                values.append(f'{count}（{share}）')
            block.append('</tr>')
            table_md.append(f'| {district}（{n}／{group["allRecords"]}） | ' + ' | '.join(values) + ' |')
        block.append('</tbody></table></div>')
        return '\n'.join(block), table_md

    table, table_md = matrix('difficulties', DIFFICULTIES, 'difficulties', '六種困難：各區桶位相關留言為分母')
    page += ['<p class="feedback-scroll-hint">手機可左右捲動，區名固定；聚焦表格後可用方向鍵。點區名看下方細分類判讀。</p>', table]
    md += table_md
    page += ['<details class="feedback-codebook"><summary>對照使用情境與立場：十二區完整數據</summary>',
             f'<p>情境只標原文明說的部分。家戶與工作投放表示明確的收運需求，不因提到家戶混投就標記。立場為本次重新判讀，互斥且合計等於細標則數；與前次同範圍有 {data["overall"]["priorStanceChanged"]} 則不同，不與前次全檔立場合併。</p>']
    for field, labels, title in [('contexts', CONTEXTS, '使用情境'), ('stances', STANCES, '本次重讀的公共桶立場')]:
        table, table_md = matrix(field, labels, field, title)
        page.append(table); md += ['', *table_md]
    page += ['</details>', '<h5 id="feedback-access-readings" tabindex="-1">各區怎麼讀，下一步查什麼</h5>',
             '<p>以下列出每區則數最多的具體困難（不含泛稱不足，同數並列）與最常提及的明示情境；是描述性摘要，不是改善優先序。查核建議尚未執行。</p>', '<dl class="feedback-access-readings">']
    md += ['', '## 各區判讀與查核方向', '', '具體困難與情境取區內最高則數，同數並列；不是顯著差異或改善優先序。', '', '| 區 | 困難判讀 | 明示情境 | 下一步（待驗證） |', '| --- | --- | --- | --- |']
    for index, (district, group) in enumerate(data['districts'].items(), 1):
        reading, context, action = district_reading(group)
        page += [f'<div><dt id="feedback-access-district-{index}" tabindex="-1">{esc(district)}</dt><dd><p>{esc(reading)}</p><p><strong>明示情境：</strong>{esc(context)}。未標所列情境 {group["noContext"]} 則；未標六類困難 {group["noDifficulty"]} 則；資訊不明 {group["unclear"]} 則。</p><p><strong>先查：</strong>{esc(action)}</p><a href="#feedback-access">回到六種困難比較表</a> · <a href="#feedback-district-{index}">接著看街頭與場域資料</a></dd></div>']
        md.append(f'| {district} | {reading} | {context} | {action} |')
    page.append('</dl>')
    audit = data['audit']; group = data['overall']
    method = (f'三個子代理逐則閱讀 {total:,} 則，不使用關鍵字分類。每區抽 12 則，共 {audit["sampleSize"]} 則，'
              f'由不同於原判讀者的代理盲讀交叉標註。初判完全一致：困難 {audit["initialAgreement"]["difficulties"]}/{audit["sampleSize"]}、'
              f'情境 {audit["initialAgreement"]["contexts"]}/{audit["sampleSize"]}、立場 {audit["initialAgreement"]["stance"]}/{audit["sampleSize"]}。'
              f'{audit["disagreementRows"]} 則有分歧，均回讀裁決；最終有 {audit["changedRows"]} 則標註修正。'
              '這是抽樣初判一致性，不是正確率，也不是全數獨立複核。')
    stance_note = (f'本次立場與前次七大類分析中的同一批留言有 {group["priorStanceChanged"]} 則不同；'
                   '新表使用本次立場，前次全檔立場統計保留原版，兩次結果不能混用。')
    page += ['<details class="feedback-codebook"><summary>細分規則、抽樣核對與尚未回答的問題</summary>', f'<p>{esc(method)}</p><p>{esc(stance_note)}</p>',
             f'<p>本次未標所列情境 {group["noContext"]:,} 則，資訊不明 {group["unclear"]:,} 則。未入原 A 類的留言未重新細標，不能把此表當成全部清運、家戶服務或使用障礙的總量。</p>',
             '<p>六類不代替原七類：滿溢仍需對照清運維護，家戶投放仍需對照家戶收運。現有街頭與場域紀錄只能提供查核入口；缺少留言時間與核實地點，尚不能判定各區實際缺桶，也不能把場域紀錄當桶數。</p>',
             '<ul>' + ''.join(f'<li><strong>{esc(label)}：</strong>{esc(CHECKS[key])}</li>' for key, label in DIFFICULTIES.items()) + '</ul>', '</details></section>']
    md += ['', '## 方法與限制', '', method, '', stance_note, '',
           f'未標所列情境 {group["noContext"]} 則；資訊不明 {group["unclear"]} 則。未入原 A 類的留言沒有重新細標，不能據此估計全部清運或家戶問題。', '',
           '六類保留原七類的界線。街頭與場域資料只作查核入口，沒有逐則時空連結或人口分母，不作實際缺桶、因果或改善優先序推論。', '',
           '[凍結規約](protocol.md)、[裁決說明](adjudication.md)、[彙總資料](summary.json)。原文、初判、盲讀、最終標註與裁決紀錄均留在本地；雜湊不能取代保留輸入。', '',
           '## 重建', '', '保留完整本地輸入後可執行：', '', '```sh',
           'python scripts/feedback_access.py --private-dir /private/coding --source /private/source.tsv --prior-annotations /private/prior.jsonl',
           'python scripts/package-research.py', '```', '',
           '不重新計算時，既有建置流程由保存的彙總資料重建頁面。', '',
           '## 來源指紋', '', *[f'- {key}: `{value}`' for key, value in data['source'].items()]]
    return '\n'.join(page), '\n'.join(md)


def home(data):
    group = data['overall']; n = group['selectedRecords']
    specifics = {key: value for key, value in group['difficulties'].items() if key != 'D1'}
    top = leaders(specifics)
    text = '、'.join(f'{DIFFICULTIES[k]} {specifics[k]:,} 則' for k in top) or '尚無可歸類的具體困難'
    return ('<div class="home-access-reading"><h4>把「垃圾桶不夠」拆開看</h4>'
            f'<p>重新細讀 {n:,} 則桶位相關留言，泛稱不足／增設有 {group["difficulties"]["D1"]:,} 則；具體困難以{html.escape(text)}最多。'
            f'{html.escape(shared_pattern(data))}</p>'
            '<p>這是既有桶位留言的細分，仍不能確認實際缺桶。下一步需核實路線、變動時間、尖峰桶況與使用情境。</p>'
            '<a href="#feedback-access">看十二區六種困難、情境與立場</a></div>')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--private-dir', type=Path, required=True)
    parser.add_argument('--source', type=Path, required=True)
    parser.add_argument('--prior-annotations', type=Path, required=True)
    parser.add_argument('--research-root', type=Path)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    canonical = root.parent.parent / 'topics/bins/research'
    research = args.research_root or (canonical if canonical.is_dir() else root / 'research')
    folder = research / FOLDER; private = args.private_dir
    prior_path = research / 'feedback-2026-10-17/summary.json'
    prior_summary = json.loads(prior_path.read_text())
    manifest = json.loads((private / 'manifest.json').read_text())
    source_hash, prior_hash, protocol_hash = digest(args.source), digest(args.prior_annotations), digest(folder / 'protocol.md')
    if (source_hash, prior_hash, protocol_hash) != (manifest['sourceSha256'], manifest['priorAnnotationSha256'], manifest['protocolSha256']):
        raise ValueError('Private inputs differ from frozen manifest')
    with args.source.open(encoding='utf-8-sig', newline='') as stream:
        parsed = list(csv.reader(stream, delimiter='\t', strict=True))
    if parsed[0] != ['匿名編號', '行政區', '原議題', '心情', '去識別內容'] or any(len(row) != 5 for row in parsed[1:]):
        raise ValueError('Invalid original feedback shape')
    rows = parsed[1:]
    prior_list = [json.loads(line) for line in args.prior_annotations.read_text().splitlines() if line.strip()]
    prior = {row['r']: row for row in prior_list}
    if len(prior_list) != len(prior) or set(prior) != set(range(1, len(rows) + 1)):
        raise ValueError('Prior annotations do not cover the source')
    selected = sorted(r for r, row in prior.items() if 'A' in row['themes'])
    sample = sample_rows(rows, selected, source_hash)
    if selected != manifest['selectedRows'] or sample != manifest['sampleRows']:
        raise ValueError('Frozen selection or blind sample changed')
    if any(manifest['primaryOwners'][str(r)] == manifest['secondaryOwners'][str(r)] for r in sample):
        raise ValueError('Blind audit must use a different coder')
    paths = {key: private / (key + '.jsonl') for key in ('initial', 'secondary', 'final')}
    initial = read_annotations(paths['initial'], selected)
    secondary = read_annotations(paths['secondary'], sample)
    final = read_annotations(paths['final'], selected)
    decision_path = private / 'decisions.json'
    decisions = json.loads(decision_path.read_text())
    result = summarize(rows, prior, initial, secondary, final, sample, decisions)
    result['source'] = {
        'sourceSha256': source_hash, 'priorAnnotationSha256': prior_hash, 'priorSummarySha256': digest(prior_path),
        'protocolSha256': protocol_hash, 'initialSha256': digest(paths['initial']), 'secondarySha256': digest(paths['secondary']),
        'finalSha256': digest(paths['final']), 'manifestSha256': digest(private / 'manifest.json'),
        'decisionsSha256': digest(decision_path), 'adjudicationNotesSha256': digest(folder / 'adjudication.md'),
    }
    validate(result, prior_summary)
    (folder / 'summary.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(f'Aggregated {len(final)} manually annotated rows; {len(sample)} cross-coded and adjudicated')


if __name__ == '__main__':
    main()

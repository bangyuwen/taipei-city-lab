"""Reproduce aggregate observations; never publish or package individual feedback."""
import argparse
import csv
import hashlib
import html
import io
import json
import re
from urllib.parse import urlencode
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER = 'feedback-2026-10-17'
FIELDS = ['匿名編號', '行政區', '原議題', '心情', '去識別內容']
# Themes are authored semantic judgments, never automatic word matches.
THEMES = {
    'A': ('桶位與投放便利', '桶的數量、撤除、位置、距離、入口與使用便利；家戶收運站另歸家戶服務。'),
    'B': ('家戶收運與投放管道', '垃圾車時間、路線、等待、作息衝突、定點或社區代收；僅描述家戶混投不算此類。'),
    'C': ('清掃、清運與設備維護', '滿溢、清掃或清運不足、設備損壞、髒亂未處理；不因提到桶或亂丟就自動納入。'),
    'D': ('亂丟、混投與垃圾來源', '亂丟、非法棄置、家戶或商業垃圾混投、菸蒂狗便等來源行為；明示的風險仍是訴求而非核實事件。'),
    'E': ('分類、回收與廚餘處理', '分類與接收規則、拒收、指引差異、回收或廚餘處理；只提物品名稱不算。'),
    'F': ('異味、鼠蟲與鄰近負擔', '明示的臭味、鼠蟲、收運噪音、阻礙通行或鄰近負擔；不從髒亂自行推定鼠蟲。'),
    'G': ('制度、執法與管理回應', '費率與袋規則、執法、責任、政策溝通、陳情回應與治理公平；一般增桶請求不自動納入。'),
}
STANCES = {
    'more': '偏向增設／恢復／保留',
    'less': '偏向減少／撤除／反對設置',
    'conditional': '有條件增設或保留',
    'mixed': '方向混合或明示權衡',
    'unspecified': '談到公共桶但方向不明',
    'none': '未表達公共桶立場／以其他議題為主',
}
SCOPE = '這份資料是台北市意見回饋中篩出的垃圾相關訊息。分析單位是一則留言；比例只描述這批留言，不代表全體意見回饋或台北市民意。'
METHOD = '三個子代理逐則閱讀檔案內文字，依實際意思標註問題、訴求與公共桶立場，不使用關鍵字規則分類。每則可涉及多個問題，同類最多計一次；比例不能相加。原文中的否定、條件與服務情境需要分開理解。AI 判讀仍可能有誤，現場與因果均未驗證。'
LIMITS = [
    '收集期間、招募方式、完整回饋總數、垃圾相關訊息的篩選規則均未提供；2026-10-17 是分析整理日。',
    '行政區與心情沿用原檔欄位。行政區是留言標記，未確認為居住地或事件所在地；心情標籤的填寫或標註方式未知。',
    '匿名編號唯一不等於已確認每人只提交一次。相同文字可能來自不同留言，不因文字相同而刪除。',
    '未取得人口、曝光量與各區完整回饋數，不能比較各區問題發生率；未提供逐筆日期，不能分析趨勢。',
    '原始留言留在本地。網站只呈現彙總與改寫摘述，不刊出匿名編號、逐則內容或可連結個人的細節。摘述不是逐字引言。',
]


# Qualitative hypotheses, not a semantic coding of every message.
PROBLEM_PATHS = [
    ('access', '行人投放', '走路、轉乘、遊逛時找不到可用的桶',
     '位置、辨識與實際可用性', '沿真實路徑記錄找桶時間、繞路及投放成敗'),
    ('schedule', '家戶收運', '上班、輪班或照顧安排難配合垃圾車',
     '收運時段與替代管道', '核對可到達的合法去處、開放時間與使用條件'),
    ('operations', '現場維護', '桶旁垃圾、滿溢、鼠蟲或異味的困擾',
     '負荷、巡收與鄰里負擔', '同點重複記錄桶況、清運時間與周邊垃圾'),
]
MECHANISMS = [
    ('access', '找不到桶，先分辨位置、辨識與可用性',
     '留言有人希望增加或恢復投放點，也有人反對住家附近設桶。便利與鄰近負擔是兩個要同時觀察的結果。',
     '可能是路徑上距離遠、看不見入口，或到了現場卻滿溢、阻塞；三者需要不同的改善方式。',
     '也有人會把垃圾帶回家，不能畫成「無桶必然亂丟」。「找不到」也可能是配置或資訊問題；若桶已順路且可用，增設未必能處理清潔問題。',
     '沿相同出發點與目的地記錄路徑、找桶秒數、繞行距離、辨識情形、投放成功與失敗原因；記下時間與現場條件。',
     '距離與繞路主導時才比較配置；接近後仍找不到入口，先比較指引；已找到卻不能投放，轉查維護。'),
    ('schedule', '家戶收運的限制可能出在時間',
     '留言有人描述下班、輪班或照顧安排與垃圾車時間衝突，也出現希望有固定或彈性投放管道的想法。',
     '即使地理上離收運點很近，開放時間與可出門時間沒有交集，服務仍可能難以使用。',
     '也有定點太遠、開放時間變動造成空跑，以及深夜垃圾車噪音的回饋。延後時段可能增加附近負擔，不能把所有家戶混投都歸因於追不到車。',
     '以自願訪談核對可投放時段、實際服務時間、步行可達性、使用條件及既有替代方式；不保存可識別個人的作息。',
     '先找出哪一段時間或條件無法使用，再比較調班、既有代收或其他替代服務；不能由留言推定接受付費。'),
    ('operations', '滿溢要追到負荷與巡收的時間差',
     '留言同時描述希望有桶，以及桶旁堆積、家戶垃圾混入、異味或鼠蟲的困擾；目前均是未經現場核實的描述。',
     '可能是尖峰投放增加、實際清運間隔拉長、入口阻塞、容量不合用，或周邊其他垃圾來源。',
     '鼠蟲或髒亂不一定由該桶造成；留言還提到菸蒂、狗便與回收車掉落物，不能一律用行人桶處理。店家、夜市、臨時堆置等來源也需查核。',
     '同點、固定時段記錄可用容量、阻塞、滿溢、上次實際清運與清洗時間、周邊垃圾及尖峰活動；同步記錄清運工時。',
     '若問題隨清運間隔出現，先比較巡收；若空桶也不能正常投放，先查入口與設計；設備感測需有能回應的人力。'),
    ('sorting', '分類指引與現場接收，要能接得起來',
     '留言有人描述網路指引與現場接收不同，或不同人員標準不同，也有人自述受挫後改丟一般垃圾。',
     '可能是規則資訊未同步、接收條件不清，或分類收運安排與生活時段不合，使願意分類的人仍無法完成投放。',
     '不能一概歸為市民不懂分類；也不能由同車裝載就斷言後端沒有處理。車輛進入限制、袋規格與物品類別也可能影響接收。',
     '用同一組物品比對當期書面規則與現場接收，記錄日期、拒收理由及替代管道，再向承接單位確認後端流程。',
     '若規則與現場不一致，先同步指引與人員說明；若接收時段或場所受限，則回到服務安排比較，不能只增加宣導。'),
    ('burden', '移走一個點，還要看負擔去了哪裡',
     '希望恢復垃圾桶與反對住宅旁設桶的意見並存。本次另做逐則立場判讀，但這批留言不具代表性，不能宣稱任何一方代表市民多數。',
     '使用者得到的便利與鄰近住戶、店家、清潔人員承擔的工作和環境負擔，可能落在不同人身上。',
     '撤點後當地變乾淨，仍可能只是垃圾轉往鄰街；反過來，撤點後變髒也可能伴隨活動、商家或巡收變化。',
     '同時觀察原點與鄰近替代點，記錄街面垃圾、投放成功、異味與清潔工時；向使用者、鄰近住戶與清潔人員分別確認。',
     '試辦要同看服務可用性與周邊負擔，預先定義停止與回復條件；不能只用桶數、單點髒亂或陳情件數判定成功。'),
]
LOOP_NODES = ['合法投放難以使用', '垃圾可能轉往其他地點', '集中投放與維護壓力', '陳情、限縮或撤點']
LOOP_NOTE = '虛線箭頭全部是待驗證的可能關係，未證明這些事件在同一地點依序發生；也沒有估計影響大小。若替代服務未補上，限縮或撤點可能再增加投放困難。'
CHECK_STEPS = [
    ('補齊背景', '向資料提供者確認收集與篩選方式；建立能核對時間、場景與地點的清單，保留無法定位的留言。'),
    ('建立基準', '同點重複觀察一般與尖峰時段，對照實際收運；同看找桶、投放、街面垃圾、鄰點變化與工時。'),
    ('比較一項調整', '取得承接單位同意後，預先定義觀察期、成功及停止條件；保留可比的未調整場景，記錄同期活動與天候。'),
    ('依結果決定', '只有改善投放可用性且未把負擔推往鄰點，才考慮擴大；若比較條件不成立，保留描述結果，不宣稱因果成效。'),
]


def problem_map():
    """A qualitative service map; arrows indicate investigation order only."""
    esc = html.escape
    rows = ''.join(
        f'<li><div><strong>{esc(label)}</strong><span>{esc(scene)}</span></div>'
        f'<div><span class="problem-column-label">先分辨</span><strong>{esc(gap)}</strong></div>'
        f'<div><span class="problem-column-label">要補的證據</span><span>{esc(check)}</span>'
        f'<a href="#feedback-mechanism-{key}">深入看這個問題</a></div></li>'
        for key, label, scene, gap, check in PROBLEM_PATHS)
    return ('<figure class="problem-map"><figcaption>問題分流圖：留言情境 → 查核問題 → 所需證據。'
            '這是分析架構，並非人數分群或已證明的因果。</figcaption><ol>' + rows + '</ol></figure>')


REPORT_TITLE = '從投放到清運：台北垃圾回饋的完整分析'
REPORT_JUDGMENT = '投放方便與環境負擔，需要一起判斷'
REPORT_INTRO = [
    '這批回饋提示了三種需要分開查核的困擾：外出時找不到可用的投放處、家戶作息難以配合收運，以及投放點周邊的滿溢與清潔負擔。我們的研究判斷是，先把投放到清運的完整過程看清楚，再決定要調整位置、時段、接收規則或維護。',
    '希望增加或恢復垃圾桶，與反對住宅附近設桶，可以同時出現在這份資料中。前者可能關注沿途的方便，後者可能承擔堆積、異味與清掃負擔。因此，改善是否有用，需要同時看「使用者能否完成投放」與「周邊負擔是否減少」，也要查看問題有沒有轉往鄰近地點。',
    '本文先區分三種情境，再追問原因與反例，最後把假說收斂成可執行的查核順序。本次已逐則做 AI 語意判讀，並分開統計問題與設桶立場；現場尚未核實，像「撤桶導致髒亂」這樣的描述，仍需核對時間順序與其他變化。',
]
SCENARIO_BRIDGE = '分開情境，是為了確認服務在哪一段難以使用。接下來要追問：路徑太遠、時段不合，還是到了現場仍不能投放？同樣的「不好丟」，可能需要不同的改善。'
SHARED_BRIDGE = '位置、時段與維護之外，還有兩件事要與每種改善一起檢查：依照指引分類後，現場是否能接收；投放更方便之後，住戶、店家與清潔人員是否承擔更多負擔。'
LOOP_BRIDGE = '前面的問題也可能相互影響。合法投放不易使用，可能讓垃圾轉往其他地點，增加維護壓力，再引發限縮或撤點。但本批留言沒有證明這些事件曾在同一地點依序發生；下圖用來決定要查什麼，不代表已成立的因果。'
VALIDATION_BRIDGE = '要判斷圖中的關係是否存在，先把留言連到可核對的時間、地點與服務，再建立現場基準。接著才比較一項調整，並同時檢查使用者、鄰近地點與清潔人員的結果。以下順序是建議，尚未執行。'
METHOD_BRIDGE = '目前最重要的資料缺口，是逐則事件時間與核實位置、實際服務時間、投放負荷、巡收及成本。缺少這些資料，仍無法區分位置、時間、容量與維護等解釋，也不能提出設點排名或成效估計。'



def render_depth():
    esc = html.escape
    md = ['## 先辨認三種服務情境', '',
          '行人投放與家戶收運是兩種不同使用情境；現場維護則決定投放點能否持續可用。下面把留言線索整理成查核問題，箭頭表示查核順序，不是人數分群或因果證明。', '',
          '| 留言情境 | 先分辨 | 要補的證據 |', '| --- | --- | --- |']
    for _, label, scene, gap, check in PROBLEM_PATHS:
        md += [f'| {label}：{scene} | {gap} | {check} |']
    md += ['', SCENARIO_BRIDGE, '', '## 從情境追問原因與反例', '',
           '前述統計描述留言中的問題與訴求；以下將情境串成可查核的假說，保留其他解釋與反例。類別的留言數不等於受影響人數或發生率，機制仍待現場驗證。', '']
    page = ['<section class="feedback-section" aria-labelledby="feedback-problems"><h3 id="feedback-problems" tabindex="-1">先辨認三種服務情境</h3>',
            '<p>行人投放與家戶收運是兩種不同使用情境；現場維護則決定投放點能否持續可用。下面把留言線索整理成查核問題，箭頭表示查核順序。</p>',
            problem_map(), f'<p>{esc(SCENARIO_BRIDGE)}</p></section>',
            '<section class="feedback-section" aria-labelledby="feedback-mechanisms"><h3 id="feedback-mechanisms" tabindex="-1">從情境追問原因與反例</h3>',
            '<p class="feedback-note">前述統計來自逐則語意判讀；以下「留言線索」是歸納改寫，可能機制與反例仍是待查假說。不能以類別留言數當成受影響人數、發生率或因果證據。</p>']
    groups = [
        ('core', '三個主要問題：位置、時段與維護', '先沿著使用情境查核服務是否可用，逐一區分會導向不同措施的原因。', MECHANISMS[:3]),
        ('shared', '兩個共同問題：接收是否一致，負擔由誰承擔', SHARED_BRIDGE, MECHANISMS[3:]),
    ]
    for key, title, bridge, mechanisms in groups:
        md += [f'### {title}', '', bridge, '']
        page += [f'<section class="feedback-problem-group" aria-labelledby="feedback-{key}-questions"><h4 id="feedback-{key}-questions" tabindex="-1">{esc(title)}</h4><p>{esc(bridge)}</p>']
        for item, heading, observation, hypothesis, alternative, measure, decision in mechanisms:
            md += [f'#### {heading}', '', f'**留言線索：**{observation}', '', f'**可能機制 · 待驗證：**{hypothesis}', '',
                   f'**其他解釋與反例：**{alternative}', '', f'**如何查核：**{measure}', '', f'**結果如何改變決定：**{decision}', '']
            page += [f'<article class="feedback-mechanism" aria-labelledby="feedback-mechanism-{item}"><h5 id="feedback-mechanism-{item}" tabindex="-1">{esc(heading)}</h5>',
                     f'<p><strong>留言線索：</strong>{esc(observation)}</p>',
                     f'<p><strong>可能機制 · 待驗證：</strong>{esc(hypothesis)}</p>',
                     f'<p><strong>其他解釋與反例：</strong>{esc(alternative)}</p>',
                     f'<div class="feedback-check"><p><strong>如何查核：</strong>{esc(measure)}</p><p><strong>結果如何改變決定：</strong>{esc(decision)}</p></div></article>']
        page += ['</section>']
    page += ['</section><section class="feedback-section" aria-labelledby="feedback-loop"><h3 id="feedback-loop" tabindex="-1">把可能的連鎖關係變成查核問題</h3>',
             f'<p>{esc(LOOP_BRIDGE)}</p><figure class="problem-loop"><figcaption>{esc(LOOP_NOTE)}</figcaption><ol>']
    page += [f'<li><span>{esc(node)}</span></li>' for node in LOOP_NODES]
    page += ['</ol><p class="problem-loop-return">若替代服務未補上，可能回到起點：合法投放更難使用。</p></figure>',
             '<p>可測試的介入點分別是：改善合法去處的可用時段、依實際負荷調整巡收，以及在限縮或撤點前確認替代服務。每一項都要連同鄰近地點與清潔工時一起觀察。</p>',
             '<section class="feedback-validation" aria-labelledby="feedback-validation"><h4 id="feedback-validation" tabindex="-1">從資料缺口到改善決定</h4>',
             f'<p>{esc(VALIDATION_BRIDGE)}</p><ol class="feedback-check-steps">']
    md += ['## 把可能的連鎖關係變成查核問題', '', LOOP_BRIDGE, '', LOOP_NOTE, '', '```mermaid', 'flowchart LR',
           '  A[合法投放難以使用] -. 可能 .-> B[垃圾轉往其他地點]',
           '  B -. 可能 .-> C[集中投放與維護壓力]',
           '  C -. 可能 .-> D[陳情、限縮或撤點]',
           '  D -. 替代服務未補上時 .-> A', '```', '',
           '可測試的介入點：合法去處的可用時段、依負荷調整巡收、限縮或撤點前確認替代服務。各項均須連同鄰近地點與清潔工時觀察。', '',
           '### 從資料缺口到改善決定', '', VALIDATION_BRIDGE, '']
    for i, (title, body) in enumerate(CHECK_STEPS, 1):
        md += [f'{i}. **{title}：**{body}']
        page += [f'<li><strong>{esc(title)}</strong><p>{esc(body)}</p></li>']
    completion = '完成條件：形成有場景、時間、服務核對及待驗證原因的問題清單；試辦前固定比較方式與停止條件。未取得現場基準前，不發布設點排名、支持率或成效估計。'
    md += ['', completion, '']
    page += [f'</ol><p class="feedback-note">{esc(completion)}</p></section></section>']
    return md, page


def read_feedback(path):
    payload = path.read_bytes()
    with path.open(encoding='utf-8-sig', newline='') as stream:
        parsed = list(csv.reader(stream, delimiter='\t', strict=True))
    if not parsed or parsed[0] != FIELDS:
        raise ValueError('Unexpected feedback header')
    rows = parsed[1:]
    if not rows or any(len(row) != len(FIELDS) for row in rows):
        raise ValueError('Empty input or malformed record width')
    if any(not cell.strip() for row in rows for cell in row):
        raise ValueError('Missing fields require an explicit analysis decision')
    if len({row[0] for row in rows}) != len(rows):
        raise ValueError('Duplicate anonymous IDs require an explicit analysis decision')
    return payload, rows


def read_annotations(path, total, require_all=True):
    """Validate already-authored judgments; never infer labels from text."""
    rows = [json.loads(line) for line in path.read_text().splitlines() if line.strip()]
    by_row = {}
    for row in rows:
        if set(row) != {'r', 'themes', 'stance', 'clarity', 'meaning'}:
            raise ValueError('Unexpected semantic annotation fields')
        rid = row['r']
        if type(rid) is not int or not 1 <= rid <= total or rid in by_row:
            raise ValueError('Invalid or duplicate annotated row')
        themes = row['themes']
        if not isinstance(themes, list) or any(not isinstance(key, str) for key in themes):
            raise ValueError('Invalid semantic theme list')
        if themes != sorted(set(themes)) or not set(themes) <= set(THEMES):
            raise ValueError('Unknown or repeated semantic theme')
        if row['stance'] not in STANCES or row['clarity'] not in ('clear', 'unclear'):
            raise ValueError('Unknown stance or clarity')
        if not isinstance(row['meaning'], str) or not row['meaning'].strip():
            raise ValueError('Each message requires an authored meaning')
        by_row[rid] = row
    if require_all and set(by_row) != set(range(1, total + 1)):
        raise ValueError('Semantic annotations do not cover every original message')
    return by_row


def blind_sample(rows, source_hash):
    sample = []
    for district in dict.fromkeys(row[1] for row in rows):
        candidates = [i for i, row in enumerate(rows, 1) if row[1] == district]
        sample += sorted(candidates, key=lambda i: hashlib.sha256(
            f'{source_hash}:{i}'.encode()).hexdigest())[:12]
    return set(sample)


def audit_annotations(rows, source_hash, initial, secondary, final, resolutions):
    expected = blind_sample(rows, source_hash)
    if set(secondary) != expected:
        raise ValueError('Double-coded sample differs from the frozen selection')
    fields = ('themes', 'stance', 'clarity')
    disagreements = {rid for rid in expected if any(initial[rid][key] != secondary[rid][key] for key in fields)}
    if resolutions['reviewedRows'] != list(range(1, len(rows) + 1)):
        raise ValueError('Consistency reread does not cover every message')
    decisions = {}
    for item in resolutions['decisions']:
        if set(item) != {'r', 'reason'} or type(item['r']) is not int or item['r'] in decisions or not isinstance(item['reason'], str) or not item['reason'].strip():
            raise ValueError('Invalid semantic adjudication record')
        decisions[item['r']] = item['reason']
    changed = {rid for rid in final if any(initial[rid][key] != final[rid][key] for key in fields)}
    if set(decisions) != disagreements | changed:
        raise ValueError('Every sampled disagreement and changed judgment needs a recorded reason')
    agreement = {key: sum(initial[rid][key] == secondary[rid][key] for rid in expected) for key in fields}
    return {'sampleSize': len(expected), 'selection': '每區依來源雜湊與原始列序排序取 12 則；獨立判讀不提供初判標籤',
            'initialAgreement': agreement, 'disagreementRows': len(disagreements),
            'adjudicatedRows': len(disagreements),
            'changedRows': len(changed), 'consistencyReviewedRows': len(rows), 'decisionRecords': len(decisions),
            'scope': '一致數是抽樣的初判一致性，不是分類正確率；分歧經回讀裁決，未獨立複核全部留言。'}


def analyze(path, annotations, initial_path, secondary_path, resolutions_path, protocol_path, manifest_path):
    payload, rows = read_feedback(path)
    n = len(rows)
    source_hash = hashlib.sha256(payload).hexdigest()
    manifest = json.loads(manifest_path.read_text())
    if manifest['source_sha256'] != source_hash or manifest['records'] != n or manifest['protocol_sha256'] != hashlib.sha256(protocol_path.read_bytes()).hexdigest():
        raise ValueError('Semantic assignment manifest does not match source or protocol')
    final = read_annotations(annotations, n)
    initial = read_annotations(initial_path, n)
    secondary = read_annotations(secondary_path, n, require_all=False)
    resolutions = json.loads(resolutions_path.read_text())
    audit = audit_annotations(rows, source_hash, initial, secondary, final, resolutions)
    groups = {}
    for rid, row in enumerate(rows, 1):
        group = groups.setdefault(row[1], {'themes': {key: 0 for key in THEMES},
                                          'stances': {key: 0 for key in STANCES}, 'unclear': 0, 'unclassified': 0})
        label = final[rid]
        for key in label['themes']:
            group['themes'][key] += 1
        group['stances'][label['stance']] += 1
        group['unclear'] += label['clarity'] == 'unclear'
        group['unclassified'] += not label['themes']
    texts = Counter(row[4] for row in rows)
    data = {'schemaVersion': 3, 'analysisDate': '2026-10-17',
            'source': {'name': 'Pasted text.txt', 'sha256': source_hash, 'frame': SCOPE,
                       'collectionPeriod': None, 'recruitment': None, 'selectionRules': None, 'allFeedbackCount': None},
            'records': n,
            'quality': {'uniqueIds': n, 'missingCells': 0,
                        'multilineRecords': sum('\n' in row[4] or '\r' in row[4] for row in rows),
                        'duplicateTextGroups': sum(count > 1 for count in texts.values()),
                        'duplicateTextExtraRows': sum(count - 1 for count in texts.values())},
            'districts': dict(Counter(row[1] for row in rows)),
            'moods': dict(Counter(row[3] for row in rows)), 'originalTopics': dict(Counter(row[2] for row in rows)),
            'themes': [{'id': key, 'label': label, 'definition': definition,
                        'count': sum(group['themes'][key] for group in groups.values())}
                       for key, (label, definition) in THEMES.items()],
            'stances': {key: sum(group['stances'][key] for group in groups.values()) for key in STANCES},
            'unclear': sum(group['unclear'] for group in groups.values()),
            'unclassified': sum(group['unclassified'] for group in groups.values()), 'districtAnalysis': groups,
            'semantic': {'method': METHOD, 'primaryCoders': 3, 'codingProtocol': 'semantic-protocol-v1',
                         'protocolSha256': hashlib.sha256(protocol_path.read_bytes()).hexdigest(),
                         'annotationSha256': hashlib.sha256(annotations.read_bytes()).hexdigest(),
                         'initialAnnotationSha256': hashlib.sha256(initial_path.read_bytes()).hexdigest(),
                         'doubleCodingSha256': hashlib.sha256(secondary_path.read_bytes()).hexdigest(),
                         'adjudicationSha256': hashlib.sha256(resolutions_path.read_bytes()).hexdigest(),
                         'reviewNotesSha256': resolutions['notesSha256'], 'audit': audit}}
    validate(data)
    return data


def validate(data):
    if data.get('schemaVersion') != 3:
        raise ValueError('Semantic summary required; legacy word counts cannot reconstruct meaning')
    n = data['records']
    if type(n) is not int or n <= 0:
        raise ValueError('Invalid feedback denominator')
    for field in ('districts', 'moods', 'originalTopics'):
        if any(type(v) is not int or v <= 0 for v in data[field].values()) or sum(data[field].values()) != n:
            raise ValueError('Aggregate denominator mismatch')
    expected = [(key, label, definition) for key, (label, definition) in THEMES.items()]
    if [(x['id'], x['label'], x['definition']) for x in data['themes']] != expected or data['semantic']['method'] != METHOD:
        raise ValueError('Semantic protocol changed; repeat interpretation before rebuilding')
    groups = data['districtAnalysis']
    if set(groups) != set(data['districts']) or set(data['stances']) != set(STANCES):
        raise ValueError('Missing district or stance aggregates')
    for district, total in data['districts'].items():
        group = groups[district]
        if set(group['themes']) != set(THEMES) or set(group['stances']) != set(STANCES):
            raise ValueError('Unknown theme or stance in district')
        values = [*group['themes'].values(), *group['stances'].values(), group['unclear'], group['unclassified']]
        if any(type(v) is not int or not 0 <= v <= total for v in values):
            raise ValueError('District counts outside denominator')
        if sum(group['stances'].values()) != total or not max(group['themes'].values()) <= total - group['unclassified'] <= sum(group['themes'].values()):
            raise ValueError('Inconsistent district stance or classification coverage')
    for item in data['themes']:
        if sum(group['themes'][item['id']] for group in groups.values()) != item['count']:
            raise ValueError('Theme columns do not reconcile')
    for key in STANCES:
        if sum(group['stances'][key] for group in groups.values()) != data['stances'][key]:
            raise ValueError('Stance columns do not reconcile')
    for key in ('unclear', 'unclassified'):
        if sum(group[key] for group in groups.values()) != data[key]:
            raise ValueError('Classification quality totals do not reconcile')
    audit = data['semantic']['audit']
    if not 0 < audit['sampleSize'] <= n or not 0 <= audit['disagreementRows'] <= audit['sampleSize'] or audit['adjudicatedRows'] != audit['disagreementRows']:
        raise ValueError('Incomplete semantic double-coding audit')
    if audit['consistencyReviewedRows'] != n or type(audit['changedRows']) is not int or not 0 <= audit['changedRows'] <= n:
        raise ValueError('Invalid consistency reread evidence')
    if set(audit['initialAgreement']) != {'themes', 'stance', 'clarity'} or any(type(v) is not int or not 0 <= v <= audit['sampleSize'] for v in audit['initialAgreement'].values()):
        raise ValueError('Invalid agreement counts')


def percent(value, total):
    return f'{value / total * 100:.1f}%'


def table_markdown(values, total):
    return '\n'.join(['| 欄位值 | 則數 | 占本檔比例 |', '| --- | ---: | ---: |'] +
                     [f'| {key} | {value:,} | {percent(value, total)} |' for key, value in values])


def district_comparison(data, district, key):
    count = data['districtAnalysis'][district]['themes'][key]
    n = data['districts'][district]
    total = next(item['count'] for item in data['themes'] if item['id'] == key)
    rest_count, rest_n = total - count, data['records'] - n
    difference = 100 * (count / n - rest_count / rest_n) if rest_n else None
    return count, n, rest_count, rest_n, difference


DISTRIBUTION_FOLDER = 'feedback-distribution-2026-10-18'
COVERAGE_FOLDER = 'bin-coverage-2026-10-18'
DISTRIBUTION_TITLE = '先確認能在哪裡投放，再分清缺桶或服務問題'
DISTRIBUTION_CONCLUSION = ('現有資料較支持分區查核方向，還不能確認哪區實際缺桶。松山、大安、大同較偏投放可達性；'
    '萬華先查清掃與維護；文山要另外處理家戶收運。信義、中山、中正、內湖、士林有混合問題；'
    '北投與南港先核實清冊及場域可用條件，再分清配置、清運或管理。')
DISTRIBUTION_UPDATE = ('本輪沿用同一批 681 列街頭位置與 130 筆場域紀錄。上一版交叉分析已使用全 12 區場域清單，'
    '這次補齊的是地圖呈現，並重新閱讀語意判讀以細化查核方向；沒有新增已核實桶位，也未改動逐則標籤或統計。')
VENUE_BOUNDARY = ('130 筆場域紀錄對應 120 組不同座標，含重複名稱或座標，不能當作 130 個不同場所或垃圾桶。'
    '場所名稱只提供查核入口，開放、接收種類與實際桶況仍待確認。')


def load_distribution(data, research=None):
    """Join district aggregates only; source absence never measures physical stock."""
    canonical = ROOT.parent.parent / 'topics/bins/research'
    research = research or (canonical if canonical.is_dir() else ROOT / 'research')
    folder = research / DISTRIBUTION_FOLDER
    receipt = json.loads((folder / 'source-check.json').read_text())
    assessments = json.loads((folder / 'assessments.json').read_text())
    feedback_bytes = (research / FOLDER / 'summary.json').read_bytes()
    if hashlib.sha256(feedback_bytes).hexdigest() != assessments['feedbackSha256'] or json.loads(feedback_bytes) != data:
        raise ValueError('District interpretations require their reviewed semantic summary')
    if set(assessments['districts']) != set(data['districts']):
        raise ValueError('Every feedback district needs exactly one interpretation')
    raw = (research / receipt['retainedRawPath']).read_bytes()
    snapshot = research / 'source-recovery-2026-10-15' / receipt['csvFile']
    csv_bytes = snapshot.read_bytes()
    if hashlib.sha256(raw).hexdigest() != receipt['sha256'] or receipt['sha256'] != receipt['retainedRawSha256']:
        raise ValueError('Official source verification no longer matches retained raw input')
    if hashlib.sha256(csv_bytes).hexdigest() != receipt['csvSha256'] or receipt['csvSha256'] != assessments['distributionSha256']:
        raise ValueError('Official CSV changed; repeat comparison and interpretation')
    with snapshot.open(encoding='utf-8-sig', newline='') as f:
        rows = list(csv.DictReader(f))
    if rows != list(csv.DictReader(io.StringIO(raw.decode('cp950')))):
        raise ValueError('Normalized CSV differs from retained official response')
    if len(rows) != receipt['rows'] or receipt['rowsMatchRetained'] is not True or receipt['inventoryComplete'] is not None:
        raise ValueError('Unverified distribution source or physical coverage claim')
    mapping = {district + '區': district for district in data['districts']}
    bins = {d: {'rows': 0, 'plottable': 0, 'coordinates': set()} for d in data['districts']}
    for row in rows:
        if row['行政區'] not in mapping:
            raise ValueError('Unmatched official district; refuse an incomplete join')
        group = bins[mapping[row['行政區']]]
        group['rows'] += 1
        try:
            x, y = float(row['經度']), float(row['緯度'])
        except (TypeError, ValueError):
            continue
        if 121.4 < x < 121.7 and 24.95 < y < 25.3:
            group['plottable'] += 1
            group['coordinates'].add((x, y))
    for group in bins.values():
        group['distinctPlottableCoordinates'] = len(group.pop('coordinates'))
    for item in assessments['districts'].values():
        if not item['evidence'] or len(set(item['evidence'])) != len(item['evidence']) or any(k not in ('more', *THEMES) for k in item['evidence']):
            raise ValueError('Invalid semantic evidence selection')
        if any(not isinstance(item.get(k), str) or not item[k].strip() for k in ('reading', 'interpretation', 'next', 'check')):
            raise ValueError('Missing conditional district interpretation')
    coverage, venues = load_coverage(research, rows, assessments)
    return {'source': receipt, 'assessments': assessments, 'bins': bins, 'coverage': coverage, 'venues': venues}


def load_coverage(research, street_rows, assessments):
    """Keep street locations and venue records separate; verify retained sources."""
    manifest_bytes = (research / COVERAGE_FOLDER / 'source-check.json').read_bytes()
    if hashlib.sha256(manifest_bytes).hexdigest() != assessments['coverageSha256']:
        raise ValueError('Coverage evidence changed; repeat district interpretation')
    receipt = json.loads(manifest_bytes)
    sources = {}
    for source in receipt['sources']:
        path = research / source['retainedPath']
        raw = path.read_bytes()
        if source['status'] != 200 or len(raw) != source['bytes'] or hashlib.sha256(raw).hexdigest() != source['sha256']:
            raise ValueError('Coverage source no longer matches retained input')
        sources[path.name] = raw
    projection = lambda rows: [(r['行政區'], r['地址'], r['經度'], r['緯度']) for r in rows]
    map_rows = list(csv.reader(json.loads(sources['official-map-data.json'])))
    if any(len(r) != 6 for r in map_rows) or projection(street_rows) != [(r[0], r[1] + r[2], r[3], r[4]) for r in map_rows]:
        raise ValueError('Official map and street CSV differ; reassess coverage')
    api = json.loads(sources['api-offset-0.json'])['result']
    tail = json.loads(sources['api-offset-1000.json'])['result']
    if (api['count'] != len(street_rows) or api['offset'] != 0 or api['limit'] != 1000
            or tail['count'] != api['count'] or tail['offset'] != 1000 or tail['results']
            or projection(api['results']) != projection(street_rows)):
        raise ValueError('Official API pagination or row comparison changed')
    if receipt['addedVerifiedStreetRows'] != 0 or receipt['inventoryComplete'] is not None or receipt['surveyDate'] is not None:
        raise ValueError('Unsupported new street inventory claim')
    venue_rows = list(csv.DictReader(io.StringIO(sources['official-tourist.csv'].decode('cp950'))))
    venues = {district: [] for district in assessments['districts']}
    for row in venue_rows:
        district = row['行政區'].removesuffix('區')
        if district not in venues:
            raise ValueError('Unmatched venue district')
        venues[district].append(row['地址'])
    if len(venue_rows) != 130:
        raise ValueError('Venue source changed; repeat interpretation')
    return receipt, venues


def distribution_evidence(data, district, keys):
    group, n = data['districtAnalysis'][district], data['districts'][district]
    result = []
    for key in keys:
        count = group['stances']['more'] if key == 'more' else group['themes'][key]
        label = '偏向增設／恢復／保留桶' if key == 'more' else THEMES[key][0]
        result.append(f'{label} {count}／{n}（{percent(count,n)}）')
    return result


def distribution_intro(distribution):
    s = distribution['source']
    description = (f'採用 {s["sourceUpdatedAt"][:10]} 更新的官方主檔，於 {s["checkedDateTaipei"]} 重新下載核對，'
                   f'全部 {s["rows"]} 列與保存檔一致。這是位置列，不是已核實的全市桶數；原調查日期與全市完整性未知。')
    boundary = ('僅依行政區標記對照，沒有把留言配到某個垃圾桶。回饋的日期及事件位置未核實，'
                '因此沒有計算每桶留言數、步行覆蓋率或缺桶排名。不同問題可出現在同一則，比例不能相加。')
    c = distribution['coverage']
    focus = []
    for district, reading in [('北投', '先核對撤除紀錄與場域可用性'), ('南港', '先查步行銜接、開放與接收規則')]:
        names = distribution['venues'][district]
        count = distribution['bins'][district]['rows']
        map_url = '?' + urlencode({'year': '2026-main', 'district': district + '區'}) + '#map'
        focus.append(f'<article class="coverage-focus-item"><h5>{district}｜{reading}</h5>'
                     f'<p><strong>街頭位置 {count} 列</strong>；另有<strong>場域線索 {len(names)} 筆</strong><br>兩種單位不同，不相加成桶數。</p>'
                     f'<details><summary>查看 {len(names)} 筆場域名稱</summary><ul>'
                     + ''.join(f'<li>{html.escape(name)}</li>' for name in names) + f'</ul></details><a href="{html.escape(map_url)}">在地圖分開看街頭紀錄與場域線索</a></article>')
    return f'''<div class="distribution-overview"><h4>{DISTRIBUTION_TITLE}</h4><p>{DISTRIBUTION_CONCLUSION}</p>
<p>{description}</p>
<p>{DISTRIBUTION_UPDATE}</p>
<p><strong>來源複查沒有補入新的已核實街頭位置。</strong>完整 API、CSV 與官方查詢地圖的 {s["rows"]} 列位置一致；三個介面互相吻合，不等於三次獨立盤點。</p>
<p>另納入 {c["venueSourceUpdatedAt"][:10]} 更新的官方場域清單，共 130 筆紀錄。{VENUE_BOUNDARY} 它提供捷運站、景點與商場等查核線索，沒有逐桶位置、現況、開放時段或接收規則，不能直接當成可用投放點。</p>
<div class="coverage-focus">{''.join(focus)}</div>
<p><strong>北投零列的原因仍待核實。</strong>2026-08-14 議會答覆提到調整期間可能移除，但沒有確認北投全區撤除。因此修正上一版「清單缺口」的說法：撤除、未收錄與跨機關設施都需分開核對。</p>
<details class="feedback-codebook"><summary>這次比對能說明什麼？</summary><p>{boundary}「偏向增設／恢復／保留」含保留既有設施的方向，並非每則都在描述桶數不足；它也不能與維護或管理主題當成互斥票數。</p><p>2024 年歷史快照曾列北投 98 列、南港 94 列，日期不同，不能回填現況。狗便袋及公園設施也需確認類型與管理機關，不能直接加算。</p></details>
<p><a href="{html.escape(s['catalogUrl'])}" target="_blank" rel="noopener noreferrer">官方位置與場域清單</a> · <a href="{c['mapUrl']}" target="_blank" rel="noopener noreferrer">官方查詢地圖</a> · <a href="{c['councilUrl']}" target="_blank" rel="noopener noreferrer">議會逐字稿來源</a> · <a href="#feedback-method">語意判讀方法與限制</a></p></div>'''



def distribution_report(data, distribution):
    s, bins = distribution['source'], distribution['bins']
    md = ['# 語意回饋 × 官方位置清單：十二區交叉判讀', '',
          f'分析與來源複查日：{s["checkedDateTaipei"]}。回饋收集日期與設施逐點調查日期未知。', '',
          DISTRIBUTION_CONCLUSION, '',
          '## 比對方法與可回答的範圍', '',
          f'- 回饋：{data["records"]:,} 則篩選後訊息，沿用已完成的逐則語意判讀；不重新用關鍵字分類。每區分母包含全部留言。',
          f'- 分布：官方 {s["sourceUpdatedAt"]} 更新的主檔，{s["checkedDateTaipei"]} 重下載仍為 {s["rows"]} 列；原始位元組及各列均與保存檔一致。',
          '- 只按行政區欄位一對一連結彙總；留言標記尚未確認為居住地或事件所在地，不能作逐點距離比對。回饋與設施也未建立同期間關係。',
          '- 公開清單列數不是完整現場存量；不以零列當零設施，不把同座標列去重成實體桶，也不把其他年份、294 列中心子集、場所清單或候選街段加算為現況街頭位置。',
          '- 「偏向增設／恢復／保留桶」包含維持既有設施，不等於已核實不足。C 包含一般街道清掃，不全是桶的清運；G 包含費率、政策與陳情，不全是營運失靈。主題各自計數，不相加，也不是互斥選項。',
          '- 不計算留言／桶比、人口密度、步行覆蓋或不足分數。沒有足以支持它們的完整清冊、事件位置、日期、路徑、人流與使用量。',
          '- 下表為 AI 協助提出的有條件研究判讀，並非新的逐則分類、統計檢定、政策效果或設點優先序，仍需人類與現場核對。', '',
          '## 這次更新了什麼', '', DISTRIBUTION_UPDATE, '', VENUE_BOUNDARY, '',
          '完整 API、CSV 與官方查詢地圖的 681 列位置一致，新增已核實街頭位置為 0。另有官方 130 筆場域線索，兩種紀錄不相加。', '',
          '北投 0 列不能直接定性為漏資料：2026-08-14 議會答覆提到可能移除，但未確認全區撤除。北投另有 10 筆場域紀錄，南港另有 5 筆；先核實它們與日常路徑的關係。', '',
          '[完整補查紀錄、12 區場域與來源](../bin-coverage-2026-10-18/README.md)。', '',
          '## 十二區對照', '', '| 行政區 | 本檔留言 | 公開位置列／可繪製列 | 場域線索（筆，另計） | 分開閱讀的語意證據 | 合併判讀與下一步 |', '| --- | ---: | ---: | ---: | --- | --- |']
    for d,n in data['districts'].items():
        a = distribution['assessments']['districts'][d]
        evidence = '；'.join(distribution_evidence(data,d,a['evidence']))
        md += [f'| {d} | {n} | {bins[d]["rows"]}／{bins[d]["plottable"]} | {len(distribution["venues"][d])} | {evidence} | **{a["reading"]}**。{a["interpretation"]} 下一步：{a["next"]} 分辨依據：{a["check"]} |']
    md += ['', f'核對總數：{sum(x["rows"] for x in bins.values())} 位置列、{sum(x["plottable"] for x in bins.values())} 列通過既有座標粗篩、{sum(data["districts"].values())} 則回饋；沒有因缺列或座標異常移除留言。座標粗篩不是現場核實。', '',
           '## 什麼證據能分清原因', '',
           '| 待判斷問題 | 需要補的證據 | 會改變判斷的觀察 |', '| --- | --- | --- |',
           '| 桶位或可達性不足 | 日期明確的完整清冊、事件地點、實際步行路徑與可用狀態 | 沿使用路徑確實沒有可到達的合法投放點，且不能由指引或可用性問題解釋。 |',
           '| 清運與設備維護 | 同點分時桶況、投放負荷、清空時間、設備狀態 | 有合適可達的桶，但在使用時常滿溢、損壞或清運不及。 |',
           '| 管理或家戶服務 | 接收規則、責任、陳情紀錄、垃圾車時間、合法替代管道 | 投放點存在，但時段、接收規則或管理回應讓使用者無法完成投放。 |',
           '', '以上解釋可能同時成立。先選能核實時間與地點的情境；沒有這些證據前，不宣布哪區應增設多少桶。', '',
           '## 來源與重現', '', f'- [官方清潔箱資料集]({s["catalogUrl"]})；[本次下載端點]({s["url"]})。',
           '- [已保存的原始主檔](../source-recovery-2026-10-15/raw/official-download.csv)、[來源複查收據](source-check.json)、[有條件判讀](assessments.json)、[既有語意分析](../feedback-2026-10-17/README.md)。',
           f'- 本次原檔 SHA-256：`{s["sha256"]}`。來源日期與下載／複查日期分開保存；本次沒有改寫舊快照。',
           '- 在網站目錄執行 `python3 scripts/analyze-feedback.py`，再執行 `python3 scripts/package-research.py`。使用已保存的語意彙總、官方 CSV 與收據，不需原始私有留言或網路。', '']
    return '\n'.join(md)


# Research directions are authored hypotheses, separate from semantic labels.
DISTRICT_DIRECTIONS = {
    'A': ('核對步行路徑、桶的位置與可用性', '比較位置或指引調整；同時追蹤投放距離與桶旁堆積。'),
    'B': ('核對作息與垃圾車時段的落差', '比較時段調整或合法代收管道；觀察錯過收運是否減少。'),
    'C': ('同點記錄滿溢時段、巡收與設備狀態', '比較巡收頻率或設備修復；觀察滿溢持續時間與周邊清潔。'),
    'D': ('釐清垃圾來源與投放情境', '依來源比較合法投放引導或管理措施；觀察棄置有無移往鄰近點。'),
    'E': ('核對接收規則、拒收原因與指引', '比較一致的分類指引與接收說明；觀察誤投和拒收是否減少。'),
    'F': ('核對異味、鼠蟲或鄰近負擔的來源與時段', '比較清潔、清運或位置調整；追蹤負擔有無轉移到鄰近地點。'),
    'G': ('核對規則、管理責任與陳情處理紀錄', '比較責任分工與回覆追蹤流程；觀察處理時間及重複反映。'),
}


def district_profile(data, district):
    """Summarize existing judgments without classifying feedback again."""
    counts = data['districtAnalysis'][district]['themes']
    ranked = sorted(THEMES, key=lambda k: -counts[k])
    cutoff = counts[ranked[1]]
    top = [k for k in ranked if counts[k] > 0 and counts[k] >= cutoff]
    contrast = None
    if len(data['districts']) > 1:
        candidate = max(THEMES, key=lambda k: district_comparison(data, district, k)[4])
        if district_comparison(data, district, candidate)[4] > 0:
            contrast = candidate
    return top, contrast


def render_district_diagram(data, distribution=None):
    esc = html.escape
    intro = ('常談議題取區內則數最多的兩類，同數並列；相對差異取本區與其餘各區合併留言的最大正向比例差。'
             '兩者回答不同問題。差異是探索性描述，未做顯著性檢定。細條統一以 0–100% 顯示區內比例；一則可跨類，比例不能相加。')
    direction_note = ('改善方向依相對差異的主題提出，屬於研究建議，並非留言已支持某項措施。先核實情境，再小規模比較；'
                      '下列方向都待驗證，不是各區改善優先序。')
    md = ['### 十二區問題與改善方向', '', intro, '', direction_note, '',
          '| 行政區（本檔則數） | 區內常談議題 | 相對差異（本區 vs 其餘各區） | 改善方向 · 待驗證 |',
          '| --- | --- | --- | --- |']
    if distribution:
        direction_note = '合併判讀同時讀取公開位置列與語意結果，屬於待驗證的研究解釋，不是缺桶診斷或設點優先序。'
        md = ['### 十二區問題與改善方向', '', intro, '', direction_note, '', DISTRIBUTION_CONCLUSION, '', '[完整位置與回饋對照及來源](../feedback-distribution-2026-10-18/README.md)', '', '| 行政區（本檔則數） | 街頭位置列／場域紀錄筆數（不相加） | 區內常談議題 | 相對差異（本區 vs 其餘各區） | 合併判讀 · 待驗證 |', '| --- | ---: | --- | --- | --- |']
    page = [distribution_intro(distribution) if distribution else '', f'<p class="feedback-note">{esc(intro)}</p>',
            '' if distribution else '<div class="district-common"><strong>共通方向：投放便利與周邊負擔一起看</strong><p>桶位與便利在各區都有被提到，但談到桶不等於支持增設。先核對實際路徑、桶況與清運條件，再比較位置、指引或服務調整。</p></div>',
            f'<p id="district-directions-note" class="feedback-note">{esc(direction_note)}</p>',
            '<div class="district-column-headings" aria-hidden="true"><span>行政區標記</span><span>區內常談議題</span><span>相對其他區的差異</span><span>' + ('合併判讀' if distribution else '改善方向') + ' · 待驗證</span></div>',
            '<ol class="district-diagram" aria-label="十二區問題、差異與改善方向" aria-describedby="district-directions-note">']
    for district, n in data['districts'].items():
        counts = data['districtAnalysis'][district]['themes']
        distribution_label = ''
        if distribution:
            group = distribution['bins'][district]
            url = '?' + urlencode({'year':'2026-main','district':district+'區'}) + '#map'
            label = '主檔未列本區' if group['rows'] == 0 else f'公開清單 {group["rows"]} 列'
            distribution_label = f'<div class="district-bin-count" data-bin-rows="{group["rows"]}"><strong>{label}</strong><span>不等於現場桶數</span><span data-venue-count="{len(distribution["venues"][district])}">另有場域線索 {len(distribution["venues"][district])} 筆</span><span>可用條件待核實</span><a href="{esc(url)}">查看公開地圖</a></div>'
        top, contrast = district_profile(data, district)
        issues = '；'.join(f'{THEMES[k][0]} {counts[k]}／{n}（{percent(counts[k],n)}）' for k in top) or '無可歸類議題'
        page += [f'<li class="district-row" data-profile="{esc(district)}"><div class="district-name"><h4>{esc(district)}</h4><span>本檔 {n:,} 則</span>{distribution_label}</div>',
                 '<div class="district-issues"><span class="district-mobile-label">區內常談議題</span><ul>']
        for key in top:
            pct = percent(counts[key], n)
            page += [f'<li data-primary-theme="{key}"><strong>{esc(THEMES[key][0])}</strong><span>{counts[key]}／{n} 則 · {pct}</span><div class="district-bar" aria-hidden="true"><i style="width:{pct}"></i></div></li>']
        if not top:
            page += ['<li>無可歸類議題</li>']
        page += ['</ul></div><div class="district-contrast"><span class="district-mobile-label">相對其他區的差異</span>']
        if contrast:
            count, total, other, rest, delta = district_comparison(data, district, contrast)
            local_pct, rest_pct = percent(count,total), percent(other,rest)
            comparison = f'{THEMES[contrast][0]}：{count}／{total}（{local_pct}）vs {other}／{rest}（{rest_pct}），+{delta:.1f} 百分點'
            check, trial = DISTRICT_DIRECTIONS[contrast]
            page += [f'<strong data-contrast-theme="{contrast}">{esc(THEMES[contrast][0])}</strong>',
                     f'<dl><div><dt>本區</dt><dd>{local_pct}</dd></div><div><dt>其餘各區</dt><dd>{rest_pct}</dd></div></dl>',
                     f'<p class="district-delta">+{delta:.1f} <span>百分點</span></p>',
                     f'<span class="district-comparison-counts">本區 {count}／{total} 則<br>其餘各區 {other}／{rest} 則</span>',
                     '</div>']
            direction = f'先查：{check}；再試：{trial}'
        else:
            comparison = '無可比較的其他區' if len(data['districts']) == 1 else '沒有比例較高的類別'
            direction = '先補齊情境與可比資料，暫不由相對差異指定措施。'
            page += [f'<p>{comparison}</p></div>']
        if distribution:
            a = distribution['assessments']['districts'][district]
            evidence = distribution_evidence(data, district, a['evidence'])
            page += ['<div class="district-direction district-assessment"><span class="district-mobile-label">合併判讀 · 待驗證</span>',
                     f'<h5>{esc(a["reading"])}</h5><ul class="district-joined-evidence">' + ''.join(f'<li>{esc(text)}</li>' for text in evidence) + '</ul>',
                     f'<p>{esc(a["interpretation"])}</p><p><strong>下一步</strong>{esc(a["next"])}</p><p><strong>分辨依據</strong>{esc(a["check"])}</p>']
            direction = f'{a["reading"]}：{a["interpretation"]} 下一步：{a["next"]} 分辨依據：{a["check"]}'
        else:
            page += ['<div class="district-direction"><span class="district-mobile-label">改善方向 · 待驗證</span>']
            page += [f'<p><strong>先查</strong>{esc(check)}</p><p><strong>再試</strong>{esc(trial)}</p>' if contrast else f'<p>{direction}</p>']
        page += ['</div></li>']
        distribution_cell = f'{distribution["bins"][district]["rows"]}／{len(distribution["venues"][district])} | ' if distribution else ''
        md += [f'| {district}（{n}） | {distribution_cell}{issues} | {comparison} | {direction} |']
    page += ['</ol>']
    md += ['']
    return md, page


def render_districts(data, distribution=None):
    validate(data)
    esc = html.escape
    title = '語意回饋 × 公開位置：十二區的查核方向' if distribution else '十二區留言：主要問題、相對差異與改善方向'
    framing = ('以下數字來自逐則語意判讀。分母是該行政區標記在本檔的全部留言，'
               '包含資訊不足與其他內容；行政區尚未確認為事件所在地或居住地。'
               '一則可以談多個問題或訴求，橫列比例不能相加；描述、預期風險與改善訴求都可能被納入，並非核實事件數。')
    diagram_md, diagram_page = render_district_diagram(data, distribution)
    md = [f'## {title}', '', framing, '', *diagram_md, '### 完整七類數據與比較方法', '', '| 行政區（則數） | ' + ' | '.join(x['label'] for x in data['themes']) + ' |',
          '| --- | ' + ' | '.join(['---:'] * len(THEMES)) + ' |']
    page = [f'<section class="feedback-section feedback-cross" aria-labelledby="feedback-cross"><h3 id="feedback-cross" tabindex="-1">{title}</h3><p>{esc(framing)}</p>',
            *diagram_page, '<details class="feedback-codebook district-full-data"><summary>查看完整七類數據與比較方法</summary>',
            '<p id="feedback-cross-method" class="feedback-note">數字為則數與區內比例；細條皆以 0–100% 為同一尺度。窄螢幕可左右捲動，行政區欄固定；鍵盤聚焦後可用方向鍵。</p>',
            '<div class="feedback-matrix-scroll" role="region" aria-label="十二區語意問題交叉表，可左右捲動" tabindex="0" aria-describedby="feedback-cross-method"><table class="feedback-matrix"><caption>行政區 × 七類問題與訴求 · AI 語意判讀</caption><thead><tr><th scope="col">行政區<br>本檔則數</th>']
    page += [f'<th scope="col">{esc(item["label"])}</th>' for item in data['themes']]
    page += ['</tr></thead><tbody>']
    for district, n in data['districts'].items():
        counts = data['districtAnalysis'][district]['themes']
        md += [f'| {district}（{n}） | ' + ' | '.join(f'{counts[k]}（{percent(counts[k], n)}）' for k in THEMES) + ' |']
        page += [f'<tr><th scope="row">{esc(district)}<small>{n:,} 則</small></th>']
        for key in THEMES:
            count, pct = counts[key], percent(counts[key], n)
            page += [f'<td data-district="{esc(district)}" data-theme="{key}"><strong>{count} 則</strong><span>{pct}</span><i aria-hidden="true" style="width:{pct}"></i></td>']
        page += ['</tr>']
    page += ['</tbody></table></div>']
    if len(data['districts']) > 1:
        note = ('為方便逐區閱讀，下表列出每區相對「其餘各區合併留言」比例差最大的正向對照；'
                '依未四捨五入的百分點差選取，同差時按分類順序。這是探索性摘要，並非顯著性檢定或改善優先序。'
                '完整交叉表保留其他類別，不能只憑這一格替整區貼標籤。')
        md += ['', '#### 逐區閱讀差異', '', note, '', '| 行政區／對照類別 | 本區則數／分母（比例） | 其餘各區則數／分母（比例） | 差值（百分點） |', '| --- | ---: | ---: | ---: |']
        page += ['<h5 class="feedback-cross-heading">逐區閱讀差異</h5>', f'<p>{esc(note)}</p>',
                 '<div class="feedback-comparison-scroll" role="region" aria-label="逐區比例對照，可左右捲動" tabindex="0"><table class="feedback-table feedback-comparison"><caption>比較的是本檔留言組成，不是人口發生率</caption><thead><tr><th scope="col">行政區／類別</th><th scope="col">本區</th><th scope="col">其餘各區</th><th scope="col">差值<br>百分點</th></tr></thead><tbody>']
        for district in data['districts']:
            key = max(THEMES, key=lambda k: district_comparison(data, district, k)[4])
            count, n, other, rest, delta = district_comparison(data, district, key)
            if delta <= 0:
                label, local, comparison, difference = district, '無較高比例的類別', '—', '—'
            else:
                label = f'{district}／{THEMES[key][0]}'
                local, comparison, difference = f'{count}／{n}（{percent(count,n)}）', f'{other}／{rest}（{percent(other,rest)}）', f'{delta:+.1f}'
            md += [f'| {label} | {local} | {comparison} | {difference} |']
            page += [f'<tr><th scope="row">{esc(label)}</th><td>{local}</td><td>{comparison}</td><td>{difference}</td></tr>']
        page += ['</tbody></table></div>']
    coverage = '各區「判讀不明確／無法歸入七類」則數（兩者可重疊，均保留在分母）：' + '、'.join(
        f'{d} {g["unclear"]}／{g["unclassified"]}' for d, g in data['districtAnalysis'].items()) + '。'
    md += ['', coverage, '']
    page += [f'<p class="feedback-note">{esc(coverage)}</p></details><p>下一步先依具體情境核對時間、地點、垃圾來源與服務條件，再安排可比的現場觀察。語意比例可以幫助選取訪談題目；仍需補齊各區招募、完整回饋數與篩選方式，才能評估資料收集造成的差異。</p></section>']
    md += ['下一步先依具體情境核對時間、地點、垃圾來源與服務條件，再安排可比的現場觀察。語意比例可以幫助選取訪談題目；仍需補齊各區招募、完整回饋數與篩選方式，才能評估資料收集造成的差異。', '']
    return md, page


def semantic_findings(data):
    """Explain observed composition, keeping the full district table as context."""
    top = max(data['themes'], key=lambda item: item['count'])
    shared = sum(group['themes'][top['id']] > 0 for group in data['districtAnalysis'].values())
    common = (f'各區有共通問題，也有不同的回饋組合。全檔最常談及的是「{top["label"]}」，'
              f'共 {top["count"]:,} 則（{percent(top["count"], data["records"])}），在 {shared} 個區的留言中都有出現。'
              '同一主題包含困擾、改善訴求或風險顧慮；問題類別相同，不代表支持同一措施。')
    examples = []
    for key in ('B', 'C'):
        district = max(data['districts'], key=lambda d: data['districtAnalysis'][d]['themes'][key] / data['districts'][d])
        count, n, other, rest, _ = district_comparison(data, district, key)
        if count and rest:
            examples.append(f'「{THEMES[key][0]}」在{district}標記留言中的比例最高，'
                            f'為 {count}／{n}（{percent(count,n)}），其餘各區合併為 {other}／{rest}（{percent(other,rest)}）')
    contrast = ('為分清家戶服務與現場維護，以下各取一個區內比例最高的例子：' + '；'.join(examples) + '。'
                '這是從本檔選出的描述性對照，不代表當地實際最嚴重，也不能替整區只指定一種問題。') if examples else ''
    return [common, contrast] if contrast else [common]


def home_summary(data, distribution=None):
    esc = html.escape
    if not distribution:
        return ''.join(f'<p>{esc(text)}</p>' for text in semantic_findings(data))
    page = [f'<p class="service-lead">{esc(DISTRIBUTION_CONCLUSION)}</p>',
            '<p>「找不到可用的桶」可能是位置不順路、入口難辨識、場域不開放，也可能是已有桶卻滿溢。清單多了場所，並不能直接排除這些問題。</p>',
            '<dl class="service-reasoning" aria-label="分清原因的查核路徑">'
            '<div><dt>路徑上沒有可用投放點</dt><dd>先查位置、開放與接收條件，再比較配置或指引。</dd></div>'
            '<div><dt>已有桶，卻常滿或周邊髒亂</dt><dd>查投放負荷、實際清運與清掃；清掃問題不一定出在桶。</dd></div>'
            '<div><dt>規則、時段或處理回應受阻</dt><dd>查接收規則與責任；家戶垃圾車時段另作服務問題處理。</dd></div></dl>',
            '<h4 id="district-service-heading" tabindex="-1">十二區，先查哪一種問題？</h4>',
            '<p class="feedback-note" id="district-service-note">以下是有條件的研究判讀，不是缺桶判定或改善排名。分母為本檔各區全部留言，主題可重疊；行政區標記、事件地點與日期尚未逐則核實。街頭位置列與場域紀錄分開列示，不相加成桶數。</p>',
            '<div class="service-headings" aria-hidden="true"><span>資料範圍</span><span>目前較支持的查核方向</span><span>下一步如何分清原因</span></div>',
            '<ul class="district-service-list" aria-labelledby="district-service-heading" aria-describedby="district-service-note">']
    for district, n in data['districts'].items():
        a = distribution['assessments']['districts'][district]
        bins, venues = distribution['bins'][district]['rows'], len(distribution['venues'][district])
        url = '?' + urlencode({'year': '2026-main', 'district': district + '區'}) + '#map'
        page += [f'<li class="district-service-row" data-service-district="{esc(district)}">'
                 f'<div class="service-district"><h5>{esc(district)}</h5><span>本檔 {n} 則留言</span>'
                 f'<span>街頭位置 {bins} 列</span><span>另有場域 {venues} 筆</span>'
                 f'<a href="{esc(url)}">看{esc(district)}分布</a></div>'
                 f'<div class="service-reading"><h5>{esc(a["reading"])}</h5><p>{esc(a["interpretation"])}</p></div>'
                 f'<div class="service-next"><p><strong>先核對</strong>{esc(a["next"])}</p>'
                 f'<p><strong>分辨依據</strong>{esc(a["check"])}</p></div></li>']
    page += ['</ul>', '<details id="service-method" class="feedback-codebook service-method"><summary>資料補齊後，判讀改變了什麼？</summary>',
             f'<p>{esc(DISTRIBUTION_UPDATE)}</p><p>{esc(VENUE_BOUNDARY)}</p>',
             '<p>本輪由兩個子代理分區回讀全部既有語意短意旨，並以部分原始留言核對情境與反例；沿用原有標註，不是新一輪全量獨立重標。C 類含街道清掃，G 類含制度、費率與陳情，不能直接等同桶的清運或管理失靈。「增設／恢復／保留」也不全是缺桶訴求。</p>',
             '<p>下一步要補有日期的現存及撤除清冊、場域開放與接收條件，再把可確認時間地點的回饋對到路徑、桶況與服務紀錄。沒有這些證據，不能推出各區需要增設多少桶。</p></details>',
             '<p class="feedback-report-entry"><a href="#feedback-cross">看各區語意數據與完整判讀</a> · <a href="#feedback-method">判讀方法與限制</a></p>']
    return '\n'.join(page)


def render(data, distribution=None):
    validate(data)
    total, esc, audit = data['records'], html.escape, data['semantic']['audit']
    quality = data['quality']
    quality_text = (f'{quality["uniqueIds"]:,} 個不重複匿名編號；無空白欄位。'
                    f'{quality["multilineRecords"]} 則內含換行，已依 TSV 引號規則保留為單則。'
                    f'{quality["duplicateTextGroups"]} 組完全相同文字，共有 {quality["duplicateTextExtraRows"]} 則額外重複；全部保留。')
    audit_text = (f'三個子代理分工閱讀全部 {total:,} 則，初判時不提供行政區欄位、心情欄位或另一代理的答案。'
                  f'另取每區 12 則、共 {audit["sampleSize"]} 則做盲判；初判主題組合完全一致 {audit["initialAgreement"]["themes"]} 則，'
                  f'設桶立場一致 {audit["initialAgreement"]["stance"]} 則。'
                  f'共有 {audit["disagreementRows"]} 則在主題、立場或明確度上有分歧，已逐則回讀裁決。'
                  f'因分類界線出現差異，三位原判讀代理再依補充裁決說明回讀全部 {audit["consistencyReviewedRows"]:,} 則；最終有 {audit["changedRows"]} 則分類、立場或明確度改變。'
                  '上述一致數仍是修正前的初判一致性，不是分類正確率，也不是全部留言均由兩位獨立代理複核；補充說明在看到分歧後形成，最終仍需人類研究者確認。')
    correction = '方法修正：原先的關鍵字命中統計已退出本頁問題分析。先前據此解釋北投、內湖、萬華問題的段落已撤回；以下數字只由逐則語意標註加總。'
    md = [f'# {REPORT_TITLE}', '', f'分析整理日：{data["analysisDate"]}（非收集日期）', '', SCOPE, '', correction, '',
          f'## {REPORT_JUDGMENT}', '']
    page = [f'<header class="research-page-heading"><h2 id="feedback-heading">{REPORT_TITLE}</h2><p>逐則理解 {total:,} 則留言，再比較各區問題與訴求。</p><p class="research-update">整理於 {data["analysisDate"]}；收集期間未提供。</p></header>',
            f'<p class="feedback-scope">{esc(SCOPE)}</p><p class="feedback-note">{esc(correction)}</p>',
            '<nav class="feedback-contents" aria-label="留言分析章節"><a href="#feedback-findings">研究判斷</a><a href="#feedback-cross">十二區圖解</a><a href="#feedback-stances">設桶立場</a><a href="#feedback-mechanisms">原因與反例</a><a href="#feedback-method">方法與限制</a></nav>',
            f'<section class="feedback-section" aria-labelledby="feedback-findings"><h3 id="feedback-findings" tabindex="-1">{REPORT_JUDGMENT}</h3>']
    for paragraph in [*semantic_findings(data), *REPORT_INTRO]:
        md += [paragraph, '']; page += [f'<p>{esc(paragraph)}</p>']
    page += ['</section>']
    cross_md, cross_page = render_districts(data, distribution); md += cross_md; page += cross_page
    # Preserve earlier anchor destinations while replacing word-hit content.
    page += ['<section class="feedback-section feedback-appendix" aria-labelledby="feedback-signals"><h3 id="feedback-signals" tabindex="-1">逐則語意判讀：談及的問題與訴求</h3>', f'<p>{esc(METHOD)}</p>']
    md += ['## 逐則語意判讀：談及的問題與訴求', '', METHOD, '', table_markdown([(x['label'], x['count']) for x in data['themes']], total), '']
    page += [f'<figure class="feedback-chart"><figcaption>分母為全部 {total:,} 則留言；一則可跨類，比例不能相加。由零起算。</figcaption><ol>']
    for item in data['themes']:
        count, pct = item['count'], percent(item['count'], total)
        page += [f'<li><div class="feedback-bar-label"><span>{esc(item["label"])}</span><span><strong>{count:,}</strong> 則 · {pct}</span></div><div class="feedback-bar-track" aria-hidden="true"><span style="width:{pct}"></span></div></li>']
    page += ['</ol></figure><details class="feedback-codebook"><summary>查看語意分類界線</summary><dl>']
    for item in data['themes']:
        md += [f'- **{item["label"]}：**{item["definition"]}']
        page += [f'<div><dt>{esc(item["label"])}</dt><dd>{esc(item["definition"])}</dd></div>']
    page += ['</dl></details>']
    uncertain = f'判讀不明確 {data["unclear"]} 則；無法歸入七類 {data["unclassified"]} 則。兩者可能重疊，全部保留在分母，沒有強迫分類。'
    md += ['', uncertain, '']; page += [f'<p class="feedback-note">{esc(uncertain)}</p>']
    page += ['</section><section class="feedback-section" aria-labelledby="feedback-stances"><h3 id="feedback-stances" tabindex="-1">提到垃圾桶，不等於支持增設</h3>']
    stance_note = '以下僅判讀公共／街道垃圾桶的方向；家戶定點收運不自動算成增設公共桶。每則恰有一個立場標籤，分母仍為全檔留言，不是市民支持率。'
    md += ['## 提到垃圾桶，不等於支持增設', '', stance_note, '', table_markdown([(STANCES[k], v) for k,v in data['stances'].items()], total), '']
    page += [f'<p>{esc(stance_note)}</p><table class="feedback-table"><caption>每則一個立場；分母為全檔留言</caption><thead><tr><th scope="col">語意立場</th><th scope="col">則數</th><th scope="col">比例</th></tr></thead><tbody>']
    for key, count in data['stances'].items():
        page += [f'<tr><th scope="row">{esc(STANCES[key])}</th><td>{count:,}</td><td>{percent(count,total)}</td></tr>']
    page += ['</tbody></table></section>']
    depth_md, depth_page = render_depth(); md += depth_md; page += depth_page
    md += ['## 方法與資料缺口', '', audit_text, '', quality_text, '', METHOD_BRIDGE, ''] + [f'- {x}' for x in LIMITS]
    page += ['<section class="feedback-section" aria-labelledby="feedback-method"><h3 id="feedback-method" tabindex="-1">方法與資料缺口</h3>',
             f'<p>{esc(audit_text)}</p><p>{esc(quality_text)}</p><p>{esc(METHOD_BRIDGE)}</p><ul class="feedback-limits">']
    page += [f'<li>{esc(x)}</li>' for x in LIMITS]
    page += ['</ul><p>來源：研究團隊提供的已篩選垃圾相關回饋。原文與逐則標註留在本地，網站僅呈現彙總。</p></section>',
             '<section class="feedback-section feedback-appendix" aria-labelledby="feedback-appendix"><h3 id="feedback-appendix" tabindex="-1">資料附錄：原檔組成</h3>',
             '<h4 id="feedback-overlap" tabindex="-1">一則留言可以談多個問題</h4><p>語意分類可跨類重複，不能以類別總和當作留言人數；舊版詞語交集圖已移除。</p>']
    md += ['', '## 資料附錄：原檔組成', '', '語意分類可跨類重複，不能以類別總和當作留言人數；舊版詞語交集圖已移除。', '']
    for key, title, values, note in [
        ('moods','原檔的心情標籤',sorted(data['moods'].items(),key=lambda x:-x[1]),'沿用原檔，不重新推論情緒；標註方式未知。'),
        ('districts','行政區標記與留言數',list(data['districts'].items()),'行政區是原檔標記，未確認為居住地或事件所在地。'),
        ('topics','原始議題欄位',sorted(data['originalTopics'].items(),key=lambda x:-x[1]),'沿用原議題欄位，並非本次語意分類。')]:
        md += [f'### {title}', '', note, '', table_markdown(values,total), '']
        page += [f'<section class="feedback-section" aria-labelledby="feedback-{key}"><h4 id="feedback-{key}" tabindex="-1">{title}</h4><p>{note}</p><table class="feedback-table"><caption>分母：本檔 {total:,} 則</caption><thead><tr><th scope="col">欄位值</th><th scope="col">則數</th><th scope="col">比例</th></tr></thead><tbody>']
        for label, count in values:
            page += [f'<tr><th scope="row">{esc(label)}</th><td>{count:,}</td><td>{percent(count,total)}</td></tr>']
        page += ['</tbody></table></section>']
    md += ['### 重現與稽核', '', '逐則語意標註是保留的研究輸入，不由程式猜測。三份初判、獨立盲判、裁決理由與最終標註均在本地保存；不納入 Git、網站或研究包。只有彙總不能重做語意判讀。', '',
           '在網站目錄執行：', '', '```sh', 'python3 scripts/analyze-feedback.py --input /private/source.tsv --annotations /private/final.jsonl --initial /private/initial.jsonl --double-coded /private/blind.jsonl --resolutions /private/resolutions.json --protocol /private/protocol.md --manifest /private/manifest.json', 'python3 scripts/package-research.py', '```', '',
           '省略全部私有輸入參數時，只從保存的 `summary.json` 重建網頁與 Markdown。', '', f'原始來源 SHA-256：`{data["source"]["sha256"]}`。', '',
           f'最終標註 SHA-256：`{data["semantic"]["annotationSha256"]}`。', '', '[分類規約](semantic-protocol.md)、[事後裁決說明](semantic-adjudication-notes.md)與 [summary.json](summary.json)保留方法、彙總與抽樣一致性；雜湊用於對照本地保留的輸入，不能取代輸入本身。', '']
    page += ['<p><a href="#feedback-cross">回到行政區語意比較</a> · <a href="#research">回到首頁研究結論</a></p></section>']
    return '\n'.join(md), '\n'.join(page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ('input', 'annotations', 'initial', 'double-coded', 'resolutions', 'protocol', 'manifest'):
        parser.add_argument('--' + name, type=Path)
    args = parser.parse_args()
    inputs = [args.input, args.annotations, args.initial, args.double_coded, args.resolutions, args.protocol, args.manifest]
    if any(inputs) and not all(inputs):
        parser.error('Recalculation requires the original input, complete semantic annotations, initial labels, blind sample, adjudications and protocol')
    canonical = ROOT.parent.parent / 'topics/bins/research'
    folder = (canonical if canonical.is_dir() else ROOT / 'research') / FOLDER
    summary_path = folder / 'summary.json'
    if all(inputs):
        data = analyze(*inputs)
        if args.protocol.read_bytes() != (folder / 'semantic-protocol.md').read_bytes():
            raise ValueError('The retained coding protocol differs from the versioned protocol')
    else:
        data = json.loads(summary_path.read_text())
    validate(data)
    if hashlib.sha256((folder / 'semantic-protocol.md').read_bytes()).hexdigest() != data['semantic']['protocolSha256']:
        raise ValueError('Saved summary protocol does not match preserved coding protocol')
    if hashlib.sha256((folder / 'semantic-adjudication-notes.md').read_bytes()).hexdigest() != data['semantic']['reviewNotesSha256']:
        raise ValueError('Saved summary does not match the retained adjudication notes')
    distribution = load_distribution(data)
    markdown, content = render(data, distribution)
    (folder.parent / DISTRIBUTION_FOLDER / 'README.md').write_text(distribution_report(data, distribution))
    index = ROOT / 'dist/index.html'
    page, count = re.subn(r'<!-- feedback-analysis-start -->.*?<!-- feedback-analysis-end -->',
                         lambda _: '<!-- feedback-analysis-start -->\n' + content + '\n<!-- feedback-analysis-end -->', index.read_text(), flags=re.S)
    if count != 1: raise ValueError('Expected one feedback panel marker')
    page, count = re.subn(r'<!-- feedback-problem-map-start -->.*?<!-- feedback-problem-map-end -->',
                         lambda _: '<!-- feedback-problem-map-start -->\n' + home_summary(data, distribution) + '\n<!-- feedback-problem-map-end -->', page, flags=re.S)
    if count != 1: raise ValueError('Expected one homepage summary marker')
    if all(inputs): summary_path.write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
    (folder / 'README.md').write_text(markdown)
    index.write_text(page)
    print(f'Rendered {data["records"]} messages from retained semantic judgments')


if __name__ == '__main__':
    main()

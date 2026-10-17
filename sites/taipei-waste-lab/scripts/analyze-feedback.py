"""Reproduce aggregate observations; never publish or package individual feedback."""
import argparse
import csv
import hashlib
import html
import json
import re
import unicodedata
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER = 'feedback-2026-10-17'
FIELDS = ['匿名編號', '行政區', '原議題', '心情', '去識別內容']
# Frozen literal indicators, not semantic labels or policy positions.
CODEBOOK = [
    ('bins', '垃圾桶／清潔箱', ['垃圾桶', '垃圾筒', '清潔箱']),
    ('truck', '垃圾車', ['垃圾車']),
    ('household', '家戶垃圾', ['家庭垃圾', '家戶垃圾', '居家垃圾', '家用垃圾']),
    ('dropoff', '定點／彈性投放', ['定點', '固定地點', '24小時', '二十四小時', '隨時丟', '隨時倒']),
    ('litter', '亂丟／隨地丟棄', ['亂丟', '亂扔', '隨地', '隨手丟', '隨手扔']),
    ('pests', '鼠蟲／異味', ['老鼠', '鼠患', '蟑螂', '蚊蟲', '惡臭', '臭味', '異味']),
    ('cigarettes', '菸蒂／菸頭', ['菸蒂', '煙蒂', '菸頭', '煙頭']),
    ('recycling', '回收／廚餘', ['回收', '廚餘']),
]
SCOPE = '這份資料是台北市意見回饋中篩出的垃圾相關訊息。分析單位是一則留言；比例只描述這批留言，不代表全體意見回饋或台北市民意。'
METHOD = '文字線索採固定詞表比對：先做 Unicode NFKC 正規化、移除空白，再檢查是否包含任一詞。每則留言在同組最多計一次，可跨組重複；比例不能相加。這不是逐則語意分類，不辨識否定、支持或反對，也可能漏掉同義詞。'
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
     '希望恢復垃圾桶與反對住宅旁設桶的意見並存。這批資料沒有逐則立場編碼，不能宣稱任何一方是多數。',
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
    '本文先區分三種情境，再追問原因與反例，最後把假說收斂成可執行的查核順序。留言是人工歸納與改寫摘述，本次未量化各立場人數，也未驗證現場；像「撤桶導致髒亂」這樣的描述，仍需核對時間順序與其他變化。',
]
SCENARIO_BRIDGE = '分開情境，是為了確認服務在哪一段難以使用。接下來要追問：路徑太遠、時段不合，還是到了現場仍不能投放？同樣的「不好丟」，可能需要不同的改善。'
SHARED_BRIDGE = '位置、時段與維護之外，還有兩件事要與每種改善一起檢查：依照指引分類後，現場是否能接收；投放更方便之後，住戶、店家與清潔人員是否承擔更多負擔。'
LOOP_BRIDGE = '前面的問題也可能相互影響。合法投放不易使用，可能讓垃圾轉往其他地點，增加維護壓力，再引發限縮或撤點。但本批留言沒有證明這些事件曾在同一地點依序發生；下圖用來決定要查什麼，不代表已成立的因果。'
VALIDATION_BRIDGE = '要判斷圖中的關係是否存在，先把留言連到可核對的時間、地點與服務，再建立現場基準。接著才比較一項調整，並同時檢查使用者、鄰近地點與清潔人員的結果。以下順序是建議，尚未執行。'
METHOD_BRIDGE = '目前最重要的資料缺口，是逐則事件時間與核實位置、實際服務時間、投放負荷、巡收及成本。缺少這些資料，仍無法區分位置、時間、容量與維護等解釋，也不能提出設點排名或成效估計。'


def home_summary():
    return ('<p>本批回饋提示：行人沿途的投放、家戶作息與收運的配合，以及投放點的持續維護，需要分開查核。分類接收與鄰近環境負擔，則要和每一種改善一起評估。</p>'
            '<p>完整分析把這些情境串成「可能原因與反例 → 所需證據 → 驗證與決策」。目前仍是待查假說，尚未證明增桶、撤桶或調整收運的成效。</p>'
            '<p>行政區交叉分析進一步指出可查核的差異：北投的投放時段、內湖的家戶與分類接收、萬華的街面維護。這是本檔文字結構的對照，尚不能排成各區改善優先序。</p>'
            '<p class="feedback-report-entry"><a href="#feedback-findings">閱讀完整分析與圖解</a> · <a href="#feedback-cross">看行政區交叉分析</a></p>')


def render_depth():
    esc = html.escape
    md = ['## 先辨認三種服務情境', '',
          '行人投放與家戶收運是兩種不同使用情境；現場維護則決定投放點能否持續可用。下面把留言線索整理成查核問題，箭頭表示查核順序，不是人數分群或因果證明。', '',
          '| 留言情境 | 先分辨 | 要補的證據 |', '| --- | --- | --- |']
    for _, label, scene, gap, check in PROBLEM_PATHS:
        md += [f'| {label}：{scene} | {gap} | {check} |']
    md += ['', SCENARIO_BRIDGE, '', '## 從情境追問原因與反例', '',
           '以下以可達性、住宅負擔、時段、維護、垃圾來源及分類衝突為線索做目的抽樣閱讀，並保留反例；不是隨機抽樣，也未逐則語意編碼全部留言。可能機制與其他解釋均待驗證，未計算各問題的人數或發生率。', '']
    page = ['<section class="feedback-section" aria-labelledby="feedback-problems"><h3 id="feedback-problems" tabindex="-1">先辨認三種服務情境</h3>',
            '<p>行人投放與家戶收運是兩種不同使用情境；現場維護則決定投放點能否持續可用。下面把留言線索整理成查核問題，箭頭表示查核順序。</p>',
            problem_map(), f'<p>{esc(SCENARIO_BRIDGE)}</p></section>',
            '<section class="feedback-section" aria-labelledby="feedback-mechanisms"><h3 id="feedback-mechanisms" tabindex="-1">從情境追問原因與反例</h3>',
            '<p class="feedback-note">以下以問題線索做目的抽樣閱讀並保留反例，未逐則語意編碼全部留言。「留言線索」是人工改寫摘述；可能機制與其他解釋都是待查假說，未計算各問題的人數或發生率。</p>']
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


def render_overlap(data):
    esc = html.escape
    counts = {item['id']: item['count'] for item in data['indicators']}
    both = data['binAndTruck']
    cells = [both, counts['bins'] - both, counts['truck'] - both,
             data['records'] - counts['bins'] - counts['truck'] + both]
    if min(cells) < 0 or sum(cells) != data['records']:
        raise ValueError('Invalid bin/truck overlap aggregates')
    note = ('四格互斥、合計涵蓋本檔全部留言；「未命中」只指這兩組詞，不是沒有垃圾問題。'
            '格子面積相同，不表示數量相同。這是詞語交集，不是需求分群、政策立場或因果關係。')
    interpretation = '即使兩類用詞只在部分留言重疊，也不能說兩類需求彼此獨立。一個人可遇到多種困擾，留言也可能省略服務名稱。方案判斷仍要回到具體情境。'
    md = ['### 桶詞與垃圾車的文字交集', '', METHOD, '', note, '',
          '| 文字命中 | 有垃圾車 | 無垃圾車 |', '| --- | ---: | ---: |',
          f'| 有桶詞 | {cells[0]:,} | {cells[1]:,} |', f'| 無桶詞 | {cells[2]:,} | {cells[3]:,} |', '',
          f'分母：本檔 {data["records"]:,} 則；桶詞為「垃圾桶、垃圾筒、清潔箱」。', '', interpretation, '']
    page = ['<section class="feedback-section" aria-labelledby="feedback-overlap"><h4 id="feedback-overlap" tabindex="-1">桶詞與垃圾車的文字交集</h4>',
            f'<p>依原有固定詞表重看兩種用詞。分母是本檔 {data["records"]:,} 則；桶詞為「垃圾桶、垃圾筒、清潔箱」，仍不辨識支持、反對或否定。</p>',
            '<figure class="feedback-overlap"><figcaption>桶詞 × 垃圾車：每則留言恰落在一格</figcaption>',
            '<table><thead><tr><th scope="col">文字命中</th><th scope="col">有垃圾車</th><th scope="col">無垃圾車</th></tr></thead><tbody>',
            f'<tr><th scope="row">有桶詞</th><td class="overlap-both"><strong>{cells[0]:,}</strong><span>兩者都有</span></td><td><strong>{cells[1]:,}</strong><span>只有桶詞</span></td></tr>',
            f'<tr><th scope="row">無桶詞</th><td><strong>{cells[2]:,}</strong><span>只有垃圾車</span></td><td><strong>{cells[3]:,}</strong><span>兩者皆未命中</span></td></tr>',
            f'</tbody></table><p class="feedback-note">{esc(note)}</p></figure><p>{esc(interpretation)}</p></section>']
    return md, page



def normalized(text):
    return re.sub(r'\s+', '', unicodedata.normalize('NFKC', text)).lower()


def indicators(text):
    value = normalized(text)
    return {key for key, _, terms in CODEBOOK
            if any(normalized(term) in value for term in terms)}


def analyze(path):
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
    ids = Counter(row[0] for row in rows)
    if max(ids.values()) > 1:
        raise ValueError('Duplicate anonymous IDs require an explicit analysis decision')
    texts = Counter(row[4] for row in rows)
    matches = [indicators(row[4]) for row in rows]
    district_matches = {}
    for row, group in zip(rows, matches):
        district = district_matches.setdefault(row[1], {
            'counts': {key: 0 for key, _, _ in CODEBOOK}, 'noIndicatorMatch': 0})
        for key in group:
            district['counts'][key] += 1
        district['noIndicatorMatch'] += not group
    return {
        'schemaVersion': 2,
        'districtIndicators': district_matches,
        'analysisDate': '2026-10-17',
        'source': {'name': 'Pasted text.txt', 'sha256': hashlib.sha256(payload).hexdigest(),
                   'frame': SCOPE, 'collectionPeriod': None, 'recruitment': None,
                   'selectionRules': None, 'allFeedbackCount': None},
        'records': len(rows),
        'quality': {'uniqueIds': len(ids), 'missingCells': 0,
                    'multilineRecords': sum('\n' in row[4] or '\r' in row[4] for row in rows),
                    'duplicateTextGroups': sum(count > 1 for count in texts.values()),
                    'duplicateTextExtraRows': sum(count - 1 for count in texts.values())},
        'districts': dict(Counter(row[1] for row in rows)),
        'moods': dict(Counter(row[3] for row in rows)),
        'originalTopics': dict(Counter(row[2] for row in rows)),
        'indicators': [{'id': key, 'label': label, 'terms': list(dict.fromkeys(terms)),
                        'count': sum(key in group for group in matches)}
                       for key, label, terms in CODEBOOK],
        'noIndicatorMatch': sum(not group for group in matches),
        'binAndTruck': sum({'bins', 'truck'} <= group for group in matches),
    }


def percent(value, total):
    return f'{value / total * 100:.1f}%'



def validate_districts(data):
    """Cross-tabs require retained input; marginals cannot reconstruct them."""
    groups = data.get('districtIndicators')
    if data.get('schemaVersion') != 2 or not isinstance(groups, dict):
        raise ValueError('District cross-tab missing: rerun with the retained private input using --input')
    totals = data['districts']
    keys = {item['id'] for item in data['indicators']}
    if set(groups) != set(totals) or sum(totals.values()) != data['records']:
        raise ValueError('District denominator mismatch')
    for district, n in totals.items():
        row = groups[district]
        counts = row['counts']
        unmatched = row['noIndicatorMatch']
        if type(n) is not int or n <= 0 or set(counts) != keys:
            raise ValueError('Invalid district denominator or indicator keys')
        if any(type(value) is not int or not 0 <= value <= n
               for value in [*counts.values(), unmatched]):
            raise ValueError('District counts must be integers within the denominator')
        if not max(counts.values()) <= n - unmatched <= sum(counts.values()):
            raise ValueError('District unmatched count is inconsistent')
    for item in data['indicators']:
        if sum(row['counts'][item['id']] for row in groups.values()) != item['count']:
            raise ValueError('District indicator columns do not reconcile')
    if sum(row['noIndicatorMatch'] for row in groups.values()) != data['noIndicatorMatch']:
        raise ValueError('District unmatched total does not reconcile')


def district_comparison(data, district, key):
    count = data['districtIndicators'][district]['counts'][key]
    n = data['districts'][district]
    total = next(item['count'] for item in data['indicators'] if item['id'] == key)
    rest_count, rest_n = total - count, data['records'] - n
    difference = 100 * (count / n - rest_count / rest_n) if rest_n else None
    return count, n, rest_count, rest_n, difference


def render_districts(data):
    validate_districts(data)
    esc = html.escape
    indicators = data['indicators']
    title = '行政區與問題線索：差異在哪裡，接下來查什麼'
    framing = ('各區樣本量不同，先看區內比例，再保留筆數核對。分母是該行政區標記在本檔的全部留言，'
               '包含未命中詞表的留言；不是人口、各區完整回饋數或已核實事件數。'
               '行政區標記尚未確認為居住地或事件所在地，以下不能用來排名問題嚴重度。')
    method = ('沿用上方八組固定詞表，一則留言可命中多組，橫列比例不能相加。'
              '含否定句仍會命中；零表示沒有命中這組詞，不表示該區沒有問題。'
              '各格細條皆以 0–100% 為同一尺度；數字為命中則數及占該區留言比例。')
    md = [f'### {title}', '', framing, '', method, '',
          '| 行政區（本檔則數） | ' + ' | '.join(item['label'] for item in indicators) + ' |',
          '| --- | ' + ' | '.join(['---:'] * len(indicators)) + ' |']
    page = [f'<section class="feedback-section feedback-cross" aria-labelledby="feedback-cross"><h4 id="feedback-cross" tabindex="-1">{title}</h4>',
            f'<p>{esc(framing)}</p><p id="feedback-cross-method" class="feedback-note">{esc(method)}</p>',
            '<p class="feedback-scroll-hint">窄螢幕可左右捲動表格；行政區欄固定在左側。鍵盤可聚焦表格區域後使用方向鍵。</p>',
            '<div class="feedback-matrix-scroll" role="region" aria-label="行政區與八組文字線索交叉表，可左右捲動" tabindex="0" aria-describedby="feedback-cross-method">',
            '<table class="feedback-matrix"><caption>行政區 × 文字線索 · 每格為則數／區內比例</caption><thead><tr><th scope="col">行政區<br>本檔則數</th>']
    page += [f'<th scope="col">{esc(item["label"])}</th>' for item in indicators]
    page += ['</tr></thead><tbody>']
    for district, n in data['districts'].items():
        counts = data['districtIndicators'][district]['counts']
        cells = [f'{counts[item["id"]]}（{percent(counts[item["id"]], n)}）' for item in indicators]
        md += [f'| {district}（{n}） | ' + ' | '.join(cells) + ' |']
        page += [f'<tr><th scope="row">{esc(district)}<small>{n:,} 則</small></th>']
        for item in indicators:
            count = counts[item['id']]
            pct = percent(count, n)
            page += [f'<td data-district="{esc(district)}" data-indicator="{esc(item["id"])}"><strong>{count} 則</strong><span>{pct}</span><i aria-hidden="true" style="width:{pct}"></i></td>']
        page += ['</tr>']
    page += ['</tbody></table></div>']
    coverage = '各區未命中任何一組詞的則數（仍計入分母）：' + '、'.join(
        f'{district} {row["noIndicatorMatch"]}' for district, row in data['districtIndicators'].items()) + '。'
    md += ['', coverage, '']
    page += [f'<p class="feedback-note">{esc(coverage)}</p>']

    # These descriptive contrasts follow the report's service questions, not a significance ranking.
    selected = [('北投', 'dropoff'), ('北投', 'truck'), ('內湖', 'household'),
                ('內湖', 'recycling'), ('萬華', 'litter'), ('萬華', 'bins')]
    if {'北投', '內湖', '萬華', '大安'} <= set(data['districts']):
        comparison_note = ('下表依投放時段、家戶分流與街面維護選取六個對照，並非差異排名或顯著性檢定。'
                           '「其餘各區」排除該區，合併其餘留言作分母；差值＝區內比例−其餘各區比例，'
                           '單位為百分點，以未四捨五入的比例計算後取一位小數。')
        md += ['#### 把地區差異轉成查核問題', '', comparison_note, '',
               '| 行政區／文字線索 | 本區：則數／分母（比例） | 其餘各區：則數／分母（比例） | 差值（百分點） |',
               '| --- | ---: | ---: | ---: |']
        page += ['<h5 class="feedback-cross-heading">把地區差異轉成查核問題</h5>', f'<p>{esc(comparison_note)}</p>',
                 '<div class="feedback-comparison-scroll" role="region" aria-label="六個情境對照，可左右捲動" tabindex="0"><table class="feedback-table feedback-comparison"><caption>比較基準僅為本檔其餘各區的留言</caption><thead><tr><th scope="col">行政區／線索</th><th scope="col">本區</th><th scope="col">其餘各區</th><th scope="col">差值<br>百分點</th></tr></thead><tbody>']
        labels = {item['id']: item['label'] for item in indicators}
        for district, key in selected:
            count, n, rest_count, rest_n, difference = district_comparison(data, district, key)
            local = f'{count}／{n}（{percent(count, n)}）'
            other = f'{rest_count}／{rest_n}（{percent(rest_count, rest_n)}）'
            delta = f'{difference:+.1f}'
            label = f'{district}／{labels[key]}'
            md += [f'| {label} | {local} | {other} | {delta} |']
            page += [f'<tr><th scope="row">{esc(label)}</th><td>{local}</td><td>{other}</td><td>{delta}</td></tr>']
        page += ['</tbody></table></div>']
        daan = data['districtIndicators']['大安']['counts']['truck']
        beitou = data['districtIndicators']['北投']['counts']['truck']
        volume = (f'筆數與比例回答不同問題。例如垃圾車詞在大安有 {daan} 則、北投有 {beitou} 則，'
                  f'但分別占兩區留言的 {percent(daan, data["districts"]["大安"])} 與 {percent(beitou, data["districts"]["北投"])}。'
                  '直接比較筆數會受到收集量影響；改用區內比例仍不能排除招募與篩選差異。')
        notes = [volume,
                 '北投可先查投放時段與替代管道：定點／彈性投放和垃圾車詞的區內比例較其餘各區高。應逐則核對是在描述可用時段、距離、噪音，還是其他情況；兩組比例不能當成同一批人的共同需求。',
                 '內湖可先查家戶垃圾與分類接收：家戶垃圾、回收／廚餘詞的區內比例較高。這兩組詞沒有區分支持、反對、混投或接收困難，需回讀語意並核對現場，才能判斷應查分流、指引還是收運。',
                 '萬華可先查街面垃圾的來源與維護：亂丟詞比例較高，但垃圾桶詞比例較低。這個組合不能證明缺桶或撤桶造成亂丟，也不能推定兩者出現在同一留言；需核對垃圾類別、事件位置、時間與實際巡收。',
                 '下一步先做各區同一套語意複核：區分描述的事件、支持或反對、實際地點與服務情境，再以相同標準抽查未命中留言，確認詞表漏抓。定點／彈性投放等低筆數線索尤其需要回讀，不因比例較高就優先部署。取得各區完整回饋數、招募與篩選規則後，才能判斷差異是否主要來自資料收集；現場比較仍需另外建立基準。']
        for note in notes:
            md += ['', note]
            page += [f'<p>{esc(note)}</p>']
    md += ['']
    page += ['<p><a href="#feedback-method">核對資料缺口與限制</a> · <a href="#feedback-validation">接回現場驗證順序</a></p></section>']
    return md, page


def table_markdown(values, total):
    return '\n'.join(['| 欄位值 | 則數 | 占本檔比例 |', '| --- | ---: | ---: |'] +
                     [f'| {key} | {value:,} | {percent(value, total)} |' for key, value in values])


def render(data):
    total = data['records']
    esc = html.escape
    quality = data['quality']
    negative = sum(data['moods'].get(key, 0) for key in ('生氣', '無奈', '擔心'))
    intro = (f'本檔共 {total:,} 則留言，涵蓋 {len(data["districts"])} 個行政區標記。'
             f'心情標為「生氣、無奈、擔心」的合計 {negative:,} 則（{percent(negative, total)}）；'
             '這表示本檔集中呈現困擾，不能推算市民不滿意比例。')
    quality_text = (f'{quality["uniqueIds"]:,} 個不重複匿名編號；無空白欄位。'
                    f'{quality["multilineRecords"]} 則內含換行，已依 TSV 引號規則合併為單一紀錄。'
                    f'有 {quality["duplicateTextGroups"]} 組完全相同文字，比每組留一則多 {quality["duplicateTextExtraRows"]} 則；全部保留，未按文字去重。')
    datasets = [
        ('signals', '留言出現哪些文字線索', [(item['label'], item['count']) for item in sorted(data['indicators'], key=lambda x: -x['count'])], METHOD),
        ('moods', '原檔的心情標籤', sorted(data['moods'].items(), key=lambda x: -x[1]), '這是原檔提供的心情欄位，未重新做情緒推論；標註方式未知。'),
        ('districts', '這批留言來自哪些行政區標記', list(data['districts'].items()), '順序沿用原檔首次出現次序。件數反映本檔組成，不是各區垃圾問題嚴重度或人口占比。'),
        ('topics', '原先被歸在哪些議題', sorted(data['originalTopics'].items(), key=lambda x: -x[1]), '沿用原議題欄位；垃圾相關訊息也可能被歸到交通、觀光等議題。'),
    ]
    md = [f'# {REPORT_TITLE}', '', f'分析整理日：{data["analysisDate"]}（非收集日期）', '', SCOPE, '',
          f'分析基礎：本檔 {total:,} 則留言；五個查核問題未逐則語意編碼，現場與因果尚未驗證。', '',
          f'## {REPORT_JUDGMENT}', '']
    page = [f'<header class="research-page-heading"><h2 id="feedback-heading">{esc(REPORT_TITLE)}</h2>',
            f'<p>從 {total:,} 則垃圾相關留言，整理服務困擾、可能原因與驗證順序。</p>',
            f'<p class="research-update">整理於 {data["analysisDate"]}；收集期間未提供，非即時現場盤點。</p></header>',
            f'<p class="feedback-scope">{esc(SCOPE)}</p>',
            '<nav class="feedback-contents" aria-label="留言分析章節"><a href="#feedback-findings">研究判斷</a><a href="#feedback-problems">三種情境</a><a href="#feedback-mechanisms">原因與反例</a><a href="#feedback-loop">驗證順序</a><a href="#feedback-method">資料與限制</a><a href="#feedback-cross">行政區交叉分析</a></nav>',
            f'<section class="feedback-section" aria-labelledby="feedback-findings"><h3 id="feedback-findings" tabindex="-1">{esc(REPORT_JUDGMENT)}</h3>']
    for paragraph in REPORT_INTRO:
        md += [paragraph, '']
        page += [f'<p>{esc(paragraph)}</p>']
    page += ['</section>']
    depth_md, depth_page = render_depth()
    md += depth_md
    page += depth_page
    md += ['## 這份資料能說到哪裡', '', METHOD_BRIDGE, '', quality_text, ''] + [f'- {item}' for item in LIMITS]
    page += ['<section class="feedback-section" aria-labelledby="feedback-method"><h3 id="feedback-method" tabindex="-1">這份資料能說到哪裡</h3>',
             f'<p>{esc(METHOD_BRIDGE)}</p><p>{esc(quality_text)}</p><ul class="feedback-limits">']
    page += [f'<li>{esc(item)}</li>' for item in LIMITS]
    page += ['</ul><p class="feedback-note">來源：研究團隊提供的垃圾相關意見回饋檔。分析以本次保存的檔案為準，未與公開清潔箱清冊逐筆連結。</p>',
             '<p>到這裡，本文的研究判斷是：先找出能核實的服務情境，對照不同解釋，再用現場基準決定改善。下方附錄保留本檔的文字線索與組成，供核對分析基礎。</p>',
             '<p><a href="#research">回到首頁研究結論</a> · <a href="#sources">查看公開資料與文獻</a> · <a href="#feedback-appendix">繼續核對資料附錄</a></p></section>',
             '<section class="feedback-section feedback-appendix" aria-labelledby="feedback-appendix"><h3 id="feedback-appendix" tabindex="-1">資料附錄：文字線索與留言組成</h3>',
             '<p>以下統計描述這份已篩選檔案的內容，不是前述五個問題的盛行率，也不能用來排序各區需求。</p>', f'<p>{esc(intro)}</p>']
    md += ['', '## 資料附錄：文字線索與留言組成', '',
           '以下統計描述這份已篩選檔案的內容，不是前述五個問題的盛行率，也不能用來排序各區需求。', '', intro, '']
    overlap_md, overlap_page = render_overlap(data)
    md += overlap_md
    page += overlap_page
    for key, title, values, note in datasets:
        md += [f'### {title}', '', note, '', f'分母：本檔 {total:,} 則留言。', '', table_markdown(values, total), '']
        page += [f'<section class="feedback-section" aria-labelledby="feedback-{key}"><h4 id="feedback-{key}" tabindex="-1">{title}</h4><p>{esc(note)}</p>']
        if key in ('signals', 'moods'):
            page += [f'<figure class="feedback-chart"><figcaption>每條長度以本檔 {total:,} 則為 100%；由零起算。</figcaption><ol>']
            for label, count in values:
                pct = percent(count, total)
                page += [f'<li><div class="feedback-bar-label"><span>{esc(label)}</span><span><strong>{count:,}</strong> 則 · {pct}</span></div><div class="feedback-bar-track" aria-hidden="true"><span style="width:{pct}"></span></div></li>']
            page += ['</ol></figure>']
        else:
            page += [f'<table class="feedback-table"><caption>分母：本檔 {total:,} 則留言</caption><thead><tr><th scope="col">欄位值</th><th scope="col">則數</th><th scope="col">占本檔比例</th></tr></thead><tbody>']
            for label, count in values:
                page += [f'<tr><th scope="row">{esc(label)}</th><td>{count:,}</td><td>{percent(count,total)}</td></tr>']
            page += ['</tbody></table>']
        if key == 'signals':
            extra = f'有 {data["noIndicatorMatch"]:,} 則未命中以上詞表；未命中不代表沒有相關困擾。同時命中「垃圾桶／清潔箱」與「垃圾車」的有 {data["binAndTruck"]:,} 則。'
            md += [extra, '', '#### 詞表', '']
            page += [f'<p class="feedback-note">{esc(extra)}</p><details class="feedback-codebook"><summary>查看固定詞表與計數方式</summary><p>只計是否出現，不計重複出現次數；含否定的句子也會命中。</p><dl>']
            for item in data['indicators']:
                terms = '、'.join(item['terms'])
                md += [f'- {item["label"]}：{terms}']
                page += [f'<div><dt>{esc(item["label"])}</dt><dd>{esc(terms)}</dd></div>']
            md += ['']
            page += ['</dl></details>']
        page += ['</section>']
        if key == 'signals':
            cross_md, cross_page = render_districts(data)
            md += cross_md
            page += cross_page
    md += ['', '### 重現方式', '', '原始輸入由提供者在本地保存，未納入 Git、網站或離線研究包。請使用保留的原始檔重算；僅有摘要無法重做文字比對。', '',
           '在 `sites/taipei-waste-lab` 執行（離線包則在解壓根目錄）：', '',
           '```sh', 'python3 scripts/analyze-feedback.py --input "/absolute/path/to/Pasted text.txt"', 'python3 scripts/package-research.py', '```', '',
           '不提供 `--input` 時，只從保存的 `summary.json` 重建 Markdown 與網頁。完整資料建置也會執行此步驟，不需要原始留言。', '',
           f'原始檔 SHA-256：`{data["source"]["sha256"]}`。', '', '彙總檔：[summary.json](summary.json)。每次變更詞表都須重新提供原始輸入；程式拒絕用舊摘要搭配新詞表。', '']
    page += ['<p class="feedback-appendix-return"><a href="#feedback-findings">回到本文研究判斷</a> · <a href="#research">回到首頁研究結論</a></p></section>']
    return '\n'.join(md), '\n'.join(page)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input', type=Path, help='Private original TSV; omitted for aggregate-only rendering')
    args = parser.parse_args()
    canonical = ROOT.parent.parent / 'topics/bins/research'
    research = canonical if canonical.is_dir() else ROOT / 'research'
    folder = research / FOLDER
    folder.mkdir(parents=True, exist_ok=True)
    summary_path = folder / 'summary.json'
    if args.input:
        data = analyze(args.input)
        summary_path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    data = json.loads(summary_path.read_text(encoding='utf-8'))
    expected = [(key, label, list(dict.fromkeys(terms))) for key, label, terms in CODEBOOK]
    actual = [(item['id'], item['label'], item['terms']) for item in data['indicators']]
    if expected != actual:
        raise ValueError('Codebook changed: rerun with the retained private input')
    if any(sum(data[key].values()) != data['records'] for key in ('districts', 'moods', 'originalTopics')):
        raise ValueError('Aggregate denominator mismatch')
    markdown, content = render(data)
    index = ROOT / 'dist/index.html'
    page, count = re.subn(r'<!-- feedback-analysis-start -->.*?<!-- feedback-analysis-end -->',
                          lambda _: '<!-- feedback-analysis-start -->\n' + content + '\n<!-- feedback-analysis-end -->',
                          index.read_text(encoding='utf-8'), flags=re.S)
    if count != 1:
        raise ValueError('Expected one feedback panel marker')
    (folder / 'README.md').write_text(markdown, encoding='utf-8')
    page, count = re.subn(r'<!-- feedback-problem-map-start -->.*?<!-- feedback-problem-map-end -->',
                          lambda _: '<!-- feedback-problem-map-start -->\n' + home_summary() + '\n<!-- feedback-problem-map-end -->',
                          page, flags=re.S)
    if count != 1:
        raise ValueError('Expected one homepage problem map marker')
    index.write_text(page, encoding='utf-8')
    print(f'Rendered {data["records"]} feedback records as aggregate-only analysis')


if __name__ == '__main__':
    main()

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
FINDINGS = [
    ('先把兩種服務需求分開', '留言摘述同時出現外出時難找投放處，以及上班、輪班或照顧安排難以配合垃圾車的情境。前者涉及行人服務，後者涉及家戶收運；不能用同一種桶或同一個數量指標代替兩者。', '先分別確認行人投放路徑、家戶收運時段與可用替代管道。'),
    ('有桶與乾淨，需要一起檢查', '有人希望增設或恢復垃圾桶，也有人擔心家戶垃圾混入、滿溢與鼠蟲，甚至主張減少住宅附近的桶。這些立場可並存；本次未量化各立場人數。', '把桶的可達性、容量、周邊清潔、清運間隔與垃圾來源分開記錄。'),
    ('把回饋轉成待驗證的問題', '留言中還有菸蒂、回收與廚餘等議題。文字可以提示查核方向，但留言中「撤桶導致髒亂」的敘述，尚不能證明時間順序、現場狀況或因果關係。', '先核對具體場景與服務紀錄，再評估設點、維護或收運調整。不要用本檔行政區件數排序設置優先度。'),
]
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


def render_depth(data):
    esc = html.escape
    counts = {item['id']: item['count'] for item in data['indicators']}
    both = data['binAndTruck']
    cells = [both, counts['bins'] - both, counts['truck'] - both,
             data['records'] - counts['bins'] - counts['truck'] + both]
    if min(cells) < 0 or sum(cells) != data['records']:
        raise ValueError('Invalid bin/truck overlap aggregates')
    overlap_note = ('四格互斥、合計涵蓋本檔全部留言；「未命中」只指這兩組詞，不是沒有垃圾問題。'
                    '格子面積相同，不表示數量相同。這是詞語交集，不是需求分群、政策立場或因果關係。')
    md = ['## 問題分流：先確定是哪一段服務失效', '',
          '以下以本批留言的人工歸納提出查核架構；未逐則編碼需求或立場，也未驗證現場。箭頭表示查核順序。', '',
          '| 留言情境 | 先分辨 | 要補的證據 |', '| --- | --- | --- |']
    for _, label, scene, gap, check in PROBLEM_PATHS:
        md += [f'| {label}：{scene} | {gap} | {check} |']
    md += ['', '## 詞語交集：提到桶，不等於只需要桶', '', METHOD, '', overlap_note, '',
           '| 文字命中 | 有垃圾車 | 無垃圾車 |', '| --- | ---: | ---: |',
           f'| 有桶詞 | {cells[0]:,} | {cells[1]:,} |', f'| 無桶詞 | {cells[2]:,} | {cells[3]:,} |', '',
           f'分母：本檔 {data["records"]:,} 則；桶詞為「垃圾桶、垃圾筒、清潔箱」。', '',
           '即使兩類用詞只在部分留言重疊，也不能說兩類需求彼此獨立。一個人可遇到多種困擾，留言也可能省略服務名稱。方案判斷仍要回到具體情境。', '']
    page = ['<section class="feedback-section" aria-labelledby="feedback-problems"><h3 id="feedback-problems" tabindex="-1">先確定是哪一段服務失效</h3>',
            '<p>把「哪裡能丟、何時能丟、誰能維持可用」分開查核，才能知道配置、收運或維護各要改什麼。</p>', problem_map(), '</section>',
            '<section class="feedback-section" aria-labelledby="feedback-overlap"><h3 id="feedback-overlap" tabindex="-1">提到桶，不等於只需要桶</h3>',
            f'<p>依原有固定詞表重看兩種用詞。分母是本檔 {data["records"]:,} 則；桶詞為「垃圾桶、垃圾筒、清潔箱」，仍不辨識支持、反對或否定。</p>',
            '<figure class="feedback-overlap"><figcaption>桶詞 × 垃圾車：每則留言恰落在一格</figcaption>',
            '<table><thead><tr><th scope="col">文字命中</th><th scope="col">有垃圾車</th><th scope="col">無垃圾車</th></tr></thead><tbody>',
            f'<tr><th scope="row">有桶詞</th><td class="overlap-both"><strong>{cells[0]:,}</strong><span>兩者都有</span></td><td><strong>{cells[1]:,}</strong><span>只有桶詞</span></td></tr>',
            f'<tr><th scope="row">無桶詞</th><td><strong>{cells[2]:,}</strong><span>只有垃圾車</span></td><td><strong>{cells[3]:,}</strong><span>兩者皆未命中</span></td></tr>',
            f'</tbody></table><p class="feedback-note">{esc(overlap_note)}</p></figure>',
            '<p>即使兩類用詞只在部分留言重疊，也不能說兩類需求彼此獨立。一個人可遇到多種困擾，留言也可能省略服務名稱。方案判斷仍要回到具體情境。</p></section>',
            '<section class="feedback-section" aria-labelledby="feedback-mechanisms"><h3 id="feedback-mechanisms" tabindex="-1">五個需要分開驗證的問題</h3>',
            '<p>本節以問題線索做目的抽樣閱讀並保留反例，未逐則語意編碼全部留言。「留言線索」是人工改寫摘述；「可能機制」與「其他解釋」都是待查假說，未計算各機制的人數或發生率。</p>']
    md += ['## 五個需要分開驗證的問題', '', '方法：以可達性、住宅負擔、時段、維護、垃圾來源及分類衝突為線索做目的抽樣閱讀，並刻意保留反例；不是隨機抽樣，也未逐則語意編碼全部留言。留言線索為人工改寫摘述；可能機制與其他解釋均待驗證，未計算各機制的人數或發生率。', '']
    for key, title, observation, hypothesis, alternative, measure, decision in MECHANISMS:
        md += [f'### {title}', '']
        page += [f'<article class="feedback-mechanism" aria-labelledby="feedback-mechanism-{key}"><h4 id="feedback-mechanism-{key}" tabindex="-1">{esc(title)}</h4><dl>']
        for label, value in [('留言線索', observation), ('可能機制 · 待驗證', hypothesis), ('其他解釋與反例', alternative), ('如何查核', measure), ('結果如何改變決定', decision)]:
            md += [f'**{label}：**{value}', '']
            page += [f'<div><dt>{esc(label)}</dt><dd>{esc(value)}</dd></div>']
        page += ['</dl></article>']
    page += ['</section><section class="feedback-section" aria-labelledby="feedback-loop"><h3 id="feedback-loop" tabindex="-1">一條待檢驗的惡性循環</h3>',
             f'<figure class="problem-loop"><figcaption>{esc(LOOP_NOTE)}</figcaption><ol>']
    page += [f'<li><span>{esc(node)}</span></li>' for node in LOOP_NODES]
    page += ['</ol><p class="problem-loop-return">若替代服務未補上，可能回到起點：合法投放更難使用。</p></figure>',
             '<p>可測試的介入點分別是：改善合法去處的可用時段、依實際負荷調整巡收，以及在限縮或撤點前確認替代服務。每一項都要連同鄰近地點與清潔工時一起觀察。</p></section>',
             '<section class="feedback-section" aria-labelledby="feedback-validation"><h3 id="feedback-validation" tabindex="-1">下一步：讓不同解釋可以被區分</h3>',
             '<p>目前仍缺逐則事件時間、核實位置、實際服務時間、投放負荷、巡收與成本。下面是建議的驗證順序，尚未執行。</p>',
             '<ol class="feedback-check-steps">']
    md += ['## 一條待檢驗的惡性循環', '', LOOP_NOTE, '', '```mermaid', 'flowchart LR',
           '  A[合法投放難以使用] -. 可能 .-> B[垃圾轉往其他地點]',
           '  B -. 可能 .-> C[集中投放與維護壓力]',
           '  C -. 可能 .-> D[陳情、限縮或撤點]',
           '  D -. 替代服務未補上時 .-> A', '```', '',
           '可測試的介入點：合法去處的可用時段、依負荷調整巡收、限縮或撤點前確認替代服務。各項均須連同鄰近地點與清潔工時觀察。', '',
           '## 下一步：讓不同解釋可以被區分', '', '目前仍缺逐則事件時間、核實位置、實際服務時間、投放負荷、巡收與成本。以下是建議順序，尚未執行。', '']
    for i, (title, body) in enumerate(CHECK_STEPS, 1):
        md += [f'{i}. **{title}：**{body}']
        page += [f'<li><strong>{esc(title)}</strong><p>{esc(body)}</p></li>']
    md += ['', '完成條件：形成有場景、時間、服務核對及待驗證原因的問題清單；試辦前固定比較方式與停止條件。未取得現場基準前，不發布設點排名、支持率或成效估計。', '']
    page += ['</ol><p class="feedback-note">完成條件：形成有場景、時間、服務核對及待驗證原因的問題清單；試辦前固定比較方式與停止條件。未取得現場基準前，不發布設點排名、支持率或成效估計。</p></section>']
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
    return {
        'schemaVersion': 1,
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
    md = ['# 垃圾相關意見回饋：分析與結論', '', f'分析整理日：{data["analysisDate"]}（非收集日期）', '', SCOPE, '', intro, '', '## 結論與下一步', '']
    page = ['<header class="research-page-heading"><p class="research-update">留言分析 · 整理於 2026-10-17，收集期間未提供</p><h2 id="feedback-heading">垃圾相關意見回饋</h2>',
            f'<p>從 {total:,} 則留言，看投放與收運的不同困擾。</p></header>',
            f'<p class="feedback-scope">{esc(SCOPE)}</p>',
            '<nav class="feedback-contents" aria-label="留言分析章節"><a href="#feedback-problems">問題圖解</a><a href="#feedback-mechanisms">深入分析</a><a href="#feedback-validation">驗證下一步</a><a href="#feedback-signals">文字線索</a><a href="#feedback-moods">心情與組成</a><a href="#feedback-method">方法與限制</a></nav>',
            '<section class="feedback-section" aria-labelledby="feedback-findings"><h3 id="feedback-findings" tabindex="-1">先看見不同困擾，再決定服務怎麼改</h3>', f'<p>{esc(intro)}</p>']
    for title, observation, action in FINDINGS:
        md += [f'### {title}', '', observation, '', f'建議查核：{action}', '']
        page += [f'<div class="feedback-finding"><h4>{esc(title)}</h4><p>{esc(observation)}</p><p class="feedback-next"><strong>建議查核：</strong>{esc(action)}</p></div>']
    page += ['<p class="feedback-note">以上是留言的人工歸納與改寫摘述，未逐則編碼立場，也未驗證留言描述的現場。</p></section>']
    md += ['以上為人工歸納與改寫摘述，未逐則編碼立場，也未驗證留言描述的現場。', '']
    depth_md, depth_page = render_depth(data)
    md += depth_md
    page += depth_page
    for key, title, values, note in datasets:
        md += [f'## {title}', '', note, '', f'分母：本檔 {total:,} 則留言。', '', table_markdown(values, total), '']
        page += [f'<section class="feedback-section" aria-labelledby="feedback-{key}"><h3 id="feedback-{key}" tabindex="-1">{title}</h3><p>{esc(note)}</p>']
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
            md += [extra, '', '### 詞表', '']
            page += [f'<p class="feedback-note">{esc(extra)}</p><details class="feedback-codebook"><summary>查看固定詞表與計數方式</summary><p>只計是否出現，不計重複出現次數；含否定的句子也會命中。</p><dl>']
            for item in data['indicators']:
                terms = '、'.join(item['terms'])
                md += [f'- {item["label"]}：{terms}']
                page += [f'<div><dt>{esc(item["label"])}</dt><dd>{esc(terms)}</dd></div>']
            md += ['']
            page += ['</dl></details>']
        page += ['</section>']
    md += ['## 資料品質與限制', '', quality_text, ''] + [f'- {item}' for item in LIMITS]
    md += ['', '## 重現方式', '', '原始輸入由提供者在本地保存，未納入 Git、網站或離線研究包。請使用保留的原始檔重算；僅有摘要無法重做文字比對。', '',
           '在 `sites/taipei-waste-lab` 執行（離線包則在解壓根目錄）：', '',
           '```sh', 'python3 scripts/analyze-feedback.py --input "/absolute/path/to/Pasted text.txt"', 'python3 scripts/package-research.py', '```', '',
           '不提供 `--input` 時，只從保存的 `summary.json` 重建 Markdown 與網頁。完整資料建置也會執行此步驟，不需要原始留言。', '',
           f'原始檔 SHA-256：`{data["source"]["sha256"]}`。', '', '彙總檔：[summary.json](summary.json)。每次變更詞表都須重新提供原始輸入；程式拒絕用舊摘要搭配新詞表。', '']
    page += ['<section class="feedback-section" aria-labelledby="feedback-method"><h3 id="feedback-method" tabindex="-1">方法、資料品質與限制</h3>', f'<p>{esc(quality_text)}</p><ul class="feedback-limits">']
    page += [f'<li>{esc(item)}</li>' for item in LIMITS]
    page += ['</ul><p class="feedback-note">來源：研究團隊提供的垃圾相關意見回饋檔。分析以本次保存的檔案為準，未與公開清潔箱清冊逐筆連結。</p><p><a href="#research">回到研究結論</a> · <a href="#sources">查看公開資料與文獻</a></p></section>']
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
                          lambda _: '<!-- feedback-problem-map-start -->\n' + problem_map() + '\n<!-- feedback-problem-map-end -->',
                          page, flags=re.S)
    if count != 1:
        raise ValueError('Expected one homepage problem map marker')
    index.write_text(page, encoding='utf-8')
    print(f'Rendered {data["records"]} feedback records as aggregate-only analysis')


if __name__ == '__main__':
    main()

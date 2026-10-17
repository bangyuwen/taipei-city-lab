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
            '<nav class="feedback-contents" aria-label="留言分析章節"><a href="#feedback-findings">分析結論</a><a href="#feedback-signals">文字線索</a><a href="#feedback-moods">心情與組成</a><a href="#feedback-method">方法與限制</a></nav>',
            '<section class="feedback-section" aria-labelledby="feedback-findings"><h3 id="feedback-findings" tabindex="-1">先看見不同困擾，再決定服務怎麼改</h3>', f'<p>{esc(intro)}</p>']
    for title, observation, action in FINDINGS:
        md += [f'### {title}', '', observation, '', f'建議查核：{action}', '']
        page += [f'<div class="feedback-finding"><h4>{esc(title)}</h4><p>{esc(observation)}</p><p class="feedback-next"><strong>建議查核：</strong>{esc(action)}</p></div>']
    page += ['<p class="feedback-note">以上是留言的人工歸納與改寫摘述，未逐則編碼立場，也未驗證留言描述的現場。</p></section>']
    md += ['以上為人工歸納與改寫摘述，未逐則編碼立場，也未驗證留言描述的現場。', '']
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
    index.write_text(page, encoding='utf-8')
    print(f'Rendered {data["records"]} feedback records as aggregate-only analysis')


if __name__ == '__main__':
    main()

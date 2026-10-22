"""Publish proposed priorities and keep all district cards and schedule in sync."""
import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent
if (HERE.parents[3] / "sites/taipei-waste-lab").is_dir():
    SITE = HERE.parents[3] / "sites/taipei-waste-lab"
CATALOG = 'https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c'


def e(value):
    return html.escape(str(value), quote=True)


def substitute(page, pattern, value):
    page, count = re.subn(pattern, lambda _: value, page, flags=re.S)
    assert count == 1, (pattern, count)
    return page


def row(point):
    c, venue, street = point['choice'], point['venue'], point['street']
    code = point['candidate_id'][1:3]
    return f'''<tr data-priority-id="{e(point['candidate_id'])}">
<td data-label="優先現勘點與理由"><strong>{e(point['source_area'])} · {e(point['name'])}</strong><br><small>{e(point['candidate_id'])} · 建議第1輪</small><p>{e(c['reason'])}</p></td>
<td data-label="現場要確認什麼"><p>{e(c['confirm'])}</p>
<details class="feedback-codebook"><summary>來源原文與查核結果的用途</summary>
<p><strong>場所原文：</strong>{e(venue['name'])}，{e(venue['source_area'])}，第 {venue['row']} 列；備註「{e(venue['remark'])}」。距概略座標約 {venue['source_coordinate_distance_m']:.0f} m。</p>
<p><strong>能支持的範圍：</strong>{e(point['evidence_scope'])}</p>
<p><strong>最近街道紀錄：</strong>{e(street['name'])}，{e(street['source_area'])}，第 {street['row']} 列；座標直線距離約 {street['source_coordinate_distance_m']:.0f} m。</p>
<p><strong>查完如何判讀：</strong>{e(c['changes'])}</p>
<p><a href="#citywide-area-{code}">回查本區三點、原文與規則敏感度</a> · <a href="{CATALOG}" target="_blank" rel="noopener noreferrer">官方來源</a></p>
</details></td></tr>'''


def priority_article(result):
    groups = []
    for group in result['groups']:
        points = [p for p in result['candidates'] if p['wave'] == 'W1' and p['choice']['group'] == group['id']]
        groups.append(f'''<section class="research-overview-section" aria-labelledby="field-priority-{group['id']}">
<h4 id="field-priority-{group['id']}">{e(group['label'])} · {len(points)} 點</h4>
<table class="plan-table"><thead><tr><th scope="col">優先現勘點與理由</th><th scope="col">現場要確認什麼</th></tr></thead><tbody>{''.join(row(p) for p in points)}</tbody></table></section>''')
    return f'''<article class="reader-item" id="reader-field-priority" data-reader-item="現勘：優先點與查核問題">
<h3 id="field-priority">先查這12點，讓下一步有現場依據</h3>
<p class="research-lead">12區各先查1點：釐清選點與共用來源、不同場域的服務邊界，以及看似已有設施的路徑與使用條件。原36點全數保留，這12點是建議的首批現勘，尚未執行。</p>
<p><strong>這個優先順序是規劃判斷。</strong>依10/20複查的具體疑點選擇，並保留近距離紀錄作核實對照；三類並列，類別與列序不代表垃圾需求高低，也不是新設桶位。每區先一點是覆蓋安排，不能代表整區。</p>
<nav class="reading-path" aria-label="首批現勘的查核目的"><a href="#field-priority-selection">選點與共用來源</a><a href="#field-priority-boundary">場域邊界</a><a href="#field-priority-comparison">來源核實對照</a><a href="#field-schedule">全部36點的輪次</a></nav>
<p>已知只有來源紀錄與候選規則。到場先記實際設施、箱號、路徑、管理者及開放與接收條件，再依固定範圍記錄投放物與結果。實際桶數、可用性與需求仍待確認；沒有證據時留白，也不預先套用需求人物。</p>
{''.join(groups)}
<p>來源：場所表2026-08-18、街道表2026-09-30，10/20複查內容相同；列號含表頭。「處」保留原文，不當桶數，街道與場所不相加。座標距離只供定位，不能當步行距離或服務半徑。七月借還活動也不能換算垃圾量。</p>
<h4>查完要留下什麼</h4>
<p>留下實際服務點ID與來源對照、現場範圍及路徑、使用條件、管理者依據、投放事件與未完成原因。找到可用服務就記錄銜接情況；未找到就保留走查範圍與缺口。兩種結果都不能直接推出要增設或不必增設。</p>
<p>首批12點仍依2平日＋1週末、每日兩個15分鐘時窗，共72站次／18純觀察小時，未含盤點、交通與整理；日期、人員與進場條件待確認。其餘24點依原候選次序分到第2、3輪，不代表問題較少。<a href="#field-schedule">查看全36點順序</a> · <a href="#field-record">現場紀錄方法</a> · <a href="#analysis">回到全市量化分析</a></p>
</article>'''


def schedule_article(result, plan):
    by_id = {p['candidate_id']: p for p in result['candidates']}
    rows = []
    for d in result['districts']:
        cells = ''.join(f'<td data-label="第{i}輪">{e(by_id[cid]["name"])}<br><small>{cid}</small></td>' for i, cid in enumerate(d['candidate_ids'], 1))
        rows.append(f'<tr><td data-label="行政區"><a href="#citywide-area-{d["code"]}">{e(d["area"])}</a></td>{cells}</tr>')
    groups = ''.join(f'<li><strong>{g["id"]} {e(g["label"])}：</strong>{e("、".join(g["districts"]))}</li>' for g in plan['geographic_groups'])
    return f'''<article class="reader-item" id="reader-field-schedule" data-reader-item="現勘：分輪與區域安排">
<h3 id="field-schedule">先查12區的關鍵疑點，再完成其餘24點</h3>
<p>10/20依複查調整現勘輪次，原36點與活動排名不變。第1輪為<a href="#field-priority">首批12點</a>；同區剩餘兩點沿用原候選次序排第2、3輪，沒有證據表示較晚查的點需求較少。候選ID尾碼是原編號，不是輪次。</p>
<p>每輪12點、72站次、18純觀察小時；每點2個不同平日＋1個週末、每日兩個15分鐘時窗。全市合計216站次／54小時，校區3點另18站次／4.5小時。時窗來自七月活動，當下適用性仍須確認；實際日期、人員與進場條件待確認。</p>
<table class="plan-table"><thead><tr><th scope="col">行政區</th><th scope="col">第1輪</th><th scope="col">第2輪</th><th scope="col">第3輪</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
<h4>四個區域協調分組</h4><ul>{groups}</ul>
<p>分組只供協調，不是已驗證的步行路線。每組每個觀察日只排一點、兩個時窗。某點無法進場時保留原因，其他區可繼續；各區首點完成或保留未完成原因後再彙整下一輪。若需換點，先記理由與版本，不把缺測當零，也不把已查點宣稱全市代表。</p>
<p><a href="#field-priority">首批逐點理由與問題</a> · <a href="#field-capacity">人力與排班條件</a> · <a href="#districts">各區原文與活動時窗</a></p></article>'''


def update():
    # Current decision planning supersedes this dated district-quota publisher.
    current = HERE.parent / 'decision-checks-2026-10-22/build.py'
    if current.exists() and '<!-- decision-checks-start -->' in (SITE / 'dist/index.html').read_text():
        import runpy
        runpy.run_path(str(current))['build'](SITE / 'dist/index.html')
        return
    result = json.loads((HERE / 'priority.json').read_text())
    plan = json.loads((SITE / 'research/taipei-citywide-2026-10-19/delivery/field-plan.json').read_text())
    by_id = {p['candidate_id']: p for p in result['candidates']}
    assert plan['waves'][0]['candidate_ids'] == [d['candidate_ids'][0] for d in result['districts']]
    path = SITE / 'dist/index.html'
    page = path.read_text()
    priority = priority_article(result)
    if 'id="reader-field-priority"' in page:
        page = substitute(page, r'<article[^>]+id="reader-field-priority".*?</article>', priority)
    else:
        marker = '<article class="reader-item" id="reader-field-schedule"'
        assert page.count(marker) == 1
        page = page.replace(marker, priority + '\n' + marker)
    page = substitute(page, r'<article[^>]+id="reader-field-schedule".*?</article>', schedule_article(result, plan))
    index_link = '<a href="#reader-field-priority">現勘：優先點與查核問題</a>'
    schedule_link = '<a href="#reader-field-schedule">現勘：分輪與區域安排</a>'
    if index_link not in page:
        assert page.count(schedule_link) == 1
        page = page.replace(schedule_link, index_link + schedule_link)
    # The original "first round" meant the whole 36-point study, not the new 12-point wave.
    methods = re.search(r'<section id="panel-methods".*?(?=<section id="panel-)', page, re.S)
    assert methods
    method_text = methods.group().replace('3處首輪查核點', '3處觀察候選點')
    method_text = method_text.replace('首輪點數不是需求或預算配額', '候選點數不是需求或預算配額')
    method_text = method_text.replace('>首輪查核<', '>觀察候選（原排序）<')
    method_text = method_text.replace('第一輪建議量：', '全三輪建議量：')
    page = page[:methods.start()] + method_text + page[methods.end():]
    page = substitute(page, r'<section[^>]+aria-labelledby="plan-districts">.*?</section>', '''<section class="research-overview-section" aria-labelledby="plan-districts"><h4 id="plan-districts">首批現勘：每區先查一點</h4><p>依12區複查選12點，分別核實選點與共用來源、場域邊界、跨區及近距離紀錄。這是查核順序提案，不是需求排名；36點保留，現勘與人員尚未確認。</p><p><a href="#field-priority">首批12點、理由與待查問題</a> · <a href="#field-schedule">三輪順序</a> · <a href="#field-capacity">人力與排班</a></p></section>''')
    page = substitute(page, r'(<h3 id="analysis-next">).*?(?=<nav class="research-overview-nav")', '''<h3 id="analysis-next">帶著具體疑點，安排首批現勘</h3><span id="analysis-handoff" tabindex="-1"></span><p>先查12區各一點，確認實際服務、路徑與使用條件，再記錄投放事件與未完成原因。其餘24點排第2、3輪，沒有證據表示它們問題較少。候選點仍不直接當新設桶位。</p><p><a href="#field-priority">誰先查、為什麼、要確認什麼</a> · <a href="#districts">逐區原文與缺口</a> · <a href="#government-handoff">政府分工交接</a></p>''')
    for district in result['districts']:
        code, order = district['code'], district['candidate_ids']
        pattern = f'<article class="reader-item" id="reader-district-{code}".*?</article>'
        article = re.search(pattern, page, re.S).group()
        # Evidence tables retain the original candidate order; labels separate the proposed visit order.
        for cid in order:
            point = by_id[cid]
            label = f'<strong>{e(cid)} {e(point["name"])}</strong>'
            assert article.count(label) == 1
            article = re.sub(re.escape(label) + r'(?:<br><small>建議第[123]輪現勘</small>)?',
                             lambda _: label + f'<br><small>建議第{point["wave"][1]}輪現勘</small>', article)
        first = by_id[order[0]]
        note = (f'<p><strong>現勘查核卡：</strong>先查 {e(first["name"])}（{order[0]}）；'
                f'第1→2→3輪依序為 {" → ".join(order)}。活動排名與候選ID不變，輪次另列。'
                '每點2平日＋1週末、每日兩窗；實際日期與人員待確認。'
                '<a href="#field-priority">首點理由與待查問題</a> · <a href="#field-record">觀察與回報</a></p>')
        article = substitute(article, r'<p><strong>(?:首輪|現勘)查核卡：</strong>.*?</p>', note)
        page = substitute(page, pattern, article)
    path.write_text(page)
    print('Updated first-wave priorities, all 36 visit positions and 12 district cards.')


if __name__ == '__main__':
    update()

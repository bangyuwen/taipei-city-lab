"""Render decision-dependent checks inside the current hundred-day plan."""
import hashlib
import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent
if (HERE.parents[3] / 'sites/taipei-waste-lab').is_dir():
    SITE = HERE.parents[3] / 'sites/taipei-waste-lab'
START = '<!-- decision-checks-start -->'
END = '<!-- decision-checks-end -->'
SCHEDULE_START = '<!-- plan-schedule-start -->'
SCHEDULE_END = '<!-- plan-schedule-end -->'
SUMMARY_START = '<!-- plan-summary-start -->'
SUMMARY_END = '<!-- plan-summary-end -->'


def load():
    manifest = json.loads((HERE / 'inputs.json').read_text())
    for source in manifest['sources']:
        assert hashlib.sha256((HERE / source['path']).read_bytes()).hexdigest() == source['sha256']
    plan = json.loads((HERE / 'checks.json').read_text())
    assert plan['district_quota'] is None and plan['scheduled_visits'] == []
    assert len({c['id'] for c in plan['checks']}) == len(plan['checks'])
    for c in plan['checks']:
        assert c['outcome'] is None
        assert all(c[key].strip() for key in ['decision', 'known', 'desk', 'trigger', 'yes', 'no', 'unknown'])
    return plan


# One schedule feeds the visual timeline and the detailed handoff table.
SCHEDULE = [
    (-45, -31, '整理現有桶位', '分析者＋管理窗口', '整理現有桶位、容量、清運與服務資料，保留來源日期和未知；第-31天交待核對底圖與清單。', '公開資料先做；作業資料取得與清潔人員配合另確認同意。', '待核對桶位底圖與清單'),
    (-30, -16, '疊圖與候選初版', '分析者', '對齊活動、桶位、時段與可達服務；第-16天交移入候選位置表初版及來源限制。', '活動高只支持查核優先；缺資料不判無需求或無桶。', '移入候選位置表初版、來源限制'),
    (-30, -16, '原型演練與規則', '產品＋覆核者', '完成回報、候選、變更與回看最小原型及模擬演練；第-16天提出觀察窗口、覆蓋、成功／停止規則。', '實際試用前確認保存、交接、人員同意與比較規則；模擬不算實測。', '最小原型與模擬演練；觀察窗口、覆蓋與成功／停止規則'),
    (-15, -1, '試用與候選覆核', '清潔／管理者＋分析者', '取得現有管理者與參與者同意後，小範圍試用、清運前回報與必要現場覆核；第-1天交候選覆核表、初步基線或待辦缺口。', '未取得同意就維持模擬與資料準備；不預填現場成果，不因上任前時程自動搬桶。', '候選覆核表、初步基線或待辦缺口'),
    (1, 15, '確認承接與現況', '管理者＋清潔人員', '確認正式試辦範圍、責任、人力與比較規則；核對上任前資料的日期、桶位及清運條件，第15天交更新清單。', '可比資料才沿用；條件改變或未開始試用者補足紀錄。', '更新後的桶位與現況清單'),
    (16, 30, '補足兩側基線', '清潔人員＋回看者', '持續清運前回報；補足移入與原區、參照區的調整前紀錄，第30天交候選更新版與兩側基線。', '無桶區滿度為不適用；基線不足則延後調整，不受日程催促。', '兩側基線、候選更新版'),
    (16, 30, '配對與方案比較', '規劃者＋覆核者', '依可用基線連接移出桶與移入候選；比較維持、頻率、容量及位置方案，第30天交配置提案或維持理由。', '原區服務、移入需求、兩側基線與回退齊備，才送核准。', '配置提案或維持現況理由'),
    (31, 45, '核准後小範圍試調', '管理者＋執行者', '逐案核准後執行；第45天交實際變更清單、日期、配置版本、回看窗口與未執行原因。', '未核准不搬；提案與已執行分開，無合適方案可不調整。', '實際變更清單、日期、配置版本、回看窗口與未執行原因'),
    (46, 90, '兩側追蹤回看', '清潔人員＋回看者', '依實際執行日起算觀察窗口，追蹤移入與原區、可比參照與維運投入；第90天整理前後紀錄。', '原區惡化立即處理；窗口不足標未完成，不縮短湊成果。', '移入、原區與可比參照的前後紀錄'),
    (91, 100, '成效判讀與交接', '覆核者＋管理者', '比較相同條件與分母；第100天交成果、限制、配置版本及後續責任。', '結論可為保留、修正、調回或證據不足；不預設改善。', '成果與限制、配置版本、後續責任'),
]


def render_schedule_summary():
    first = min(row[0] for row in SCHEDULE)
    last = max(row[1] for row in SCHEDULE)
    return ('<section class="project-section" aria-labelledby="plan-schedule-summary">'
            '<h3 id="plan-schedule-summary">時程摘要</h3>'
            f'<p>以市長上任日為第 0 天，規劃從第 {first} 天至第 {last} 天。'
            '上任前整理現有桶位、候選與原型；上任後先確認承接及基線，'
            '再依核准方案試調、回看與交接。實際日期與承接待確認，未過關卡就延後。</p>'
            '<p><a href="#plan-timeline">查看完整時間軸</a>：對照上任前後的工作期間、交付成果與建議角色。</p></section>')


def render_schedule_full():
    e = html.escape
    chart = []
    phase = None
    columns = (
        '<colgroup><col class="plan-gantt-work-col"><col class="plan-gantt-time-col"><col class="plan-gantt-output-col"><col class="plan-gantt-owner-col"></colgroup>'
        '<thead><tr><th scope="col">工作與天數</th><th scope="col">預定期間<div class="plan-timeline-scale" aria-hidden="true"><span style="left:0%">−45</span><span style="left:30.8219%">0 上任</span><span style="left:51.3699%">30</span><span style="left:71.9178%">60</span><span style="left:100%">100</span></div></th><th scope="col">交付成果</th><th scope="col">建議負責角色</th></tr></thead>'
    )
    rows = []
    first_day, last_day = -45, 100
    total_days = last_day - first_day + 1
    for start, end, title, owner, work, gate, deliverable in SCHEDULE:
        days = f'第 {start} 至 {end} 天'
        offset = (start - first_day) / total_days * 100
        width = (end - start + 1) / total_days * 100
        next_phase = 'before' if end < 0 else 'after'
        if next_phase != phase:
            if phase is not None:
                chart.append('</tbody></table>')
            heading = '上任前準備｜第 −45 至 −1 天' if next_phase == 'before' else '上任後執行｜第 1 至 100 天'
            chart.append(f'<table class="plan-gantt-table"><caption>{heading}</caption>'+columns+f'<tbody data-phase="{next_phase}">')
            phase = next_phase
        chart.append(f'<tr class="plan-gantt-task"><th scope="row"><div class="plan-timeline-label"><strong>{e(title)}</strong><span>{days}</span></div></th>'
                     f'<td class="plan-gantt-period"><span class="visually-hidden">{days}</span><div class="plan-timeline-track" aria-hidden="true"><span style="--start:{offset:.4f}%;--span:{width:.4f}%"></span></div></td>'
                     f'<td class="plan-gantt-output"><span class="plan-gantt-mobile-label">交付成果</span>{e(deliverable)}</td>'
                     f'<td class="plan-gantt-owner"><span class="plan-gantt-mobile-label">建議負責角色</span>{e(owner)}</td></tr>')
        rows.append(f'<tr><th scope="row">{days}<br>{e(title)}</th><td data-label="工作與交付">{e(work)}</td><td data-label="建議責任角色">{e(owner)}</td><td data-label="通過條件／未達處理">{e(gate)}</td></tr>')
    return ('<section class="project-section" id="plan-100day" aria-labelledby="plan-100day-heading">'
        '<h3 id="plan-100day-heading" class="visually-hidden">百日時間圖：第幾天做什麼</h3>'
        '<p>第 0 天＝市長上任日。上任前先準備資料、原型與試用；上任後確認承接與基線，再依核准方案試調。以下為規劃時程與建議分工，實際日期、人選與承接仍待確認；長條表示工作期間，不表示完成比例。</p>'
        '<figure class="plan-timeline"><figcaption>從準備到交接：工作、交付成果與負責角色對照</figcaption>'
        +''.join(chart)+'</tbody></table></figure>'
        '<p><strong>交付節點：</strong>第 -31 天底圖；第 -16 天候選初版與原型；第 -1 天覆核表與初步基線或缺口；第 0 天上任；第 15 天承接與現況確認；第 30 天兩側基線與配置提案；第 45 天實際變更紀錄；第 90 天前後紀錄；第 100 天決策與交接。</p>'
        '<details class="persona-detail plan-detail"><summary>展開工作細節、通過條件與未達處理</summary><h4 id="plan-schedule-details">工作、責任與決策關卡</h4>'
        '<table class="plan-table"><thead><tr><th scope="col">天數與工作</th><th scope="col">工作與交付</th><th scope="col">建議責任角色</th><th scope="col">通過條件／未達處理</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table></details>'
        '<p><strong>持續工作與延後規則：</strong>清潔回報自取得同意並開始實際試用後持續至回看結束，不因第 0 天而中斷。上任前基線須確認與調整時的桶位、清運及觀察條件可比；不同條件分開，必要時補測。每次實際調整另計前後窗口，執行後即記異常；第 46–90 天是集中回看安排。若位置確認、核准或執行延後，依事前窗口延後判讀；第100天如實交付未完成及後續日期，不縮短觀察。</p>'
        '<p>未過關卡就維持現況或補查；不訂行政區配額、搬桶數或改善百分比。候選表可以沒有可提案位置，百日成果也可以是維持現況及其證據。目前沒有已啟動、已核准或已執行的試辦結果。</p></section>')


def render_schedule():
    full = render_schedule_full()
    full = re.sub(r'(<h3[^>]*>.*?</h3>)<p>.*?</p>', r'\1<p>第 0 天為市長上任日；長條為預定期間。實際日期、承接與人選待確認，計畫尚未啟動。</p>', full, count=1, flags=re.S)
    # Keep both periods together; old preparation links now target the first phase.
    anchors = ('<span id="panel-plan-preparation" class="page-route" aria-hidden="true"></span>'
               '<span id="plan-preparation-heading" class="page-route" aria-hidden="true"></span>'
               '<span id="plan-preparation-chart-heading" class="page-route" aria-hidden="true"></span>'
               '<span id="plan-preparation-chart" class="page-route" aria-hidden="true"></span>')
    full = full.replace('<caption>上任前準備', '<caption id="plan-preparation">'+anchors+'上任前準備', 1)
    full = full.replace('<caption>上任後執行', '<caption id="plan-after-inauguration">上任後執行', 1)
    full = full.replace('<figure class="plan-timeline">',
                        '<nav class="reading-path" aria-label="時間軸階段"><a href="#plan-preparation">上任前準備</a><a href="#plan-after-inauguration">上任後執行</a></nav><figure class="plan-timeline">', 1)
    full = re.sub(r'<p><strong>交付節點：</strong>.*?</p>', '', full, flags=re.S)
    full = re.sub(r'<details class="persona-detail plan-detail">.*?</details>', '', full, flags=re.S)
    tail = full.index('<p><strong>持續工作與延後規則：')
    full = full[:tail] + '<p><a href="#plan-readiness">查看完整工作細節、決策關卡與延後規則</a></p></section>'
    return full


def render_schedule_gates():
    full = render_schedule_full()
    start = full.index('<details class="persona-detail plan-detail">')
    return full[start:full.rindex('</section>')]


def render(plan):
    e = html.escape
    cases = []
    for c in plan['checks']:
        rows = ''.join(f'<div><dt>{label}</dt><dd>{e(c[key])}</dd></div>' for label, key in [
            ('要支持的決定', 'decision'), ('已有依據', 'known'), ('先查資料', 'desk'),
            ('何時才到現場', 'trigger')])
        outcomes = ''.join(f'<li><strong>{label}：</strong>{e(c[key])}</li>' for label, key in [
            ('若確認成立', 'yes'), ('若不成立或有反例', 'no'), ('若仍未知', 'unknown')])
        cases.append(f'<section class="project-section" id="plan-check-{e(c["id"])}" data-decision-check="{e(c["id"])}"><h4>{e(c["title"])}</h4><dl class="project-contract">{rows}</dl><details class="persona-detail"><summary>查完能決定什麼</summary><ul>{outcomes}</ul></details><p><a href="{e(c["source"], quote=True)}">{e(c["source_label"])}</a></p></section>')
    crew_plan = (HERE.parent / 'crew-persona-2026-10-23/plan.html').read_text()
    return '<details class="persona-detail plan-detail"><summary>清潔人員研究｜手機、路線與人力的補證流程</summary>'+crew_plan+'</details><details class="persona-detail plan-detail"><summary>必要時的查核｜五項決策疑點與現場觸發條件</summary>'+'''<section class="project-section" aria-labelledby="plan-checks-heading" id="field-priority"><span id="methods" class="page-route" aria-hidden="true"></span><span id="methods-heading" tabindex="-1"></span>
<h3 id="plan-checks-heading">配置決定需要時，才補這些查核</h3>
<p>本期先從現有桶位與清運前回報建立基線。以下保留既有服務與需求查核題目，僅在配置判斷缺少相關證據時啟用，不替代日常回報或自動排成現勘。</p>
<p><strong>取消每區一點與固定三輪配額。</strong>下列是待釐清的決策疑點，不是必去場址清單，也不是需求排名。前3項先做資料或管理條件核對；第4項只有出現具體方案取捨才啟動；第5項在實際試用前補查清潔人員手機、路線與人力，確認App的使用對象。尚未聯繫機關、排定走查或取得現場結果。</p>
<nav class="reading-path" aria-label="百日計畫查核疑點">'''+''.join(f'<a href="#plan-check-{e(c["id"])}">{e(c["title"].split('：')[0])}</a>' for c in plan['checks'])+'''</nav>
<details class="persona-detail"><summary>什麼情況不查？</summary><ul><li>位置圖、既有明細或管理規則已足以支持該決定，就記下來源後結案。</li><li>答案不會改變任何選項，就移出本輪；不為補齊行政區或湊點數安排觀察。</li><li>沒有要比較的方案、查核無法分辨方案，或對照用途未定，就暫緩。其餘原候選點保留為資料索引，取消自動排程。</li><li>選點只對距離門檻敏感，尚未影響實際比較範圍時，先做桌面敏感度分析，不因此直接出勤。</li></ul></details>
'''+''.join(cases)+'''<p>查核紀錄至少寫明：待選方案、來源、未知、觸發理由、實際結果、因此採取或暫緩的決定。沒有改變決定的資訊不列為必做成果。<a href="#reader-field-forms">必要時使用空白紀錄表</a>。</p></section>
</details>'''


def build(page_path=None):
    plan = load()
    path = page_path or SITE / 'dist/index.html'
    page = path.read_text()
    assert page.count(START) == page.count(END) == 1
    page = re.sub(re.escape(START)+r'.*?'+re.escape(END), lambda _: START+render(plan)+END, page, flags=re.S)
    assert page.count(SCHEDULE_START) == page.count(SCHEDULE_END) == 1
    page = re.sub(re.escape(SCHEDULE_START)+r'.*?'+re.escape(SCHEDULE_END),
                  lambda _: SCHEDULE_START+render_schedule()+SCHEDULE_END, page, flags=re.S)
    for marker, content in [('plan-gates', render_schedule_gates())]:
        start, end = f'<!-- {marker}-start -->', f'<!-- {marker}-end -->'
        assert page.count(start) == page.count(end) == 1
        page = re.sub(re.escape(start)+r'.*?'+re.escape(end),
                      lambda _: start+content+end, page, flags=re.S)
    assert page.count(SUMMARY_START) == page.count(SUMMARY_END) == 1
    page = re.sub(re.escape(SUMMARY_START)+r'.*?'+re.escape(SUMMARY_END),
                  lambda _: SUMMARY_START+render_schedule_summary()+SUMMARY_END, page, flags=re.S)
    # Worker evidence is a separate role hypothesis, not a fifth comment journey.
    crew = (HERE.parent / 'crew-persona-2026-10-23/persona.html').read_text()
    crew_start, crew_end = '<!-- crew-persona-start -->', '<!-- crew-persona-end -->'
    block = crew_start + crew + crew_end
    if crew_start in page:
        assert page.count(crew_start) == page.count(crew_end) == 1
        page = re.sub(re.escape(crew_start)+r'.*?'+re.escape(crew_end), lambda _: block, page, flags=re.S)
    else:
        anchor = '<section class="research-overview-section" aria-labelledby="persona-related">'
        assert page.count(anchor) == 1
        page = page.replace(anchor, block + anchor, 1)
    page = page.replace('四種人物處境，各用一段旅程說清楚：發生了什麼、原文說了什麼、還要查什麼。',
                        '四則投放經驗，加上待訪談的清潔人員工作角色；各自說明依據、未知與下一步。')
    page = page.replace('四則選例呈現不同投放處境，包含一次完成投放的對照。',
                        '四則選例呈現投放處境；清潔人員另有官方職掌資料，尚無第一線經驗。')
    page = page.replace('<a href="#persona-walking">步行途中</a></nav>',
                        '<a href="#persona-walking">步行途中</a><a href="#persona-crew">清潔人員（待驗證）</a></nav>')
    page = page.replace('以下是情境型 Persona，同一人可以處於不同情境，順序不代表需求量。',
                        '前四段是回饋形成的情境型 Persona，同一人可以處於不同情境，順序不代表需求量；清潔人員另列為待驗證工作角色。')
    page = page.replace('目前不指定新桶位、不估算增設數量，也不把家戶收運或清潔人力配置併入本輪。',
                        '目前不指定新桶位、不估算增設數量，也不調整家戶收運。2026-10-23補入清潔人員手機、巡收路線與人力配置資料查核，銜接百日計畫Q05；尚未提出實際調派或增補人力方案。')
    path.write_text(page)
    return plan


if __name__ == '__main__':
    build()
    print('Rendered decision checks within the hundred-day plan; no district quota or scheduled visits.')

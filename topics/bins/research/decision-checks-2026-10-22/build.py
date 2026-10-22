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
    (1, 7, '確認現有桶位', '管理者＋清潔人員', '確認參與範圍、桶 ID／容量／清運、責任與來源日期；第7天交現況清單。', '人員與範圍未定，只做準備。'),
    (8, 15, '原型演練與規則', '產品＋覆核者', '演練回報、候選表、變更與回看紀錄；第15天固定觀察窗口、覆蓋、成功／停止門檻。', '可保存、交接並分辨模擬／實測，才開始實際回報。'),
    (16, 40, '清潔回報基線', '清潔人員＋覆核者', '維持桶位與清運安排，記清運前滿度、異常、間隔、缺測與操作負擔；第40天交基線。', '資料不足則延後判斷；第40天後仍持續回報。'),
    (16, 30, '疊圖與候選初版', '分析者', '對齊活動、現有桶位、時段與可達服務；第30天交移入候選位置表初版及來源限制。', '活動高只支持查核優先；缺資料不判無需求或無桶。'),
    (31, 40, '候選現場覆核', '分析者＋清潔／管理者', '核對必要候選的道路側、動線、投放障礙與清運；第40天交覆核版候選表。', '可提案、待補證、排除與暫緩分列，不要求湊點數。'),
    (31, 55, '兩側服務基線', '回看負責人', '對已明確的候選固定兩側範圍與參照，記調整前投放障礙、桶外垃圾及可達服務；第55天交比較基線。', '無桶區滿度為不適用；晚確認的位置需補足事前窗口。'),
    (41, 55, '配對與方案比較', '規劃者＋覆核者', '連接移出桶與移入候選；比較維持、頻率、容量及位置方案；第55天交配置提案或維持理由。', '原區服務、移入需求、兩側基線與回退齊備，才送核准。'),
    (56, 65, '核准後小範圍試調', '管理者＋執行者', '逐案核准後執行；第65天交實際變更清單、日期、配置版本、回看窗口與未執行原因。', '未核准不搬；提案與已執行分開，無合適方案可不調整。'),
    (66, 90, '兩側追蹤回看', '清潔人員＋回看者', '依實際執行日起算觀察窗口，追蹤移入與原區、可比參照與維運投入；第90天整理前後紀錄。', '原區惡化立即處理；窗口不足標未完成，不縮短湊成果。'),
    (91, 100, '成效判讀與交接', '覆核者＋管理者', '比較相同條件與分母；第100天交成果、限制、配置版本及後續責任。', '結論可為保留、修正、調回或證據不足；不預設改善。'),
]


def render_schedule():
    e = html.escape
    chart = []
    rows = []
    for start, end, title, owner, work, gate in SCHEDULE:
        days = f'第{start}–{end}天'
        chart.append(f'<li><div class="plan-timeline-label"><strong>{e(title)}</strong><span>{days}</span></div><div class="plan-timeline-track" aria-hidden="true"><span style="--start:{start-1}%;--span:{end-start+1}%"></span></div></li>')
        rows.append(f'<tr><th scope="row">{days}<br>{e(title)}</th><td data-label="工作與交付">{e(work)}</td><td data-label="建議責任角色">{e(owner)}</td><td data-label="通過條件／未達處理">{e(gate)}</td></tr>')
    return ('<section class="project-section" id="plan-100day" aria-labelledby="plan-100day-heading">'
        '<h3 id="plan-100day-heading">百日時間圖：第幾天做什麼</h3>'
        '<p>第1天是確認後的正式啟動日，不是今天。下列為規劃窗口；人選與啟動日尚待確認，長條表示工作期間，不表示完成比例。清潔回報與人流疊圖並行，先有候選與兩側基線，再核准試調。</p>'
        '<figure class="plan-timeline"><figcaption>清潔回報 × 人流疊圖 → 候選覆核 → 配置試調 → 兩側回看</figcaption>'
        '<div class="plan-timeline-scale" aria-hidden="true"><span>第1天</span><span>25</span><span>50</span><span>75</span><span>100</span></div>'
        '<ol>'+''.join(chart)+'</ol></figure>'
        '<p><strong>交付節點：</strong>第15天完成演練與比較規則；第30天候選初版；第40天回報基線與候選覆核版；第55天兩側基線與配置提案；第65天實際變更紀錄；第90天前後紀錄；第100天決策與交接。</p>'
        '<h4 id="plan-schedule-details">工作、責任與決策關卡</h4>'
        '<table class="plan-table"><thead><tr><th scope="col">天數與工作</th><th scope="col">工作與交付</th><th scope="col">建議責任角色</th><th scope="col">通過條件／未達處理</th></tr></thead><tbody>'+''.join(rows)+'</tbody></table>'
        '<p><strong>持續工作與延後規則：</strong>第16天起的清潔回報持續到回看結束；第40天是整理基線，不是停止回報。第31天起先對已明確的候選建立調整前紀錄。每次實際調整另計前後窗口，執行後即記異常；第66–90天是集中回看安排。若位置確認、核准或執行延後，依事前窗口延後判讀；第100天如實交付未完成及後續日期，不縮短觀察。</p>'
        '<p>未過關卡就維持現況或補查；不訂行政區配額、搬桶數或改善百分比。候選表可以沒有可提案位置，百日成果也可以是維持現況及其證據。目前沒有已啟動、已核准或已執行的試辦結果。</p></section>')


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
    return '''<section class="project-section" aria-labelledby="plan-checks-heading" id="field-priority"><span id="methods" class="page-route" aria-hidden="true"></span><span id="methods-heading" tabindex="-1"></span>
<h3 id="plan-checks-heading">配置決定需要時，才補這些查核</h3>
<p>本期先從現有桶位與清運前回報建立基線。以下保留既有服務與需求查核題目，僅在配置判斷缺少相關證據時啟用，不替代日常回報或自動排成現勘。</p>
<p><strong>取消每區一點與固定三輪配額。</strong>下列是待釐清的決策疑點，不是必去場址清單，也不是需求排名。前3項先做資料或管理條件核對；第4項只有出現具體方案取捨才啟動。尚未聯繫機關、排定走查或取得現場結果。</p>
<nav class="reading-path" aria-label="百日計畫查核疑點">'''+''.join(f'<a href="#plan-check-{e(c["id"])}">{e(c["title"].split('：')[0])}</a>' for c in plan['checks'])+'''</nav>
<details class="persona-detail"><summary>什麼情況不查？</summary><ul><li>位置圖、既有明細或管理規則已足以支持該決定，就記下來源後結案。</li><li>答案不會改變任何選項，就移出本輪；不為補齊行政區或湊點數安排觀察。</li><li>沒有要比較的方案、查核無法分辨方案，或對照用途未定，就暫緩。其餘原候選點保留為資料索引，取消自動排程。</li><li>選點只對距離門檻敏感，尚未影響實際比較範圍時，先做桌面敏感度分析，不因此直接出勤。</li></ul></details>
'''+''.join(cases)+'''<p>查核紀錄至少寫明：待選方案、來源、未知、觸發理由、實際結果、因此採取或暫緩的決定。沒有改變決定的資訊不列為必做成果。<a href="#reader-field-forms">必要時使用空白紀錄表</a>。</p></section>
'''+render_schedule()+'''
'''


def build(page_path=None):
    plan = load()
    path = page_path or SITE / 'dist/index.html'
    page = path.read_text()
    assert page.count(START) == page.count(END) == 1
    page = re.sub(re.escape(START)+r'.*?'+re.escape(END), lambda _: START+render(plan)+END, page, flags=re.S)
    path.write_text(page)
    return plan


if __name__ == '__main__':
    build()
    print('Rendered decision checks within the hundred-day plan; no district quota or scheduled visits.')

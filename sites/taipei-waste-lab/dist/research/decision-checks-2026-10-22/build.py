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
<section class="project-section" id="plan-100day"><h3>百日工作安排：先建立基線，再小範圍試調</h3><p>以下為正式啟動後的相對規劃窗口；啟動日、人員、參與桶位與承接尚未確認。未通過前階段條件就暫緩，不為趕百日進度強行搬桶。</p><table class="plan-table"><thead><tr><th scope="col">規劃窗口</th><th scope="col">工作與交付</th><th scope="col">決策出口</th></tr></thead><tbody><tr><td data-label="規劃窗口">第1–15日</td><td data-label="工作與交付">確認參與清潔人員與既有桶位、容量、清運安排及責任；定回報機會、比較條件、成功／停止門檻，完成最小回報原型演練。</td><td data-label="決策出口">人員、資料保存與流程可承接才開始實際回報。</td></tr>
<tr><td data-label="規劃窗口">第16–40日</td><td data-label="工作與交付">維持現有桶位與原清運安排，累積清運前滿度、異常與缺測基線；測量回報負擔，覆核容量及清運間隔。</td><td data-label="決策出口">資料不足先修正回報方式或延後判讀，不以單次空桶選移出點。</td></tr>
<tr><td data-label="規劃窗口">第41–65日</td><td data-label="工作與交付">人工覆核候選；比較維持、頻率／容量或位置調整。確認移入需求、原區服務、核准及回退後，才實施小範圍調整。</td><td data-label="決策出口">條件齊備才執行；否則維持或補查，保留原因。</td></tr>
<tr><td data-label="規劃窗口">第66–100日</td><td data-label="工作與交付">按事前窗口回看移入與原服務區、滿度／異常、維運投入及可比參照，交付前後紀錄與限制。</td><td data-label="決策出口">保留、修正、調回或證據不足。實施較晚則如實交付未完成回看，不縮短窗口湊成果。</td></tr>
</tbody></table><p>不訂固定行政區配額、搬桶數或改善百分比；百日成果也可以是維持現況及其證據。實體調整仍須承接與核准，現在沒有試辦結果。</p></section>
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

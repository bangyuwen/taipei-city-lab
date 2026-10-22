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
<h3 id="plan-checks-heading">查核只為了改變一個具體決定</h3>
<p>位置圖已能回答清冊記載哪裡有設施。先用既有資料排除已能回答的問題；只有答案仍未知、不同答案會改變選項，而且現場能補上所缺證據時，才安排走查。</p>
<p><strong>取消每區一點與固定三輪配額。</strong>下列是待釐清的決策疑點，不是必去場址清單，也不是需求排名。前3項先做資料或管理條件核對；第4項只有出現具體方案取捨才啟動。尚未聯繫機關、排定走查或取得現場結果。</p>
<nav class="reading-path" aria-label="百日計畫查核疑點">'''+''.join(f'<a href="#plan-check-{e(c["id"])}">{e(c["title"].split('：')[0])}</a>' for c in plan['checks'])+'''</nav>
<details class="persona-detail"><summary>什麼情況不查？</summary><ul><li>位置圖、既有明細或管理規則已足以支持該決定，就記下來源後結案。</li><li>答案不會改變任何選項，就移出本輪；不為補齊行政區或湊點數安排觀察。</li><li>沒有要比較的方案、查核無法分辨方案，或對照用途未定，就暫緩。其餘原候選點保留為資料索引，取消自動排程。</li><li>選點只對距離門檻敏感，尚未影響實際比較範圍時，先做桌面敏感度分析，不因此直接出勤。</li></ul></details>
'''+''.join(cases)+'''<p>查核紀錄至少寫明：待選方案、來源、未知、觸發理由、實際結果、因此採取或暫緩的決定。沒有改變決定的資訊不列為必做成果。<a href="#reader-field-forms">必要時使用空白紀錄表</a>。</p></section>
<section class="project-section" id="plan-100day"><h3>百日內如何推進</h3><p>以下為相對於正式啟動日的規劃窗口，啟動日、人力與機關承接尚未確認。每階段可以交付「證據不足，暫不介入」，不以完成走查數量驗收。</p>
<table class="plan-table"><thead><tr><th scope="col">規劃窗口</th><th scope="col">工作與交付</th><th scope="col">決策出口</th></tr></thead><tbody>
<tr><td data-label="規劃窗口">第1–15日</td><td data-label="工作與交付">固定要支持的決定；用位置圖、明細與管理條件逐項消除疑點，列出查或不查的理由。</td><td data-label="決策出口">已能回答就結案；仍會改變選項的未知才進下一階段。</td></tr>
<tr><td data-label="規劃窗口">第16–35日</td><td data-label="工作與交付">只對通過條件的疑點安排定點確認。事前確認路段、時段、方法、必要人力及停止條件，保留未完成原因。</td><td data-label="決策出口">判斷沿用既有服務、去重、修正服務邊界，或仍須事件基線。</td></tr>
<tr><td data-label="規劃窗口">第36–65日</td><td data-label="工作與交付">只比較證據支持的選項；需要事件量測時先固定分母與方法，記錄反例及原服務區損失。</td><td data-label="決策出口">保留現況、比較指引／維護／配置，或因證據不足暫緩。</td></tr>
<tr><td data-label="規劃窗口">第66–100日</td><td data-label="工作與交付">交付可回查的選擇理由、未解缺口與責任清單，確認後續承接。</td><td data-label="決策出口">條件齊備才另提試辦；未齊備就交付停止或補證條件，不承諾百日內設桶。</td></tr>
</tbody></table><p>各階段以能否支持決定為準；資料足夠即可結案，無法補證時保留未知與暫緩理由。</p></section>'''


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

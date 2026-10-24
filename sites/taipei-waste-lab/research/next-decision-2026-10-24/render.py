"""Render the bounded next-decision evidence update without changing personas."""
import html
import json
import re
import runpy
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parents[3] / 'sites/taipei-waste-lab'
if not SITE.is_dir():
    SITE = HERE.parents[1]
START, END = '<!-- next-decision-start -->', '<!-- next-decision-end -->'


def render(result, assessment, web):
    e = html.escape
    sources = {source['id']: source for source in web['sources']}
    rows, details = [], []
    for case in result['scenarios']:
        lead = case['desk_lead']
        if lead:
            district = int(lead['candidate_id'][1:3])
            lead_text = f'{lead["name"]}（{lead["candidate_id"]}）'
            lead_link = f'<a href="#citywide-area-{district:02}">{e(lead_text)}</a>'
            distance = (f'街道清冊座標約 {lead["street_nearest_m"]:.1f} m；'
                        f'場所概略座標約 {lead["venue_nearest_m"]:.1f} m。')
            trace = (f'<p><strong>既有線索：</strong>{lead_link}。{e(distance)}'
                     f'街道列為「{e(lead["street_name"])}」；場所列為「{e(lead["venue_name"])}」，'
                     f'場所關係：{e(lead["venue_relation"])}。直線距離不代表步行距離、同一實體或目前可用。</p>')
        else:
            lead_link = '未指定地點；先確認原路線與收受條件'
            distance = '已查得官方領袋設施來源，尚未確認本情境可用的投放點。'
            trace = ''
        citations = ''.join(f'<a href="{e(sources[key]["url"], quote=True)}" target="_blank" rel="noopener noreferrer">{e(sources[key]["title"])}</a> ' for key in case['source_ids'])
        rows.append(f'<tr><th scope="row" data-label="情境與原文依據"><a href="#persona-{case["id"]}">{e(case["label"])}</a> · <a href="#definition-evidence-{case["evidence_id"]}">{case["evidence_id"]}</a></th>'
                    f'<td data-label="已補上的桌面對照">{lead_link}<br>{e(distance)} <a href="#decision-context-{case["id"]}">依據與界線</a></td>'
                    f'<td data-label="現在可作的決定">{e(case["decision"])}</td></tr>')
        plan_links = ' · '.join(f'<a href="#plan-check-{key}">{key}</a>' for key in case['plan_refs'])
        details.append(f'<details class="persona-detail"><summary id="decision-context-{case["id"]}">{e(case["label"])}：情境依據、比較範圍與剩餘缺口</summary>'
                       f'<p><strong>原文已知：</strong>{e(case["known"])}</p><p><strong>桌面對照：</strong>{e(case["comparison"])}</p>'
                       + trace + f'<p><strong>仍需實際證據：</strong>{e(case["residual"])}</p>'
                       f'<p>{citations}<a href="#definition-evidence-{case["evidence_id"]}">回查{case["evidence_id"]}判讀</a> · {plan_links}</p></details>')
    rules = ''.join(f'<tr><th scope="row" data-label="實際證據支持的情況">{e(rule["condition"])}</th><td data-label="因此比較或暫緩什麼">{e(rule["action"])}</td></tr>' for rule in assessment['decision_rules'])
    return ('<section class="research-overview-section reading-stage" aria-labelledby="analysis-pending" data-reading-stage="pending">'
            '<h3 id="analysis-pending">下一個決定還缺什麼</h3>'
            '<p class="research-update">2026-10-24：桌面情境對照與決策條件已補齊；實際事件連結尚未驗證。</p>'
            '<p data-feedback-privacy="redacted"><strong>個別留言與可重建個人內容已因隱私移除。</strong>'
            '保留四筆情境的結構、彙總與研究者提出的桌面查核線索；地點不是留言者的已知行程，也未排定走查。</p>'
            f'<p><strong>來源彙總：</strong>保留 {result["source_personas"]} 筆結構；原摘要記載完成投放 {result["source_disposal_completed_accounts"]} 筆，'
            f'最後結果未交代 {result["other_source_final_outcomes_unknown"]} 筆。個別內容不公開；可核實的事件時間與點位配對仍為 '
            f'{result["verified_event_links"]}／{result["source_personas"]}。這是選例的資料完整性，不能當成投放失敗率或全市需求量。</p>'
            '<table class="plan-table" aria-describedby="decision-source-dates"><caption class="visually-hidden">四種情境：已補齊的桌面依據與當前研究決定</caption>'
            '<thead><tr><th scope="col">情境與原文依據</th><th scope="col">已補上的桌面對照</th><th scope="col">現在可作的決定</th></tr></thead><tbody>'
            + ''.join(rows) + '</tbody></table>'
            '<p id="decision-source-dates" class="research-update">距離沿用既有分析：2026-10-18站點、9/30街道清冊與8/18場所表；'
            '不是10/24現場狀態。公館與劍潭的街道、場所紀錄分列，不相加成可用桶數；沒有事件的欄位維持未知。</p>'
            + ''.join(details)
            + '<details class="persona-detail"><summary id="decision-choice-rules">補到哪種證據，才改選哪個方案？</summary>'
            '<table class="plan-table"><thead><tr><th scope="col">實際證據支持的情況</th><th scope="col">因此比較或暫緩什麼</th></tr></thead><tbody>'
            + rules + '</tbody></table><p>判讀不明或條件不同時，保留未知；不為湊點數擴大觀察，也不從交通量推估垃圾需求。'
            '<a href="#plan-check-Q04">沿用百日計畫Q04的啟動與停止條件</a>。</p></details>'
            '<details class="persona-detail"><summary id="decision-event-link">現場資料如何接回人物、地點與下一個決定？</summary>'
            '<p>' + e(assessment['join_rule']) + '</p>'
            '<p>沿用既有旅程事件表：實際時間與位置、投放物來源、已知路線、遇見設施、可見阻礙、本人負擔與最後結果逐欄記錄。'
            '個別留言與可重建個人內容已因隱私移除。</p>'
            '<p>同一事件可標多種情境；沒有物品來源或本人陳述就不猜人物。計數只納入窗內直接觀察、已去重且已覆核的嘗試；'
            '結果未明另列，未觀察不能填0。去重未完成就停止合計。<a href="#reader-field-forms">既有空白事件表與填寫規則</a>。</p></details>'
            '<p><strong>交付狀態：</strong>情境對照、來源界線、比較選項與事件連結規則已完成；'
            '實際路線、時段、可用性、訪談及配置成效尚無新紀錄。原Persona的空白保留，不能用研究者的假設回填。'
            '<a href="#analysis-next">銜接百日計畫</a> · <a href="#demand-evidence">回查原文支持範圍</a></p></section>')


def build(page_path=None):
    result = runpy.run_path(str(HERE / 'analyze.py'))['analyze']()
    assessment = json.loads((HERE / 'assessment.json').read_text())
    web = json.loads((HERE / 'web-evidence.json').read_text())
    article = render(result, assessment, web)
    path = page_path or SITE / 'dist/index.html'
    page = path.read_text()
    if START in page:
        pattern = re.escape(START) + r'.*?' + re.escape(END)
    else:
        pattern = r'<section\b[^>]*aria-labelledby="analysis-pending"[^>]*>.*?</section>'
    page, count = re.subn(pattern, lambda _: START + article + END, page, flags=re.S)
    if count != 1:
        raise ValueError('Expected one next-decision destination')
    path.write_text(page)
    (HERE / 'results.json').write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    return result


if __name__ == '__main__':
    result = build()
    print(f'Rendered four decision contexts; verified event links {result["verified_event_links"]}/{result["source_personas"]}.')

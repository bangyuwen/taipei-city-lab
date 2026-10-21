"""Publish the ten reviewed district readers within the existing site layout."""
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


def section(district, points, context):
    rows, streets = [], []
    for point in points:
        venue, street = point['venue'], point['street']
        relation = '同站名線索' if point['relation'] == '同站名' else '鄰近的不同場域'
        rows.append(f'''<tr>
<td data-label="觀察錨點與活動"><strong>{e(point['candidate_id'])} {e(point['name'])}</strong><br>七月借還端點 {point['events']:,} 次；全市活動序 {point['city_rank']}<br><a href="https://www.google.com/maps/search/?api=1&amp;query={point['lat']},{point['lon']}" target="_blank" rel="noopener noreferrer">觀察站點位置</a></td>
<td data-label="已有的場所依據"><strong>{e(venue['name'])}</strong> · {relation}<br>原表第 {venue['row']} 列（{e(venue['source_area'])}），備註「{e(venue['remark'])}」；距場所概略座標約 {venue['source_coordinate_distance_m']:.0f} m。<br>{e(point['evidence_scope'])}</td>
<td data-label="下一個查核問題">{e(point['next_check'])}</td>
</tr>''')
        streets.append(f'''<tr><td data-label="觀察錨點">{e(point['candidate_id'])}</td><td data-label="最近街道紀錄">{e(street['name'])}<br>{e(street['source_area'])}；原表第 {street['row']} 列</td><td data-label="座標直線距離">約 {street['source_coordinate_distance_m']:.0f} m</td></tr>''')
    scenarios = []
    for s in district['scenarios'][1:]:
        label = '排除 7/10、7/11（300 m）' if s['metric'] == 'events_excluding_flags' else f'{s["gap_m"]} m'
        if s['same_order_as_primary']:
            change = '保留 3/3 點，順位相同'
        else:
            change = (f'保留 {s["retained_of_primary3"]}/3 點；不再選「'
                      + '、'.join(s['removed']) + '」，改選「' + '、'.join(s['added']) + '」')
        scenarios.append(f'<li><strong>{label}：</strong>{e(change)}。</li>')
    sensitive = any(not s['same_order_as_primary'] for s in district['scenarios'])
    limit = ('本區會隨點間隔換點，主名單只作首輪觀察安排，不能視為唯一配置答案。'
             if sensitive else
             '本區在這些規則下名單與順位相同，只支持保留觀察點，不證明垃圾需求或最佳桶位。')
    area, code = district['area'], district['code']
    return f'''<section class="citywide-district" aria-labelledby="citywide-area-{code}">
<h4 id="citywide-area-{code}" tabindex="-1">{e(area)} · 分區分析</h4>
<p><strong>2026-10-20 複查：三個觀察主候選點及順位不變。</strong>沿用七月借還活動與 300 m 點間隔重算；場所處數不作桶數或權重。下表區分場所原文、能支持的範圍與待查問題，尚未決定新設桶位。</p>
{context}
<table class="plan-table"><thead><tr><th scope="col">觀察錨點與活動</th><th scope="col">已有的場所依據</th><th scope="col">下一個查核問題</th></tr></thead><tbody>{''.join(rows)}</tbody></table>
<p>場所來源更新：2026-08-18；10/20 複查內容相同。列號含表頭。<a href="{CATALOG}" target="_blank" rel="noopener noreferrer">官方街道與場所原表</a>。備註「處」保留原文，未確認實體桶數或目前可用性；同站名也未必對應指定出口，不同場域則不能直接當作替代服務。概略座標距離不是到桶的步行距離或服務半徑。</p>
<details class="feedback-codebook"><summary>補充：最近街道紀錄，只作清冊查核</summary>
<p>全市街道主檔 681 列中 680 列座標有效，依全市有效紀錄找最近點；跨區來源照列。位置接近仍須核實箱況、路徑與開放條件，較遠也不能判缺桶。場所與街道紀錄可能指向同一設施，未確認前不相加。</p>
<table class="plan-table"><thead><tr><th scope="col">觀察錨點</th><th scope="col">最近街道紀錄</th><th scope="col">座標直線距離</th></tr></thead><tbody>{''.join(streets)}</tbody></table>
</details>
<p><strong>規則敏感度：</strong>{limit}</p>
<ul>{''.join(scenarios)}</ul>
<p><strong>仍缺的證據：</strong>本區 {district['unknown_activity_stations']} 個啟用有效站未配對到七月活動，維持未知；表列三點的實際箱號、桶數、出入口位置、開放與接收條件、步行路徑、管理者及投放量都未查核。<a href="#analysis-candidate-recheck">回看全市複查結論</a>。</p>
</section>'''


def update():
    result = json.loads((HERE / 'results.json').read_text())
    index = SITE / 'dist/index.html'
    page = index.read_text()
    finding = ('<li><strong>12 區觀察主名單保留，場所線索已逐點核對。</strong>'
               '北投、南港及其餘 10 區都已補上場所原文、支持範圍與缺口。'
               '信義、萬華、文山會隨點間隔換點；場所處數不當桶數，單一排序不當配置答案。'
               '<a href="#analysis-candidate-recheck">查看全市複查與逐點問題</a>。</li>')
    page, count = re.subn(r'<li><strong>(?:北投、南港|12 區觀察主名單).*?</li>',
                         lambda _: finding, page, count=1, flags=re.S)
    assert count == 1
    start, end = '<!-- candidate-recheck-20261020:start -->', '<!-- candidate-recheck-20261020:end -->'
    summary = '''<section class="research-overview-section" aria-labelledby="analysis-candidate-recheck">
<h3 id="analysis-candidate-recheck">12 區複查：主名單保留，來源與缺口逐點列明</h3>
<p>10/20 補完其餘 10 區 30 點。原分析已有場所座標，本次補原文與判讀；處數不作桶數或權重。</p>
<dl class="problem-evidence">
<div><dt>30 點的場所對應</dt><dd>18 點有同站名線索，12 點屬不同場域；6 點引用跨區紀錄。萬隆站與花木市場共用一筆來源，不能重複累計。</dd></div>
<div><dt>三區會隨點間隔換點</dt><dd>信義、萬華在 500 m 換點，文山在 150／500 m 換點。各區已列替換名單；排除兩個標記日後主名單不變。</dd></div>
</dl>
<p>仍缺實際設施、步行、使用條件及投放量，尚不能決定增設或移設。<a href="#districts">逐區看原文與缺口</a> · <a href="#citywide-area-12">北投</a> · <a href="#citywide-area-09">南港</a> · <a href="#hotspot-quality">資料限制</a></p>
</section>'''
    page, count = re.subn(re.escape(start) + r'.*?' + re.escape(end),
                         lambda _: start + '\n' + summary + '\n' + end, page, flags=re.S)
    assert count == 1
    for district in result['districts']:
        code, area = district['code'], district['area']
        pattern = f'(<article class="reader-item" id="reader-district-{code}".*?>)(.*?)(</article>)'
        article = re.search(pattern, page, re.S)
        assert article
        old_section = re.search(r'<section class="citywide-district".*?</section>',
                                article.group(2), re.S)
        assert old_section
        context = re.search(r'<p>既有回饋脈絡：.*?</p>', old_section.group(), re.S).group()
        points = [p for p in result['candidates'] if p['source_area'] == area]
        body = article.group(2).replace(old_section.group(), section(district, points, context), 1)
        note_id = f'plan-area-{code}-venue-check'
        handoff = (f'<p id="{note_id}"><strong>本輪需補的交接資料：</strong>'
                   '逐點位置與箱號、來源紀錄是否重複、管理者及開放與接收規則；'
                   '現勘再記錄步行與投放結果。場所原文不得填作已核實桶數。'
                   f'<a href="#citywide-area-{code}">依三點問題逐項核對</a>。</p>')
        if f'id="{note_id}"' in body:
            body = re.sub(fr'<p id="{note_id}">.*?</p>', lambda _: handoff, body, flags=re.S)
        else:
            anchor = f'<p>建議執行窗口：{area}清潔隊；區公所協助區里協調，實際箱位管理者另查。</p>'
            assert body.count(anchor) == 1
            body = body.replace(anchor, anchor + handoff)
        page = page[:article.start()] + article.group(1) + body + article.group(3) + page[article.end():]
    # The previous two cards now link to the expanded citywide summary.
    page = page.replace('>回看兩區複查結論</a>', '>回看全市複查結論</a>')
    index.write_text(page)
    print('Updated 10 district readers, citywide summary and two existing return-link labels.')


if __name__ == '__main__':
    update()

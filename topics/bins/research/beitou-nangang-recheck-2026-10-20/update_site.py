"""Update only this review's summary and the two existing district readers."""
import html
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
SITE = HERE.parent.parent
if (HERE.parents[3] / "sites/taipei-waste-lab").is_dir():
    SITE = HERE.parents[3] / "sites/taipei-waste-lab"
CATALOG = 'https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c'
SOURCE_LINK = f'<a href="{CATALOG}" target="_blank" rel="noopener noreferrer">官方街道與場所原表</a>'
START = '<!-- candidate-recheck-20261020:start -->'
END = '<!-- candidate-recheck-20261020:end -->'


def e(value):
    return html.escape(str(value), quote=True)


def district_section(code, area, points, prior_context, unknown):
    rows, street_rows = [], []
    for p in points:
        v, s = p['venue'], p['street']
        rows.append(f'''<tr>
<td data-label="觀察錨點與活動"><strong>{e(p['candidate_id'])} {e(p['name'])}</strong><br>七月借還端點 {p['events']:,} 次；全市活動序 {p['city_rank']}<br><a href="https://www.google.com/maps/search/?api=1&amp;query={p['lat']},{p['lon']}" target="_blank" rel="noopener noreferrer">觀察站點位置</a></td>
<td data-label="已有的場所依據"><strong>{e(v['name'])}</strong>（來源區：{e(v['source_area'])}）<br>原表第 {v['row']} 列，備註「{e(v['remark'])}」；距場所概略座標約 {v['source_coordinate_distance_m']:.0f} m。<br>{e(p['evidence_scope'])}</td>
<td data-label="下一個查核問題">{e(p['next_check'])}</td>
</tr>''')
        street_rows.append(f'''<tr><td data-label="觀察錨點">{e(p['candidate_id'])}</td><td data-label="最近街道紀錄">{e(s['name'])}<br>{e(s['source_area'])}；原表第 {s['row']} 列</td><td data-label="座標直線距離">約 {s['source_coordinate_distance_m']:.0f} m</td></tr>''')
    extra = ('後山埤的場所紀錄列在信義區，已跨區保留；不把其備註「12處」加到南港的場所處數。南港車站最近的街道紀錄位於「內湖焚化廠內」，不能當作可步行使用的替代投放點。'
             if code == '09' else
             '北投站與奇岩站先核對同站名場所的出口與使用條件；運動中心另查館內外。三個點最近的街道紀錄都列在士林區，這反映北投街道清冊缺列，不能當成必須攜帶垃圾走過的距離。')
    return f'''<section class="citywide-district" aria-labelledby="citywide-area-{code}">
<h4 id="citywide-area-{code}" tabindex="-1">{area} · 分區分析</h4>
<p><strong>2026-10-20 複查：三個觀察錨點及順位不變。</strong>這次補回場所備註，沒有新增場所座標；重算仍依七月借還活動與 300 m 點間隔選點，處數不作排序權重。下表是查核安排，尚未決定新增垃圾桶。</p>
{prior_context}
<p><strong>本區查核重點：</strong>{extra}</p>
<table class="plan-table"><thead><tr><th scope="col">觀察錨點與活動</th><th scope="col">已有的場所依據</th><th scope="col">下一個查核問題</th></tr></thead><tbody>
{''.join(rows)}
</tbody></table>
<p>場所來源更新：2026-08-18；10/20 複查內容相同。列號含表頭。{SOURCE_LINK}。場所的「處」保留原文，未確認實體桶數、各處位置或目前可用性；概略座標距離不是到桶的步行距離，也不是服務覆蓋半徑。</p>
<details class="feedback-codebook"><summary>補充：最近街道紀錄，只作清冊查核</summary>
<p>街道主檔 681 列中 680 列座標有效；依全市有效紀錄尋找最近點，跨區結果照列。清冊不完整、場內限制與步行阻隔尚待確認，不能用這些距離判缺桶或推薦前往。</p>
<table class="plan-table"><thead><tr><th scope="col">觀察錨點</th><th scope="col">最近街道紀錄</th><th scope="col">座標直線距離</th></tr></thead><tbody>{''.join(street_rows)}</tbody></table>
</details>
<p><strong>規則複查：</strong>主規則 300 m，以及改成 150 m、500 m、排除 7/10 與 7/11 後的 300 m，四組名單與順位均相同。這只支持在這些規則下保留觀察點，不證明垃圾需求或最佳設桶位置。</p>
<p><strong>仍缺的證據：</strong>本區 {unknown} 個啟用有效站沒有配對到七月活動，維持未知；表列三點的實際箱號、出入口位置、接收及開放條件、步行路徑、管理者與投放量都未查核，不能因備註補回而視為已解決。<a href="#analysis-candidate-recheck">回看兩區複查結論</a>。</p>
</section>'''


def update():
    result = json.loads((HERE / 'results.json').read_text())
    index = SITE / 'dist/index.html'
    page = index.read_text()
    finding = ('<li><strong>北投、南港六個觀察點不變，下一步逐點核對場所服務。</strong>'
               '兩區分別有 10／5 筆場所紀錄；補回備註後，重算名單與順位均相同。'
               '捷運站要查出口與站外使用條件，北投運動中心另查館內外。'
               '場所處數不當桶數，街道清冊缺列仍不能判缺桶。'
               '<a href="#analysis-candidate-recheck">查看兩區複查與逐點問題</a>。</li>')
    page, count = re.subn(r'<li><strong>北投、南港.*?</li>',
                         lambda _: finding, page, count=1, flags=re.S)
    assert count == 1
    summary = '''<section class="research-overview-section" aria-labelledby="analysis-candidate-recheck">
<h3 id="analysis-candidate-recheck">北投、南港：六個觀察點不變，查核事項更具體</h3>
<p>10/20 重算：原分析已使用 130 筆場所座標，本次只補回備註。處數不作桶數或排序權重。</p>
<dl class="problem-evidence">
<div><dt>北投：兩站查出口，運動中心另查館內外</dt><dd>北投、奇岩有同站名線索；運動中心最近紀錄是唭哩岸站。<a href="#citywide-area-12">北投三點原文與缺口</a></dd></div>
<div><dt>南港：三站查站內外銜接</dt><dd>查展覽館第 5 出口、市民大道側與後山埤第 3 出口；後山埤場所列在信義區，跨區保留。<a href="#citywide-area-09">南港三點原文與缺口</a></dd></div>
</dl>
<p>300 m 主規則、150／500 m、排除兩個標記日的名單與順位皆相同。仍缺實際設施、步行、使用條件及投放量，尚不能決定增設或移設。<a href="#hotspot-quality">資料限制</a></p>
</section>'''
    block = START + '\n' + summary + '\n' + END
    if START in page:
        page, count = re.subn(re.escape(START) + r'.*?' + re.escape(END),
                             lambda _: block, page, flags=re.S)
        assert count == 1
    else:
        marker = '<!-- coverage-recheck-20261020:end -->'
        assert page.count(marker) == 1
        page = page.replace(marker, marker + '\n' + block)
    for code, area in [('09', '南港區'), ('12', '北投區')]:
        pattern = f'(<article class="reader-item" id="reader-district-{code}".*?>)(.*?)(</article>)'
        article = re.search(pattern, page, re.S)
        assert article
        old_section = re.search(r'<section class="citywide-district".*?</section>',
                                article.group(2), re.S)
        assert old_section
        context = re.search(r'<p>既有回饋脈絡：.*?</p>', old_section.group(), re.S).group()
        points = [p for p in result['candidates'] if p['source_area'] == area]
        district = next(d for d in result['districts'] if d['area'] == area)
        updated = district_section(code, area, points, context, district['unknown_activity_stations'])
        body = article.group(2).replace(old_section.group(), updated, 1)
        note_id = f'plan-area-{code}-venue-check'
        handoff = (f'<p id="{note_id}"><strong>本輪需補的交接資料：</strong>'
                   '逐點位置與箱號、出口內外、管理者、接收與開放規則；現勘再記錄實際步行及投放結果。'
                   '場所原文備註不能填入「已核實桶數」。'
                   f'<a href="#citywide-area-{code}">依上表三點逐項核對</a>。</p>')
        if f'id="{note_id}"' in body:
            body = re.sub(fr'<p id="{note_id}">.*?</p>', lambda _: handoff, body, flags=re.S)
        else:
            anchor = f'<p>建議執行窗口：{area}清潔隊；區公所協助區里協調，實際箱位管理者另查。</p>'
            assert body.count(anchor) == 1
            body = body.replace(anchor, anchor + handoff)
        replacement = article.group(1) + body + article.group(3)
        page = page[:article.start()] + replacement + page[article.end():]
    index.write_text(page)
    print('Updated analysis summary and district 09/12 readers; other readers preserved.')


if __name__ == '__main__':
    update()

"""Render reviewed research outputs into the existing public reader and local brief."""
import csv
import html
import json
import shutil
from pathlib import Path

ROOT=Path(__file__).resolve().parent
SITE=ROOT.parents[1]
if (ROOT.parents[3]/'sites/taipei-waste-lab').is_dir():
 SITE=ROOT.parents[3]/'sites/taipei-waste-lab'
e=html.escape


def table(headers, rows):
    return '<table class="plan-table"><thead><tr>'+''.join('<th scope="col">'+e(x)+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td data-label="{e(h)}">{v}</td>' for h,v in zip(headers,row))+'</tr>' for row in rows)+'</tbody></table>'


def main():
    page=SITE/'dist/index.html';text=page.read_text()
    start_marker='<!-- gongguan-delivery:start -->'
    end_marker='<!-- gongguan-delivery:end -->'
    if text.count(start_marker)!=1 or text.count(end_marker)!=1 or text.index(start_marker)>=text.index(end_marker):
        raise RuntimeError('Historical Gongguan markers are absent or invalid; use the citywide publisher for the current site.')
    start=text.index(start_marker);end=text.index(end_marker)+len(end_marker)
    s=json.loads((ROOT/'results/summary.json').read_text())
    q=json.loads((ROOT/'results/quality.json').read_text())
    g=json.loads((ROOT/'government/government.json').read_text())
    share=s['top5_events']/s['noncampus_events_500m']*100
    questions={
        'C1':'先查既有桶的可用性、過街與尖峰滿溢；不可因活動最多就增桶。',
        'C2':'比對 2024 近處紀錄與現場路徑；確認資訊落差、遷移或清冊漏列，不能直接判缺桶。',
        'C3':'先走查路口及 2024 近處線索；若有可用服務，優先比較指引，不把距離較遠視為增桶證據。',
        'C4':'先查水源市場前紀錄的可用性與維護；服務對象及管理界線另查。',
        'C5':'與 C1 共享同一近處清冊線索；查出口方向與過街，避免重複計算新增需求。'}
    source_link=lambda ids:' · '.join(f'<a href="#hotspot-source-{e(i)}">{e(i)}</a>' for i in ids)
    rows=[]
    for r in s['shortlist']:
        location=f'https://www.google.com/maps/search/?api=1&amp;query={r["lat"]},{r["lon"]}'
        rows.append([f'<strong>{r["candidate_id"]} {e(r["name"])}</strong><br><a href="{location}" target="_blank" rel="noopener noreferrer">查看站點位置</a>',
            f'{r["events"]:,}<br>借 {r["borrow"]:,}／還 {r["return"]:,}',
            f'{r["bins2026_nearest_m"]:.1f} m<br>{e(r["bins2026_nearest_name"])}', e(questions[r['candidate_id']])])
    candidates=table(['觀察錨點','七月檔已觀測活動','最近街道清冊紀錄（直線）','先查什麼'],rows)
    def figure(name,alt,caption):
        return f'<figure class="hotspot-figure"><div class="hotspot-chart" role="region" tabindex="0" aria-label="{e(alt)}；窄螢幕可左右捲動"><img src="images/hotspots/{name}.png" alt="{e(alt)}" loading="lazy"></div><figcaption>{caption}</figcaption></figure>'
    scope_table=table(['變動條件','可排序非校區分類站','前五名'],[[f'{r["radius_m"]} m',str(r['eligible_stations']),'C1 → C2 → C3 → C4 → C5'] for r in s['sensitivity']]+[['排除 7/10、7/11','沿用 500 m 的 15 站','C1 → C2 → C3 → C4 → C5']])
    work_rows=[]
    for w in g['proposed_raci']:
        work_rows.append([e(w['id']+' '+w['name']),e(w['accountable_lead']),'<br>'.join(e(x) for x in w['implementers_and_cooperators']),
            '<strong>交付：</strong>'+e('；'.join(w['outputs']))+'<br><strong>驗收：</strong>'+e('；'.join(w['acceptance_criteria']))+'<br><strong>交接：</strong>'+e(w['handoff'])+'<br>'+source_link(w['verified_existing_duties'])])
    works=table(['工作包','建議主責（尚待確認）','執行與協作','交付、驗收與交接'],work_rows)
    duties='<ul>'+''.join(f'<li><strong>{e(x["organization"])}：</strong>{e(x["verified_duty"])} {source_link(x["sources"])}</li>' for x in g['verified_existing_duties'])+'</ul>'
    flow='<ol class="hackathon-flow">'+''.join(f'<li><strong>{e(x["phase"])} · {e(x["relative_timing"])}：</strong>{e(x["exit_condition"])}</li>' for x in g['workflow'])+'</ol>'
    stop='<ul>'+''.join('<li>'+e(x)+'</li>' for v in g['stop_conditions'].values() for x in v)+'</ul>'
    intake=g['single_issue_intake_and_triage']
    routing=table(['問題類型','建議分流'],[[e(x['issue']),e(x['proposed_route'])] for x in intake['triage_map']])
    gov_sources='<ol>'+''.join(f'<li id="hotspot-source-{e(x["id"])}"><a href="{e(x["url"],quote=True)}" target="_blank" rel="noopener noreferrer">{e(x["id"]+" · "+x["organization"]+"："+x["title"])}</a>（查閱 {e(x["accessed_at"])}）</li>' for x in g['sources'])+'</ol>'
    fragment=f'''<!-- gongguan-delivery:start -->
<section class="research-overview-section hotspot-results" aria-labelledby="hotspot-heading">
<h3 id="hotspot-heading" tabindex="-1">你的兩項交付已完成桌面版：五處活動熱點與政府分工</h3>
<p><strong>先查公館 2 號出口，再查其餘四處；優先確認既有服務。</strong>500 公尺內 15 個非校區分類站的已配對活動，前五占 {share:.1f}%。其中 C1、C4、C5 距 2026 清潔箱紀錄不到 50 公尺，因此不能直接主張增桶。這是現場查核優先序，尚未證實垃圾熱點。</p>
<p>已交付：官方資料重算、來源品質檢查、五處查核表、分時觀察方案、10 個政府工作包與交接條件。未完成：現勘、機關同意、實際設點、配置工具及清潔成效驗證。其他成員的產品工作維持原分工。</p>
<nav class="research-overview-nav" aria-label="熱點分析與政府分工成果"><a href="#hotspot-candidates">五處查核點</a><a href="#hotspot-times">觀察時段</a><a href="#hotspot-quality">資料限制</a><a href="#hotspot-government">政府分工</a><a href="#hotspot-handoff">交接與停止條件</a><a href="#hotspot-sources">來源</a></nav>
<h4 id="hotspot-candidates" tabindex="-1">五處觀察錨點：有活動，不等於需要新桶</h4>
<p>分析中心為公館 2 號出口，直線半徑 500 m。以 2026-10-18 啟用站快照匹配七月借還檔，範圍內共 42 站：15 站來源分類非臺大公館校區、27 站分類為校區。分類不是土地權屬認定。以下按非校區分類站的觀測活動排序，位置連結指向站點，不是新垃圾桶位置。</p>
{candidates}
{figure('activity-ranking','五處站點的七月檔已觀測活動；完整數值見上表','借與還各計一次，區內同一旅程可能計兩端；不是人數或垃圾量。前五 198,526 次／15 站 301,904 次。<a href="#hotspot-quality">日期缺口與配對限制</a>隨結果保留。')}
{figure('station-context','五站與既有箱位的相對座標','座標圖沒有道路底圖；直線距離不代表步行可達或同側道路。C1 與 C5 最近指向同一筆街道清冊紀錄，不能當兩個獨立服務缺口。')}
<h4 id="hotspot-times" tabindex="-1">先觀察 18–19 時，以 10–11 時作對照</h4>
<p>排除品質標記日後，前五站合計在 18–19 時的觀測平均最高：平日每日期 758.9 次（22 日），週末 562.1 次（7 日）；10–11 時分別為 181.5、255.4 次。這是七月暑假的小時精度活動，不能當現在垃圾尖峰。</p>
{figure('activity-hours','前五站平日與週末的每小時觀測活動','平均分母排除 7/10、7/11，未補值；其餘日期的完整性仍未確認。用途是安排對照觀察，不據此計算垃圾清運班次。')}
<p><strong>尚未執行的最小基線：</strong>2 個平日＋1 個週末日，C1–C5 各於 10–11、18–19 時窗觀察 15 分鐘，共 30 站次。固定觀察區、起訖時間與方法；記實際日期、天候、清掃時點、桶況、散落垃圾、投放受阻及過街。未知留空，未完成與失真保留；不記臉孔或個人身分。</p>
<p><strong>用來作決定：</strong>若實際有可用桶且路徑順暢，先比較指引；若滿溢與清運時間相關，先討論維護；只有確認服務缺口、通行與管理條件後，才交由配置成員比較設點。30 站次本身不能證明改善成效。</p>
<h4 id="hotspot-quality" tabindex="-1">來源有缺口；排序穩定不代表資料完整</h4>
<ul><li>官方目錄最新列出 2026-07；ZIP 有 7,596,992 筆紀錄。7/11 無借車列、還車僅 7 列；7/10 借車僅 13,249 列，低於每日中位數 272,491 的 10%。原因未知，不能視為零需求或完整月總量。</li><li>全檔借車端有 22,230 次、還車端 133,671 次未精確匹配十月站點；保留未匹配，不做模糊配對。跨縣市、站名損字、改名及跨期變動可能影響覆蓋，但各原因占比未驗證。校區一站無配對觀測，維持未知。</li><li>站點、使用月份、街道清冊（2026-09-30）與場所清冊（2026-08-18）跨日期。清冊完整性、箱體狀態、路徑與垃圾量未核實。2024 位置只供查核，不能據差異斷言撤桶。</li><li>公車檔是 2021 站位資料，未附投影定義且原始座標呈經緯度形式；未取得逐站上下車量，本輪不納入量化排序，也不以站牌數冒充人流。政府資料補件列入工作包。</li><li>來源時間精度為小時，未提供旅程 ID；不任意刪除同時同站相同列，也無法驗證來源重複率。此次不做因果成效或全市最佳配置主張。</li></ul>
{scope_table}
<p>主規則在讀取行程結果前固定；看到日期問題後另加排除異常日的敏感度，保留原始結果。五站獨立從原 ZIP 逐列核對，距離另用球面餘弦交叉計算，差異小於 0.02 m；此項是計算核對，不能代替現勘。</p>
<h4 id="hotspot-government" tabindex="-1">政府分工：環保局統籌提案，交通與場地單位各依權責確認</h4>
<p><strong>以下主責、協作、時程及驗收都是本案提案，尚未由機關承諾。</strong>已有職掌依官方來源列在前，專案工作包列在後。每包只設一個協調主責，不代表它能代替其他管理者核准。五個活動錨點跨大安／中正來源分類；實際箱位與土地界線仍須逐點確認。</p>
<h5>已核對的既有職掌</h5>{duties}
<h5>建議工作包與交接</h5>{works}
<h4 id="hotspot-handoff" tabindex="-1">交接流程與執行條件</h4>
<p>以下是相對時程建議。T0 為日後各參與者確認啟動的日期，現在尚未啟動機關協作；不是法定處理時限或已排定日程。</p>{flow}
<p><strong>案件入口：</strong>{e(intake['public_entry'])} 未在本次研究代送案件。研究資料、場域許可與實際營運問題分別交對應工作包核對。</p>{routing}
<p>{e(intake['privacy_rule'])}</p>
<h5>停止或退回補件</h5>{stop}
<h4 id="hotspot-sources" tabindex="-1">資料與機關來源</h4>
<ul><li><a href="https://data.gov.tw/dataset/150635" target="_blank" rel="noopener noreferrer">交通局 YouBike 2.0 租借紀錄</a>：本次保存 2026-07 ZIP、目錄與雜湊，2026-10-19 下載；月份有缺口。</li><li><a href="https://data.gov.tw/dataset/137993" target="_blank" rel="noopener noreferrer">YouBike 即時站點目錄</a>：本研究沿用 2026-10-18 保存快照，不是當下可借還數。</li><li><a href="https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c" target="_blank" rel="noopener noreferrer">環保局清潔箱位置</a>：2026-09-30 街道、2026-08-18 場所與 2024 歷史副本各自保留。</li><li><a href="https://data.taipei/dataset/detail?id=48aa5bca-2a4f-4fb7-a658-43cba51d5d56" target="_blank" rel="noopener noreferrer">公車站牌位置圖</a>：2021-04-11 檔案，本次不列入人流或候選排序。</li></ul>{gov_sources}
<p><a href="#definition-prd-roles-heading">回看你的分工</a> · <a href="#definition-decision-D17">本次執行紀錄</a></p>
</section>
<!-- gongguan-delivery:end -->'''
    text=text[:start]+fragment+text[end:]
    page.write_text(text)
    images=SITE/'dist/images/hotspots';images.mkdir(exist_ok=True)
    for name in ('activity-ranking','activity-hours','station-context'):
        shutil.copyfile(ROOT/f'results/figures/{name}.png',images/(name+'.png'))
    report=f'''# 公館熱點分析與政府分工：桌面交付

2026-10-19。你負責的兩項桌面成果已完成；現勘、政府核准及配置原型仍未執行。

## 結論

優先查公館 2 號出口，並查其餘四處。500 m 內 15 個非校區分類站的已觀測活動為 {s['noncampus_events_500m']:,} 次，前五 {s['top5_events']:,} 次，占 {share:.1f}%。其中三站距既有街道清冊紀錄不到 50 m；先確認可用、順路與滿溢，不能直接認定需要新桶。

**資料限制影響結論強度：**七月檔有缺日／異常日，數字是已觀測活動，不是完整月總量、人數或垃圾量。此結果支持現勘優先順序，不能支持全市最佳配置或改善成效。

| 順序 | 站點 | 觀測活動 | 最近 2026 清冊直線距離 | 查核重點 |
|---|---|---:|---:|---|
'''+''.join(f'| {r["candidate_id"]} | {r["name"]} | {r["events"]:,} | {r["bins2026_nearest_m"]:.1f} m | {questions[r["candidate_id"]]} |\n' for r in s['shortlist'])+'''
![活動排序](results/figures/activity-ranking.png)

![相對座標](results/figures/station-context.png)

## 方法與品質

以公館 2 號出口 (121.53438, 25.01491) 為中心，取直線 500 m。42 個啟用站中，15 個非校區分類站排序，27 個校區分類站另計；來源分類不是土地權屬。2026-07 借還檔按精確站名對應 2026-10-18 快照。借與還各算一次，同一旅程可計兩端。

官方檔有 7,596,992 列。7/11 無借車列、還車 7 列；7/10 借車 13,249 列，低於每日中位數 272,491 的 10%。不補值、不改稱零需求。借車端 22,230 次、還車端 133,671 次未匹配，保留來源名稱與數量。臺大普通教學館東側無配對活動，保持未知。

300/500/700 m 分別有 9/15/26 個非校區分類站，前五同序；追加排除 7/10、7/11 後亦同序。主規則與追加敏感度分別見 [protocol.md](protocol.md)、[quality-amendment.md](quality-amendment.md)。逐列獨立核對五站端點，球面距離交叉核算差異小於 0.02 m，見 [validation.json](validation.json)。

來源只有小時精度，沒有旅程 ID，不能核實來源重複率。七月暑假、十月站點與不同日期清冊不能當成同步現況。場所資料不是逐箱清冊，2024 記錄不是目前可用證明。公車站位檔為 2021 且缺投影定義，不納入排序；逐站公車上下車量未取得。這些限制不以代理數字填補。

## 觀察安排與下一步

前五站觀測高點為 18–19 時；排除異常日後，平日每日期 758.9 次（22 日），週末 562.1 次（7 日）。對照時段 10–11 時為 181.5／255.4 次。沒有垃圾資料，故不推定垃圾尖峰。

![時段分布](results/figures/activity-hours.png)

建議首輪 2 平日＋1 週末，五站在兩時窗各觀察 15 分鐘，共 30 站次，尚未執行。固定觀察區、時長與方法；記天候、清掃時點、桶況、散落垃圾、投放受阻、過街與可用替代。一般非干擾觀察與需進場、佔用或介入的活動分開處理，後者先確認適用許可；不得阻礙通行。

有桶但找不到時交配置成員比較指引；反覆滿溢時交清潔端查維護；只有服務缺口、通行與權責證據齊全後，才提出實際箱位。研究不代替主管機關判定，也不代送申請。

## 政府工作分配

'''+(ROOT/'government/government-plan.md').read_text().replace('](../protocol.md)', '](protocol.md)').replace('](government.json)', '](government/government.json)')+'''

## 重現與交付檔

- 原始 ZIP：交付資料夾 `raw/202607-youbike.zip`；來源 URL、SHA-256 與保留位置見 [manifest.json](manifest.json)。官方目錄：[YouBike 租借紀錄](https://data.gov.tw/dataset/150635)。
- [analysis.ipynb](analysis.ipynb)：可執行研究筆記，已存表格與圖形輸出。
- [results/stations.csv](results/stations.csv)：700 m 內全站結果，沒有只保留前五。
- [results/hourly.csv](results/hourly.csv)、[results/quality-hourly.csv](results/quality-hourly.csv)：站點日期小時資料與追加分時敏感度。
- [government/government.json](government/government.json)：10 個工作包、職掌、來源與交接條件。

在本目錄、已安裝 `requirements-analysis.txt` 的 Python 環境：

```sh
python analyze.py --archive /path/to/202607-youbike.zip
python quality.py
python validate.py --archive /path/to/202607-youbike.zip
python figures.py
```

Notebook 可設定環境變數 `GONGGUAN_ARCHIVE` 指向同一 ZIP 後從頭執行。原始來源、清冊副本、結果與 notebook 保留在私人交付包；公開網站只發布摘要與圖形，不開放原始附件。

`publish_results.py` 僅供仍保留完整公館版標記的歷史網站重建；標記不存在或損壞時會停止，且不寫入任何檔案。現行全市網站請使用 `../taipei-citywide-2026-10-19/publish_results.py`。產生器不屬於私人研究包的獨立重算步驟。

## 90 秒講稿

我負責的是熱點分析與政府部門工作分配。我們用公館周邊實際保存的 YouBike 借還紀錄，挑出五個優先觀察位置。它們占區內非校區分類站已觀測活動約三分之二，但這不是垃圾量；原始月份還有兩個日期品質問題。

最重要的發現是，五處裡有三處離既有垃圾桶清冊不到五十公尺。因此我們不先說要多放桶，而是查桶能不能用、是不是順路，以及尖峰有沒有滿溢。若問題是資訊或維護，就先處理資訊和維護。

政府分工建議由環保局統籌清潔箱服務，清潔隊確認清運與維護，交通單位處理動線與運輸介面，實際道路或場地管理者確認權責。每一步都有交付與停止條件；還沒取得機關同意的部分都標成提案。這讓分析可以接到下一位成員的配置比較，而不把桌面推估當成已核准的設點方案。
'''
    (ROOT/'README.md').write_text(report)


if __name__=='__main__':main()

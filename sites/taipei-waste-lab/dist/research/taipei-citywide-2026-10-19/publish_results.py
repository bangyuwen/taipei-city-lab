# -*- coding: utf-8 -*-
"""Render citywide findings into the existing Site and a private research report."""
import html,json,shutil,re
from pathlib import Path
from delivery.build_handoff import build as build_handoff
ROOT=Path(__file__).resolve().parent;SITE=ROOT.parents[1];e=html.escape
if (ROOT.parents[3]/'sites/taipei-waste-lab').is_dir():
 SITE=ROOT.parents[3]/'sites/taipei-waste-lab'

def table(headers,rows):return '<table class="plan-table"><thead><tr>'+''.join('<th scope="col">'+e(h)+'</th>' for h in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join(f'<td data-label="{e(h)}">{x}</td>' for h,x in zip(headers,r))+'</tr>' for r in rows)+'</tbody></table>'
def figure(name,alt,caption):return f'<figure class="hotspot-figure"><div class="hotspot-chart" role="region" tabindex="0" aria-label="{e(alt)}；窄螢幕可左右捲動"><img src="images/citywide/{name}.png" alt="{e(alt)}" loading="lazy"></div><figcaption>{caption}</figcaption></figure>'
def window(h):return f'{h:02d}–{h+1:02d}時'
def main():
 field_plan=build_handoff()
 government_handoff=json.loads((ROOT/"delivery/government-actions.json").read_text())
 s=json.loads((ROOT/'results/summary.json').read_text());g=json.loads((ROOT/'government/government.json').read_text());ds=s['districts'];city=ds[:12];campus=ds[12]
 cityevents=sum(d['events'] for d in city);citystations=sum(d['eligible_stations'] for d in city);unknown=sum(d['unknown_stations'] for d in ds)
 overview=table(['行政區','啟用站／有觀測站','七月已觀測借還活動','街道列／場所列','首輪查核'],[[f'<a href="#citywide-area-{i:02d}">{e(d["source_area"])}</a>',f'{d["eligible_stations"]}／{d["observed_stations"]}',f'{d["events"]:,}',f'{d["street_rows"]}／{d["venue_rows"]}'+('<br><strong>優先補查清冊</strong>' if d['source_area'] in ['北投區','南港區'] else ''),'、'.join(e(c['name']) for c in s['candidates'] if c['source_area']==d['source_area'])] for i,d in enumerate(city,1)])
 details=[];district_plans=[];reportrows=[]
 for i,d in enumerate(ds,1):
  selected=[c for c in s['candidates'] if c['source_area']==d['source_area']];rows=[]
  for c in selected:
   mapurl=f'https://www.google.com/maps/search/?api=1&amp;query={c["lat"]},{c["lon"]}'
   rows.append([f'<strong>{e(c["candidate_id"])} {e(c["name"])}</strong><br><a href="{mapurl}" target="_blank" rel="noopener noreferrer">站點位置</a>',f'{c["events"]:,}<br>全市活動序 {c["city_rank"]}',f'{c["street_nearest_m"]:.1f} m<br>{e(c["street_name"])}',f'{e(c["next_check"])}<br>場所線索：{e(c["venue_name"])}（{c["venue_nearest_m"]:.0f} m），須查開放條件。'])
   reportrows.append(f'| {d["source_area"]} | {c["candidate_id"]} {c["name"]} | {c["events"]:,} | {c["street_nearest_m"]:.1f} m | {c["next_check"]} |')
  feedback='校區無獨立回饋分母；不分攤大安區或中正區意見。' if d['feedback_n'] is None else f'既有回饋脈絡：本區標記的 {d["feedback_n"]} 則垃圾相關訊息中，投放便利 {d["access_feedback"]} 則（{d["access_feedback"]/d["feedback_n"]:.1%}），清掃清運／設備維護 {d["maintenance_feedback"]} 則（{d["maintenance_feedback"]/d["feedback_n"]:.1%}）；可重複標註，不是全區問題發生率，也不能歸因到下列站點。'
  changes=[r for r in s['sensitivity'] if r['source_area']==d['source_area']]
  sensitivity='；'.join(('排除7/10、7/11' if r['activity_basis']=='events_excluding_flags' else f'點間隔{r["minimum_separation_m"]}m')+f'保留{r["retained_of_primary3"]}/3點' for r in changes)
  lead=f'{d["source_area"].removesuffix("區")}區清潔隊' if i<=12 else '校區實際管理者與環保／交通單位依介面確認'
  details.append(f'<section class="citywide-district" aria-labelledby="citywide-area-{i:02d}"><h4 id="citywide-area-{i:02d}" tabindex="-1">{e(d["source_area"])} · {"分區分析" if i<=12 else "校區另列，不重複計入12區"}</h4><p>{feedback}</p>{table(["首輪觀察錨點","活動量","最近街道清冊（直線）","先做的工作"],rows)}<p><strong>規則敏感度：</strong>{sensitivity}。門檻改變時名單可能變動，不把單一名次當唯一答案。</p></section>')
  district_plans.append(f'<section class="citywide-district" aria-labelledby="plan-area-{i:02d}"><h4 id="plan-area-{i:02d}" tabindex="-1">{e(d["source_area"])}</h4><p>建議執行窗口：{e(lead)}；區公所協助區里協調，實際箱位管理者另查。</p><p><strong>本區時段：</strong>平日 {window(d["weekday_peak_hour"])} ＋對照 {window(d["weekday_baseline_hour"])}；週末 {window(d["weekend_peak_hour"])} ＋對照 {window(d["weekend_baseline_hour"])}。依全區啟用站活動選時段，並非已確認的垃圾尖峰。</p><p><a href="#citywide-area-{i:02d}">回查{e(d["source_area"])}的錨點、數據與資料限制</a></p></section>')
  batch=next((group['id']+' '+group['label'] for group in field_plan['geographic_groups'] if d['source_area'] in group['districts']),'U 校區獨立序列')
  district_plans[-1]+=f'<p><strong>首輪查核卡：</strong>{e(batch)}；依本區第1、2、3錨點分三輪，每點2平日＋1週末、每日兩窗。每組每個觀察日只排一點，實際日期及人員待確認。<a href="#field-schedule">分輪順序</a> · <a href="#field-record">觀察與回報</a></p>'

 srclink=lambda ids:' · '.join(f'<a href="#hotspot-source-{e(i)}">{e(i)}</a>' for i in ids)
 work=table(['工作包','建議主責','執行與協作','交付、驗收及交接'],[[e(w['id']+' '+w['name']),e(w['accountable_lead']),'<br>'.join(e(x) for x in w['implementers_and_cooperators']),'<strong>交付：</strong>'+e('；'.join(w['outputs']))+'<br><strong>驗收：</strong>'+e('；'.join(w['acceptance_criteria']))+'<br><strong>交接：</strong>'+e(w['handoff'])+'<br>'+srclink(w['verified_existing_duties'])] for w in g['proposed_raci']])
 assignments=table(['行政區','建議區級執行窗口','本輪錨點與交付','協調與升級'],[[e(d['district']),e(d['proposed_lead']),e('、'.join(c['candidate_id'] for c in s['candidates'] if c['source_area']==d['district']))+'<br>'+e(d['deliverable']),e(d['coordination'])+'<br>'+e(d['escalation'])] for d in g['district_assignments']])
 duties='<ul>'+''.join('<li><strong>'+e(d['organization'])+'：</strong>'+e(d['verified_duty'])+' '+srclink(d['sources'])+'</li>' for d in g['verified_existing_duties'])+'</ul>'
 flow='<ol>'+''.join('<li><strong>'+e(x['phase']+' · '+x['relative_timing'])+'：</strong>'+e(x['acceptance'])+'</li>' for x in g['workflow'])+'</ol>'
 stops='<ul>'+''.join('<li>'+e(x)+'</li>' for v in g['stop_conditions'].values() for x in v)+'</ul>'
 sources='<ol>'+''.join(f'<li id="hotspot-source-{e(x["id"])}"><a href="{e(x["url"],quote=True)}" target="_blank" rel="noopener noreferrer">{e(x["id"]+" · "+x["organization"]+"："+x["title"])}</a>（查閱 {e(x["accessed_at"])}）</li>' for x in g['sources'])+'</ol>'
 changed=sum(r['retained_of_primary3']<3 for r in s['sensitivity']);nav=''.join(f'<a href="#citywide-area-{i:02d}">{e(d["source_area"])}</a>' for i,d in enumerate(ds,1))
 fragment=f'''<!-- citywide-delivery:start -->
<section class="research-overview-section hotspot-results" aria-labelledby="hotspot-heading"><span id="citywide-heading"></span>
<h3 id="hotspot-heading" tabindex="-1">全臺北市 12 區：活動與設施線索</h3>
<p><strong>規劃範圍是全臺北市，公館只是一個區內案例。</strong>全部 1,821 站均保留；主分析 1,790 個啟用有效站，其中12區分類 {citystations:,} 站、臺大校區 {campus['eligible_stations']} 站另列。各區依同一規則提出3處首輪查核點，共36處；校區另3處。完整逐站排序與未知站點均保留在研究交付。</p>
<p><strong>由資料提出的查核方向：</strong>12區同步啟動資料與服務查核，北投、南港優先補齊清冊；其他區依候選點先查既有可用、路徑及維護。全市統一標準與跨機關協調，各區依權責執行。首輪點數不是需求或預算配額，也不是全市只服務這些點。</p>
<p>已完成全市桌面分析、12區查核表、分區時段、政府分工與階段規劃；現勘、機關承諾、預算及實際設點尚未執行。七月檔有日期缺口，活動量不是垃圾量或完整月需求。</p>
<nav class="research-overview-nav" aria-label="全市研究成果"><a href="#hotspot-candidates">12區比較</a><a href="#citywide-districts">逐區分析</a><a href="#plan">接到執行計畫</a><a href="#hotspot-quality">資料限制</a><a href="#hotspot-sources">來源</a></nav>
<h4 id="hotspot-candidates" tabindex="-1">12區用相同規則比較，資料不足的區也必須納入</h4>
<p>12區已觀測借還端點共 {cityevents:,} 次；校區另 {campus['events']:,} 次。借與還各計一次，同一旅程可能計兩端。分區沿官方站點分類，校區未武斷分攤到行政區；分類不是土地權屬。街道列、場所列是不同來源粒度，不能相加成桶數。</p>
{overview}
{figure('district-activity','12區已觀測借還活動及啟用站數；數值見上表','這是分區交通活動分布，不能當垃圾問題嚴重度排名。站數、通勤型態與暑假均可能影響觀測。')}
{figure('catalog-coverage','12區街道清冊列數及場所列數','北投0街道列、南港4列屬來源覆蓋風險；不能推論現場沒有桶，亦不能用大直線距離證明服務缺口。')}
<h4 id="citywide-districts" tabindex="-1">逐區分析：36 處觀察錨點，校區另列 3 處</h4>
<p>每區按活動量取3點，同區已選點間至少300m直線，避免同一出口群占滿名額；完整站點仍保留，沒有資料的站點不作零需求。資料排除7/10、7/11後，各分類前三名均保留；改成150或500m時，有 {changed} 組區別／門檻比較改變部分名單。這是規劃敏感度，不是錯誤或已確認最佳解。</p>
<nav class="research-overview-nav" aria-label="十二區及校區查核">{nav}</nav>
{figure('citywide-context','全市站點與12區36處、校區3處首輪查核位置','全部啟用站均呈現。座標圖不含道路與行政區界；圓點是觀察錨點，非新設垃圾桶位置。')}
{''.join(details)}
<h4 id="hotspot-times" tabindex="-1">全市執行安排：每區都有基線，資源依查核結果調整</h4>
<p><strong>第一輪建議量：</strong>12區各3點 × 2平日及1週末 × 每日兩時窗 × 每次15分鐘＝216站次、54純觀察小時；校區另18站次、4.5小時。交通、資料整理、陪同及重訪另計，尚未排班或取得人力承諾。區別峰值見<a href="#plan-districts">逐區安排</a>，對照時段通常10–11；與峰值重疊時改14–15。</p>
<p>每點記錄實際日期、天候、清掃時點、桶況、散落垃圾、投放受阻、過街與替代服務；固定觀察範圍及方法，缺測／取消／反例照實保留。觀察只形成基線，不代表改善成效。一般公開通行區的不干擾觀察，與受管制進入、設備、佔用或移桶等行動分開確認適用規則。</p>
<ol><li><strong>先覆蓋全市：</strong>12區同步盤點資料、權責及未覆蓋的公車、行人、商圈等情境；沒有YouBike訊號的地方仍可由區級查核補入，不因活動低就免除服務。</li><li><strong>再辨識問題：</strong>區級基線分為既有資訊／可達性、維護清運、待補資料、具體配置條件四路；市級處理跨區及跨機關問題。</li><li><strong>最後才排資源：</strong>先處理已證實安全或服務異常，再依問題規模、維護可承接、成本與公平覆蓋提出批次。不得只按YouBike量分配桶數或預算。</li><li><strong>條件式擴大：</strong>各區補足非YouBike場景、路徑與垃圾證據；需介入者另行取得必要同意並固定比較條件。公館是可回查案例，不是全市方案邊界。</li></ol>
<h4 id="hotspot-government" tabindex="-1">市級統籌、12區執行、場地及交通權責逐案確認</h4>
<p><strong>以下主責、時程、工作量及驗收均為本案規劃，尚非機關承諾。</strong>官方既有職掌與提案角色分列；每個工作包一個協調主責，不代替其他有權機關核准。區公所協調不等於接管清潔箱營運。</p>
<h5>官方職掌依據</h5>{duties}
<h5>12區執行與跨區升級</h5>{assignments}
<h5>全市工作包</h5>{work}
<h4 id="hotspot-handoff" tabindex="-1">階段交接與停止條件</h4><p>T0為日後機關與參與者確認啟動日，現在尚未啟動政府協作；相對時程不是法定時限。1999是既有案件入口，本次未代送案件。</p>{flow}{stops}
<h4 id="hotspot-quality" tabindex="-1">全市涵蓋不等於全市垃圾需求已量測</h4>
<ul><li>官方七月ZIP共7,596,992列；7/11無借車、僅7筆還車，7/10借車13,249列。分時分析排除兩日，平日22日、週末7日；其餘日期仍未確認完整，不補值、不稱零需求。</li><li>借車端22,230次、還車端133,671次未匹配十月站點。1,790個啟用有效站中 {unknown} 站沒有配對觀測，維持未知；另31站停用，不列主候選。七月借還與十月站名跨期，不能推定每站整月存在。</li><li>2026街道681列中680列座標可用；場所130列與歷史2024資料分開處理。清冊不是完整現況或箱體可用保證；直線不是步行距離，不是官方服務半徑。</li><li>回饋共2,663則是篩選樣本，來源區標記不保證是事件所在地，未有站點級連結。比例只描述該區標記留言，可多重標註，不能比較全區問題發生率。</li><li>公車2021站位檔的座標定義待釐清，逐站上下車量未取得；行人、商圈、夜間活動、實際垃圾與清運負荷未完整量測。因此本版是全市交通活動代理與分工規劃，不能宣稱已找出全市垃圾熱點。</li><li>全部1,821站端點數與既有全檔來源彙總逐站核對；39處候選與最近距離另用球面餘弦重算。計算核對不代替現勘、地籍、交通安全或機關確認。</li></ul>
<h4 id="hotspot-sources" tabindex="-1">資料與職掌來源</h4><ul><li><a href="https://data.gov.tw/dataset/150635" target="_blank" rel="noopener noreferrer">官方YouBike租借紀錄</a>：保存2026-07原始ZIP及目錄，2026-10-19取得，保留缺口。</li><li><a href="https://data.gov.tw/dataset/137993" target="_blank" rel="noopener noreferrer">YouBike站點目錄</a>：2026-10-18保存快照，不是當下可借還數。</li><li><a href="https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c" target="_blank" rel="noopener noreferrer">清潔箱與場所清冊</a>：街道2026-09-30、場所2026-08-18及2024歷史來源，各自保留。</li><li><a href="#feedback-heading">既有回饋分析</a>：2,663則的彙總判讀與樣本限制。未公開原始留言。</li></ul>{sources}
<p><a href="#definition-decision-D18">範圍修正紀錄</a> · <a href="#definition-prd-roles-heading">團隊分工</a></p></section>
<!-- citywide-delivery:end -->'''
 # Keep generated summaries separate from the complete, selectable detail readers.
 def chapter(key,title,content):
  return f'<article class="reader-item" id="reader-{key}" data-reader-item="{e(title)}">{content}</article>'
 def between(start,end):return fragment[fragment.index(start):fragment.index(end)]
 comparison=table(['行政區','啟用有效站','街道列／場所列','首輪查核'],[[f'<a href="#citywide-area-{i:02d}">{e(d["source_area"])}</a>',str(d['eligible_stations']),f'{d["street_rows"]}／{d["venue_rows"]}',f'<a href="#citywide-area-{i:02d}">查看3處錨點</a>'] for i,d in enumerate(city,1)])
 analysis=f'''<section class="research-overview-section" aria-labelledby="analysis-findings"><h3 id="analysis-findings">全市分析先回答三件事</h3><ol class="summary-findings"><li><strong>首輪已列出 36 處觀察點，校區另列 3 處。</strong>同一套規則涵蓋全部1,821站；1,790個啟用有效站中，12區分類{citystations:,}站、校區{campus['eligible_stations']}站另列。首輪每區3處、校區另3處是觀察錨點，不是新設箱位。</li><li><strong>北投與南港的清冊不足以判斷當地桶量。</strong>2026 街道主檔中，北投0列、南港4列。全市街道681列與場所130列分開使用，不能相加成桶數，也不能據此認定現場無桶。</li><li><strong>借還活動用來選觀察位置，不能換算垃圾量。</strong>12區已觀測借還端點{cityevents:,}次，校區另{campus['events']:,}次。公館站2號出口的首輪觀察點，距最近街道清冊紀錄約40.9公尺；這是直線座標距離，仍須確認走得到、桶能用。<a href="#citywide-area-03">查看大安區點位</a>。</li></ol><p class="research-overview-status">資料：2026年7月借還、10月18日站點、9月30日街道清冊。七月有日期缺口；現勘與垃圾需求仍待驗證。<a href="#hotspot-quality">查看限制</a></p></section>
<section class="research-overview-section" aria-labelledby="hotspot-candidates"><h3 id="hotspot-candidates">12 區總覽，選一區看細節</h3>{comparison}<p>場所是場域線索，街道列也不是已核實可用箱數。<a href="#citywide-area-13">臺大校區另列：{campus['eligible_stations']}個啟用有效站、3處首輪錨點</a>。</p></section>
<section class="research-overview-section" aria-labelledby="analysis-city-map"><h3 id="analysis-city-map">全市觀察錨點</h3>{figure('citywide-context','全市啟用站與12區36處、校區3處首輪查核位置','圓點是觀察錨點，非新設垃圾桶位置。圖中不含道路與行政區界；全市範圍不等於已量測全市垃圾需求。')}</section>'''
 districts=''.join(chapter(f'district-{i:02d}',d['source_area'],details[i-1]+district_plans[i-1]) for i,d in enumerate(ds,1))
 method_scope=between('<section class="research-overview-section hotspot-results"','<h4 id="hotspot-candidates"')+'</section>'
 # Preserve the original overview and all limitations without duplicating its moved IDs.
 method_comparison=between('<h4 id="hotspot-candidates"','<h4 id="citywide-districts"').replace('id="hotspot-candidates"','id="method-comparison"')
 method_rule=between('<h4 id="citywide-districts"','<h4 id="hotspot-times"')
 method_rule=method_rule[:method_rule.index('<nav class="research-overview-nav"')]
 quality=between('<h4 id="hotspot-quality"','<h4 id="hotspot-sources"')
 source_section=fragment[fragment.index('<h4 id="hotspot-sources"'):].replace('</section>\n<!-- citywide-delivery:end -->','')
 methods=chapter('method-scope','研究範圍與查核方向',method_scope)+chapter('method-comparison','12區活動與清冊比較',method_comparison)+chapter('method-selection','選點規則與敏感度',method_rule)+chapter('method-quality','資料品質與限制',quality)+chapter('method-sources','資料與機關來源',source_section)
 work_items=chapter('work-observation','觀察安排與工作量',between('<h4 id="hotspot-times"','<h4 id="hotspot-government"'))
 capacity_rows=[[f"{c['teams']}組／{c['people']}人",f"{c['city_observation_dates']}個觀察日期",f"{c['weekday_dates']}平日＋{c['weekend_dates']}週末日"] for c in field_plan['capacity_scenarios']]
 work_items+=chapter('field-schedule','現勘：分輪與區域安排','<h3 id="field-schedule">先讓12區各有第一點基線，再加深查核</h3><p>全市36點、216站次的計畫已排成三輪；校區3點、18站次獨立安排。這是待執行的排程，實際日期與觀察組待確認。</p>'+'<p>每輪12點、72站次、18純觀察小時；每點都是兩個不同平日＋一個週末，每日兩窗。</p><ol>'+''.join('<li>'+e(w['label'])+'</li>' for w in field_plan['waves'])+'</ol>'+'<h4>四個區域協調分組</h4>'+'<ul>'+''.join('<li><strong>'+e(g['id']+' '+g['label'])+'：</strong>'+e('、'.join(g['districts']))+'</li>' for g in field_plan['geographic_groups'])+'</ul>'+'<p>所有區都先盤點資料；北投、南港清冊缺口優先補查。分組只是協調用途，不是需求排名或已驗證的步行路線。每輪保留未完成區及原因，不能把已觀察區宣稱全市代表。</p><p><a href="#field-capacity">查看人力與排班條件</a> · <a href="#districts">各區點名與活動時窗</a></p>')
 work_items+=chapter('field-capacity','現勘：人力與排班','<h3 id="field-capacity">每組每日只排一個錨點，保留兩個觀察時窗</h3><p>以下假設兩人一組，一人觀察投放事件、另一人記錄設施與路徑；不是已確認的人力。每輪12點按可用組數分批，避免同時段跨點衝突。</p>'+table(['人力情境','全市所需觀察日期','日型構成'],capacity_rows)+'<p>日期數不是連續日曆天或完工承諾；各組可同日並行，交通、事前盤點、整理、等待、改期及重訪另計。校區若另批安排，1／2／3組情境另需9／6／3個觀察日期。</p><p>全市54小時是站點純觀察，兩人同步為108人時；校區另4.5小時／9人時。不可把純觀察當總工時或預算。</p><ol><li>每個錨點排兩個不同平日及一個週末日；同日完成對照、活動兩窗。</li><li>依各區小時窗，暫排每小時15–30分觀察；這是排程提案，來源沒有分鐘級尖峰證據。</li><li>首次到場先確認範圍、站位及場域規則，再記真正起迄與有效分鐘；取消及補訪分開保留。</li></ol><p><a href="#field-record">查看觀察紀錄與判讀</a></p>')
 work_items+=chapter('field-record','現勘：觀察紀錄與判讀','<h3 id="field-record">固定範圍、逐桶記錄，缺測保持空白</h3><p>已準備39列觀察範圍設定、234筆未執行訪次與逐服務點空白表。表格保存在私人交接包；公開頁提供執行方法。</p><ol><li><strong>到場前：</strong>固定兩端地標、側別、安全站位、服務點清單及範圍版本；錨點不是垃圾桶位置。</li><li><strong>觀察時：</strong>記實際日期、起迄、有效分鐘、天候與清掃脈絡。一人記投放嘗試及完成／受阻／結果未明，另一人記箱況與街面起末存量；不重複加總。</li><li><strong>逐桶附表：</strong>每個實際服務點各列滿度、可用性、路徑、管理與照片編號；沒找到來源紀錄不代表現場無桶。</li><li><strong>離場後：</strong>保留完成、部分、取消、改期或不適用及原因。只有完整觀察而未發生才填0；補訪另加R1等ID，不覆寫原紀錄。</li></ol><h4>交接到四類工作</h4><ul><li>資料不足：補件或補訪，不推論零需求。</li><li>資訊／可達性：核對現有服務與實際路徑，再比較指引。</li><li>維護清運：有直接箱況或清掃紀錄，再交建議服務窗口核對。</li><li>配置條件：有基線、路徑與權責資料後才研究位置比較，仍不是核准設點。</li></ul><p>起末垃圾存量差不能當新增丟棄量；不同範圍不直接比較原始件數。這輪只建立基線，沒有改善成效。現場規則、安全或必要許可未釐清時，停止相關行動並保留原因。</p>')
 work_items+=chapter('work-duties','官方職掌與分工界線',between('<h4 id="hotspot-government"','<h5>12區執行與跨區升級</h5>'))
 work_items+=chapter('work-districts','12區窗口與跨區升級','<h3>12區執行與跨區升級</h3>'+assignments)
 for w in g['proposed_raci']:
  content=f'<h3 id="work-{e(w["id"])}">{e(w["id"]+" · "+w["name"])}</h3><p><strong>建議協調主責：</strong>{e(w["accountable_lead"])}</p><p><strong>共同執行：</strong>{e("；".join(w["implementers_and_cooperators"]))}</p><dl class="work-detail">'+''.join(f'<dt>{title}</dt><dd><ul>'+''.join('<li>'+e(x)+'</li>' for x in w[key])+'</ul></dd>' for title,key in [('輸入','inputs'),('交付物','outputs'),('驗收條件','acceptance_criteria')])+f'<dt>交接</dt><dd>{e(w["handoff"])}</dd></dl><p>職掌依據：{srclink(w["verified_existing_duties"])}</p><p class="research-overview-status">工作包為提案，並非機關承諾。</p>'
  pending=next(row['authority_to_confirm'] for row in government_handoff['work_packages'] if row['id']==w['id'])
  content+='<h4>本工作包交接前待確認</h4><ul>'+''.join('<li>'+e(item)+'</li>' for item in pending)+'</ul>'
  work_items+=chapter(w['id'],w['id']+' · '+w['name'],content)
 inquiries='<ol>'+''.join('<li>'+e(item)+'</li>' for item in government_handoff['inquiry_checklist'])+'</ol>'
 work_items+=chapter('government-handoff','政府分工：交接清單','<h3 id="government-handoff">9個工作包與12區分工已整理，承接與權責待確認</h3><p>交接文件逐項列出輸入、建議主責、協作、交付、驗收及下一手。公開職掌只支持協調方向，機關尚未接受本案；實際道路、土地、設施與必要核准者仍逐點核對。</p><h4>依工作階段交接</h4><ul><li>資料與清冊：<a href="#work-WP01">WP01共同規則</a>、<a href="#work-WP02">WP02全站篩選</a>、<a href="#work-WP03">WP03區級核對</a>。</li><li>現場與權責：<a href="#work-WP04">WP04場地權責</a>、<a href="#work-WP05">WP05現場基線</a>、<a href="#work-WP06">WP06交通介面</a>、<a href="#work-WP07">WP07校園序列</a>。</li><li>彙整與後續決策：<a href="#work-WP08">WP08分區準備度</a>、<a href="#work-WP09">WP09案件分流與核准</a>。</li></ul><p>每個工作包都附待核實權責；未核實不填完成。先交付可查的資料與明確缺口，再記錄機關回覆或保留待覆。</p><p><a href="#reader-work-districts">12區建議窗口與升級</a> · <a href="#government-inquiry">8項機關詢問事項</a> · <a href="#hotspot-government">職掌來源</a></p>')
 work_items+=chapter('government-inquiry','政府分工：機關詢問事項','<h3 id="government-inquiry">8項待詢問事項，尚未送出或立案</h3><p>詢問前先核對對應點位與工作包。回覆記來源、日期、適用範圍及是否僅為口頭說明；沒有回覆就保留待確認。</p>'+inquiries+'<p><a href="#government-handoff">回到政府交接清單</a></p>')
 work_items+=chapter('work-handoff','階段交接與停止條件',between('<h4 id="hotspot-handoff"','<h4 id="hotspot-quality"'))
 worksummary=table(['工作包','建議協調主責'],[[f'<a href="#work-{e(w["id"])}">{e(w["id"]+" · "+w["name"])}</a>',e(w['accountable_lead'].removeprefix('提案：'))] for w in g['proposed_raci']])
 analysis+='<section class="research-overview-section" aria-labelledby="analysis-handoff"><h3 id="analysis-handoff">熱點分析交接已備妥</h3><p>交接包保留全站1,821筆，另整理13列區域狀態、39列錨點與234筆待執行訪次。點位理由、資料缺口及未知條件分欄，候選點不直接當新設箱位。</p><p><a href="#districts">逐區查核卡</a> · <a href="#field-schedule">現勘分輪安排</a> · <a href="#government-handoff">政府分工交接</a></p></section>'
 execution=f'''<section class="research-overview-section" aria-labelledby="plan-work-heading"><h3 id="plan-work-heading">先查核，再交接配置比較</h3><ol class="summary-phases"><li><strong>鎖定資料與共同規則</strong><p>全市12區同步盤點，校區另列；先固定來源、分母與紀錄方式。</p></li><li><strong>完成各區現場基線</strong><p>確認箱況、路徑、垃圾事件與清運能力，保留缺測及反例。</p></li><li><strong>辨識問題並確認承接</strong><p>分成資訊、維護、補資料與配置條件；跨機關問題由市級協調。</p></li><li><strong>固定條件，再比較或試辦</strong><p>依場址確認管理者及必要同意，比較A現況、B資訊改善、C等總量移位。</p></li></ol><p>以上是提案順序。T0須等參與者確認；尚未啟動政府協作。<a href="#hotspot-handoff">查看交接與停止條件</a></p></section>
<section class="research-overview-section" aria-labelledby="plan-departments"><h3 id="plan-departments">誰承接哪些工作</h3><p>下列為建議協調主責，並非機關已同意；有權核准者仍須逐案確認。</p>{worksummary}<p><a href="#hotspot-government">官方職掌與權責界線</a> · <a href="#work">全部工作包與驗收</a></p></section>
<section class="research-overview-section" aria-labelledby="plan-districts"><h3 id="plan-districts">12區都有第一輪安排</h3><p>先做12區各第1錨點，再做各第2、3錨點；每點2平日＋1週末，每日兩窗。全市216站次／54純觀察小時，校區另18站次／4.5小時。分輪、紀錄與人力情境已備妥，實際人員、日期與現勘待確認。</p><p><a href="#field-schedule">三輪現勘安排</a> · <a href="#field-capacity">人力與排班</a> · <a href="#field-record">回報方法</a></p></section>'''
 page=SITE/'dist/index.html';text=page.read_text()
 for name,content in [('analysis',analysis),('execution',execution),('districts',districts),('methods',methods),('work',work_items)]:
  if name in ['districts','methods','work']:
   content='<nav class="reader-index" aria-label="明細索引">'+''.join(f'<a href="#{key}">{title}</a>' for key,title in re.findall(r'id="(reader-[^"]+)" data-reader-item="([^"]+)"',content))+'</nav>'+content
  marker='citywide-'+name
  text,count=re.subn(f'<!-- {marker}:start -->.*?<!-- {marker}:end -->',lambda _:f'<!-- {marker}:start -->\n{content}\n<!-- {marker}:end -->',text,flags=re.S)
  assert count==1,f'Missing or duplicate generated region: {marker}'
 page.write_text(text)
 dest=SITE/'dist/images/citywide';dest.mkdir(exist_ok=True)
 for name in ['district-activity','catalog-coverage','citywide-context']:shutil.copyfile(ROOT/f'results/figures/{name}.png',dest/f'{name}.png')
 report=f'''# 全臺北市12區：熱點分析與政府部門工作分配

2026-10-19。依使用者修正，規劃範圍為全臺北市；原公館成果降為局部案例。這是桌面規劃交付，非已現勘、已核准或已實施設點。

## 結論

完整保留1,821站，分析1,790個啟用有效站：12區分類{citystations:,}站／{cityevents:,}個已觀測借還端點，臺大校區另{campus['eligible_stations']}站／{campus['events']:,}次，不重複加總。全部12區各3個首輪查核點共36處，校區另3處；全站表與47個無配對觀測站保持未知，不以篩選名單代替全市服務。

每區同步資料查核。北投0街道列、南港4列先補清冊，不因缺列判無桶或低需求。依現勘證據分為資訊可達性、維護清運、補資料及配置條件四路；市級標準與跨機關協調，各區依實際權責執行。

![12區活動](results/figures/district-activity.png)

![清冊覆蓋](results/figures/catalog-coverage.png)

## 12區與校區首輪查核表

按觀測活動量排序、同區選點至少300m直線。此規則是在城市級計算前固定；各區三點是首輪查核額度，並非需求或預算均分。完整結果見results/stations.csv。

| 區域 | 首輪錨點 | 已觀測端點 | 最近街道紀錄直線距離 | 工作方向 |
|---|---|---:|---:|---|
'''+ '\n'.join(reportrows)+'''

![全市座標圖](results/figures/citywide-context.png)

## 分區時段

活動峰值依排除7/10、7/11後的各區全部啟用有效站計算；平日22日、週末7日。不是已確認垃圾尖峰。

| 區域 | 平日活動／對照 | 週末活動／對照 |
|---|---|---|
'''+''.join(f'| {d["source_area"]} | {window(d["weekday_peak_hour"])}／{window(d["weekday_baseline_hour"])} | {window(d["weekend_peak_hour"])}／{window(d["weekend_baseline_hour"])} |\n' for d in ds)+'''

每區3點×3日×兩時窗×15分鐘＝18站次／4.5純觀察小時；全12區216站次／54小時；校區另18站次／4.5小時。不含交通、整理、陪同與重訪；沒有排班、人力或預算承諾。固定記錄日期、天候、清掃時點、桶況、垃圾事件、投放受阻、過街與替代服務。一般公開不干擾觀察與受管制進入、設備、佔用或移桶分開確認適用條件。

## 方法、敏感度與限制

原始ZIP7,596,992列，7/11無借車、7筆還車，7/10借車13,249列；品質原因未知。借端未匹配22,230次、還端133,671次；不補值、不模糊配對、不推定零需求。31站停用不入主排序。來源無旅程ID、只有小時精度，無法驗證重複率。暑假與跨期站點不代表全年同步現況。

排除兩日期後各區前三點均相同；150／500m點間隔使部分名單變動，完整比較見results/sensitivity.csv。不同空間門檻回答不同訪查分散程度，不挑選最好看的設定。全部站點端點計數與先前全檔站名彙總獨立核對，候選點與距離用不同球面公式交叉核對；見validation.json。規則在protocol.md，來源與雜湊在manifest.json。

街道681列中680列座標可用，場所130列不是逐箱，2024只供反例。未核實全市清冊完整性、現場箱況及步行可達。回饋2,663則不是代表性樣本，區標記未核實事件地，不能把回饋量當垃圾量。逐區A/C類留言計數與分母見results/districts.csv；不加入排名分數。

分區沿官方sarea，65筆校區來源站（64啟用）另列，未作地籍或行政界判定。公車逐站人流、行人、商圈、垃圾事件、路網、清運能力及成本仍缺；全市規劃必須安排這些補件，而不是把YouBike代理當成全部需求。

## 政府工作分配

'''+(ROOT/'government/government-plan.md').read_text().replace('](../protocol.md)', '](protocol.md)').replace('](government.json)', '](government/government.json)')+'''

## 本輪交接與現勘排程

[熱點分析交接](delivery/hotspot-handoff.md) · [政府分工交接](delivery/government-handoff.md) · [三輪現勘計畫](delivery/field-plan.md) · [現勘紀錄規則](delivery/field-record-guide.md)。計畫與空白表已備妥；實際現勘、人員排班及機關承接尚未完成。

## 重跑與保存

- `analysis.ipynb`：從原始ZIP重算、獨立核對、表格及三張圖，已保存執行輸出。
- `results/stations.csv`：全部1,821站含停用／無配對觀測與主排序狀態。
- `results/districts.csv`、`candidates.csv`、`hourly-profiles.csv`、`sensitivity.csv`：全區分母、39處首輪錨點、時段及敏感度。
- `government/government.json`：全市工作包、12區分工與來源。

原始ZIP另行保存，不隨Git或公開網站發布。可從manifest.json的trip_archive.url取回；analyze.py會核對SHA-256，來源不同就停止。安裝requirements-analysis.txt後，在本研究目錄執行：

```sh
python analyze.py --archive /path/to/202607-youbike.zip
python validate.py
python figures.py
```

Notebook亦可設TAIPEI_ARCHIVE指向原ZIP。publish_results.py供原網站source checkout產生網站摘要，不能在只有私人研究包的資料夾重建網站。公開網站只發布彙整內容與圖形，原始來源及逐站研究檔保留私有。

## 90秒講稿

我的工作範圍是全臺北市12區的熱點分析與政府部門分工。我們用同一套規則處理全市站點、借還活動與既有清冊，先找出每區三個可開始查核的地點，共三十六處，校區另外處理。公館只是其中一個案例，不代表整座城市。

我們發現，不能把交通活動直接當垃圾量，也不能把清冊沒有紀錄當成現場沒有桶。北投與南港尤其要先補查清冊。各區的活動時段也不同，所以觀察與後續勤務不能直接照抄同一地區。

分工上，建議市級統一資料標準、成效門檻與跨機關協調，12區清潔隊依實際權責查核及評估維護，區公所協助區里協調，交通與場地管理單位各自確認介面。先查問題，再決定改善指引、維護、補資料或配置比較。每區都納入規劃，實際箱位、成本、人力與核准仍須另行確認，不把桌面成果說成已完成設點。
'''
 (ROOT/'README.md').write_text(report)
 print('Citywide section, three figures and private report generated.')
if __name__=='__main__':main()

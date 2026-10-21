"""Render the audited MRT comparison into the existing reading structure."""
import html,json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parent
SITE=ROOT.parents[1]
if (ROOT.parents[3] / "sites/taipei-waste-lab").is_dir():
    SITE = ROOT.parents[3] / "sites/taipei-waste-lab"

def esc(s):return html.escape(str(s),quote=True)
def table(headers,rows,caption):
    return '<table class="plan-table"><caption>'+esc(caption)+'</caption><thead><tr>'+''.join('<th scope="col">'+esc(x)+'</th>' for x in headers)+'</tr></thead><tbody>'+''.join('<tr>'+''.join('<td data-label="'+esc(h)+'">'+v+'</td>' for h,v in zip(headers,row))+'</tr>' for row in rows)+'</tbody></table>'

def render(d):
    rows=[];sensitivity=[];venues=[]
    for r in d['results']:
        name=r['station'];flow=f"{r['daily_gate_passages']:,.0f}"
        notes='；'.join(esc(x['行政區'])+'「'+esc(x['備註'])+'」' for x in r['venues']) or '未找到同站名紀錄'
        if name in ('中山','忠孝新生'):
            target='zhongshan' if name=='中山' else 'xinsheng'
            notes+=' <a href="#method-venue-'+target+'">場所補查</a>'
        rows.append([esc(name),flow,str(r['exit_count']),'<strong>'+str(r['street_rows']['300'])+'</strong>',notes])
        sensitivity.append([esc(name),*[str(r['street_rows'][str(radius)]) for radius in d['radii_m']]])
        for v in r['venues']:
            venues.append([esc(name),str(v['source_csv_row']),esc(v['行政區']),esc(v['地址']),esc(v['備註'])])
    comparison=table(['捷運站','日均進出人次','來源出口數','300 m 街道紀錄（列）','同站場所備註（原文，分列不加總）'],rows,'2026 年 9 月 OD 進出量前 10 站｜臺北市 74 站中選取，依進出量排序')
    sensitivity_table=table(['捷運站','100 m（列）','200 m（列）','300 m（列）','500 m（列）'],sensitivity,'同一批 10 站，改變出口周邊直線半徑；不是步行距離')
    venue_table=table(['對應站名','CSV 列號（含表頭）','原行政區','原地址','原備註'],venues,'2026-08-18 場所表的同站名紀錄；同站重複或不同備註都保留')
    return '''<article class="reader-item" id="reader-method-mrt" data-reader-item="捷運進出量與街道清冊差異"><section class="research-overview-section" aria-labelledby="method-mrt-comparison">
<h3 id="method-mrt-comparison" tabindex="-1">高進出量捷運站，街道清冊分布有多不一樣？</h3>
<p class="research-lead"><strong>前 10 站的出口 300 公尺內，街道清冊有 0–66 列。</strong>西門與市政府站的進出量相近，街道紀錄分別為 66 列與 5 列。這支持「已登錄街道設施的分布差異」，實際可用桶數與缺桶程度仍待查。</p>
<p class="research-overview-status">量的是捷運進出站活動與街道清冊分布。來源的總量與檔案校驗差異尚待釐清（見下方限制）。進出人次不是獨立人數、地面人流或投放量；清冊列數與場所「處」數也不是已核實桶數。</p>
<nav class="reading-path" aria-label="捷運比較閱讀順序"><a href="#method-mrt-table">看 10 站比較</a><a href="#method-mrt-insights">洞察與查核問題</a><a href="#method-mrt-limits">口徑與資料限制</a><a href="#method-mrt-sources">原始來源</a></nav>
<h4 id="method-mrt-table">用同一套規則比較，場所另列</h4>
<p>先依 9 月 OD 的進站＋出站人次選前 10 站，再計算每站<strong>任一出口 300 m 內</strong>的街道紀錄；同列被多個出口涵蓋只算一次。各站出口數、覆蓋形狀不同，結果不是同面積密度，也不跨站加總。</p>
'''+comparison+'''
<p>日均＝9 月進站＋出站人次÷30，四捨五入至整數。街道表為 9/30 版本，出口座標為 8/4 版本，場所表為 8/18 版本；都不是同日實測。市政府的場所欄表示未找到同站名紀錄，不能解讀成站內無桶。</p>
<h4 id="method-mrt-insights">這次量化帶來的三個洞察</h4>
<ol class="summary-findings">
<li><strong>進出量相近，街道紀錄仍可差一個數量級。</strong>西門日均約 13.32 萬、市政府約 12.28 萬，前者高約 8.5%；300 m 街道列數為後者的 13.2 倍。100／200／500 m 下，兩站分別是 14／2、43／2、82／21 列，差異方向沒有因這四種半徑改變。這是全表中的描述性案例，尚不能解釋配置原因或服務公平性。</li>
<li><strong>零列與「沒有投放服務」是兩件待分別核實的事。</strong>中山日均約 10.50 萬、忠孝新生約 7.25 萬；9/30 街道版中，兩站在 100–500 m 都是 0 列，但場所表各有「10處」記載。忠孝新生的 10 處同時列在大安、中正，不能當成 20 個桶。10/22 補查已找到中山站內服務區線索；10/21 街道版的中山 500 m 內改為 1 列，兩站 300 m 仍為 0 列。<a href="#method-station-venues">查看場所、重複關係與新版街道結果</a>。</li>
<li><strong>下一個有用的比較單位是「出口到目的地的一段旅程」。</strong>台北車站日均約 30.28 萬，300 m 只有 5 列，但本次只涵蓋 M1–M8，未完整納入連通地下街與其他運具出口。僅靠站級總量，仍不知道攜帶垃圾的人在哪個出口、會不會經過可用設施。現勘應把活動、路徑與服務放在同一時段記錄。</li>
</ol>
<h4>據此優先查什麼</h4>
<dl class="problem-evidence">
<div><dt>中山、忠孝新生：先釐清清冊與實際服務</dt><dd>中山先核對詢問處兩側服務區；忠孝新生先核對跨區填報範圍。逐桶箱號、閘門內外、開放時段與收受物仍待查。<a href="#method-station-venues">本輪補查與下一步</a>。</dd></div>
<div><dt>西門、市政府：比較相近活動量下的完整旅程</dt><dd>用相同的觀察時段與事件規則，記錄出口、實際步行、持有物、找到的設施、桶況與最後處理結果。兩站場所資料涵蓋不同，先盤點再比較服務結果。</dd></div>
<div><dt>台北車站：補清楚場域邊界</dt><dd>分開確認捷運、台鐵／高鐵、機捷及地下街的出口與管理範圍；不能用捷運人次當整個場域的人流，也不能把 M1–M8 的結果當完整站區供給。</dd></div>
</dl>
<p>以上是新增的查核問題，尚未變更首批 12 區現勘排程。四種需求人物與這 10 站仍未建立事件對應；到場後才以<a href="#field-forms">投放旅程與車籃垃圾紀錄表</a>驗證，沒有實測的欄位留白。<a href="#problem">回到目前問題定義</a>。</p>
<details class="feedback-codebook"><summary>查看 100／200／300／500 m 的完整比較</summary>'''+sensitivity_table+'''<p>這 10 站在四種半徑下，街道列數與不同座標數相同；因此表中差距不是同座標重複列造成。這仍不能證明每列對應一個獨立、可用的實體箱。</p></details>
<details class="feedback-codebook"><summary>查看場所逐筆原文與重複／差異</summary>'''+venue_table+'''<p>南京復興列「2處」與「4處」，國父紀念館列「8處」與「7處」；本次不選一筆當真值，也不相加。西門、忠孝新生的跨區相同備註也不重複累計。場所座標只是場域線索，未用它推定每個設施都在 300 m 內。</p></details>
<h4 id="method-mrt-limits">計算口徑與仍未解決的資料缺口</h4>
<ul>
<li><strong>選站完整性：</strong>官方車站資料 75 筆臺北市紀錄合為 74 站名；南港展覽館的兩條線合併。OD「大橋頭站」與車站表「大橋頭」明確對照，「臺／台」統一；74 站皆有 30 天雙向紀錄。先以進出量排序取前 10 站，沒有依桶數挑案例。</li>
<li><strong>時間與總量：</strong>OD 共 8,240,400 列，涵蓋 9/1–9/30、每天 21 個時段（00、01、05–23）；未列 02–04 時，不補零。進站與出站各合計 64,273,963 人次；另表全系統為 64,319,630，相差 45,667（0.071%），原因待查。這是本份 OD 內的排名，未用全系統差額回填各站。</li>
<li><strong>檔案校驗：</strong>同一官方 OD 網址兩次下載，大小及 SHA-256 都一致；但回應標頭宣告的 MD5 與下載內容不符。原因尚未釐清，本輪數字僅描述已保存的檔案，不宣稱通過來源校驗。</li>
<li><strong>空間與單位：</strong>681 列街道資料中，680 列座標可計算、1 列無效保留。以球面直線距離取各出口涵蓋範圍聯集，未核實走路路徑、路口障礙、容量、滿溢、維護與服務時間。場所 130 筆另用名稱對照，不加進街道列數。</li>
<li><strong>未回答的核心問題：</strong>這份比較仍沒有投放事件、垃圾量、持有時間或失敗原因。因此不能推斷高人流必然高垃圾需求、需求人物集中在某站，或直接提出新設桶位。</li>
</ul>
<h4 id="method-mrt-sources">可回查的官方來源</h4>
<ol>
<li><a href="https://data.taipei/dataset/detail?id=63f31c7e-7fc3-418b-bd82-b95158755b4d" target="_blank" rel="noopener noreferrer">臺北捷運各站分時進出量統計</a>：2026 年 9 月完整 OD 檔，10/12 更新；本研究按站加總。</li>
<li><a href="https://data.taipei/dataset/detail?id=cfa4778c-62c1-497b-b704-756231de348b" target="_blank" rel="noopener noreferrer">捷運車站出入口座標</a>：8/4 版本，390 筆來源紀錄；<a href="https://data.taipei/dataset/detail?id=1eefa68d-7c8d-491b-8e75-66a161947426" target="_blank" rel="noopener noreferrer">捷運車站資料服務</a>：9/4 版本，以地址判定臺北市車站。</li>
<li><a href="https://data.taipei/dataset/detail?id=a835f3ba-7f50-4b0d-91a6-9df128632d1c" target="_blank" rel="noopener noreferrer">行人專用清潔箱設置點</a>：街道 9/30、場所 8/18，沿用本研究已保存並完成 12 區複查的原始版本。</li>
<li><a href="https://data.taipei/dataset/detail?id=660e3969-c011-481c-aa24-8a949ac2d62d" target="_blank" rel="noopener noreferrer">臺北捷運全系統旅運量統計</a>：9 月每日總量，用來交叉核對；差額保留，不假定相同口徑。</li>
</ol><p>查核與計算日期：2026-10-22。<a href="#analysis">回到全市量化分析</a> · <a href="#districts">各區查核</a></p>
</section></article>'''

def build():
    d=json.loads((ROOT/'results/comparison.json').read_text())
    page=SITE/'dist/index.html';s=page.read_text();article=render(d)
    block='<!-- mrt-comparison-20261022:start -->\n'+article+'\n<!-- mrt-comparison-20261022:end -->\n'
    if '<!-- mrt-comparison-20261022:start -->' in s:
        s=re.sub(r'<!-- mrt-comparison-20261022:start -->.*?<!-- mrt-comparison-20261022:end -->\n',lambda _:block,s,flags=re.S)
    else:
        marker='<article class="reader-item" id="reader-method-selection"'
        assert s.count(marker)==1;s=s.replace(marker,block+marker)
    index='<a href="#reader-method-mrt">捷運進出量與街道清冊差異</a>'
    if index not in s:s=s.replace('<a href="#reader-method-selection">選點規則與敏感度</a>',index+'<a href="#reader-method-selection">選點規則與敏感度</a>')
    s=s.replace('比較 YouBike 借還活動、站點與清潔箱清冊的空間分布','比較捷運進出量、YouBike 借還活動與清潔箱清冊的空間分布')
    item='<li id="analysis-mrt-summary"><strong>高進出量捷運站，街道清冊差異達 0–66 列。</strong>9 月 OD 前 10 站配對 9/30 街道版，出口 300 m 內西門 66 列、市政府 5 列。中山、忠孝新生各 0 列，場所表另記「10處」，不能判無桶。<a href="#method-mrt-comparison">10 站比較</a> · <a href="#method-station-venues">兩站場所與 10/21 街道補查</a>。</li>'
    if 'id="analysis-mrt-summary"' in s:
        s=re.sub(r'<li id="analysis-mrt-summary">.*?</li>',lambda _:item,s,flags=re.S)
    else:
        a=s.index('<section id="panel-analysis"');b=s.index('<ol class="summary-findings">',a)+len('<ol class="summary-findings">');s=s[:b]+item+s[b:]
    callout='<p class="related-reading" id="districts-mrt-link">捷運量化補查：<a href="#method-station-venues">中山與忠孝新生的場所位置、重複與使用條件</a> · <a href="#method-mrt-comparison">10 站比較</a>。仍是查核線索，尚未調整各區首批點位。</p>'
    if 'id="districts-mrt-link"' in s:
        s=re.sub(r'<p class="related-reading" id="districts-mrt-link">.*?</p>',lambda _:callout,s,flags=re.S)
    else:
        a=s.index('<section id="panel-districts"');b=s.index('</header>',a)+len('</header>');s=s[:b]+callout+s[b:]
    s=s.replace('2026 年 7 月借還紀錄、10 月站點快照與分別保存的設施清冊。計算核對不代表現勘完成。','2026 年 7 月借還、9 月捷運進出量、站點快照與分別保存的設施清冊。計算核對不代表現勘完成。')
    page.write_text(s)
    print('Rendered MRT comparison and linked analysis/district pages.')
if __name__=='__main__':build()

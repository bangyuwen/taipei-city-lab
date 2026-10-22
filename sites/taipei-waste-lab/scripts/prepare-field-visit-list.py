"""Render a bounded, evidence-backed visit proposal from the retained cross-analysis."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / 'dist/data/cross-analysis.json'
TARGET = ROOT / 'docs/cross-analysis-field-visits.md'

QUESTIONS = {
    '中山': [
        '從 5 號出口及南京西路 57 號前借還點出發，分道路側記錄至「捷運中山站（志仁高中）」站位的桶位、指引與過街需求。',
        '逐一確認其餘出口周邊有無清冊漏列的街頭桶、站內桶或場域桶；記錄站內外界線、開放時間及一般路人能否使用。',
        '在借還點、候車處及兩者間步行路段分別記錄地面垃圾與攜帶垃圾的行為，確認問題是否集中在轉乘動線。'],
    '忠孝新生': [
        '以 4 號出口借還點及同名公車站位為起點，分道路側核對桶位，實走至可用投放點，記錄過街、繞行與可見性。',
        '檢查其他出口與附近公車候車區是否也無可用桶；17 個站位須按不同站位 ID 核實，不能把同名站牌當成同一位置。',
        '區分清冊漏列、場域開放限制及站外動線缺口；用現場人流方向確認需要服務的路段，不能把整站人次分給每個出口。'],
    '龍山寺': [
        '先查 3 號出口借還點至「昆明街口」站位，再查其餘出口與候車區，分別記錄街頭、站內及場域的可用桶。',
        '核實 24 個公車站位的道路側及候車動線；人行過街障礙、清冊漏列與桶況分開記錄。',
        '在 8–9 時觀察交通活動，9–10 時再作對照；記錄垃圾新生量與清掃時間，勿把廟區、車站及整個萬華的問題混為同一點。'],
    '台北車站': [
        '先查 M2 出口借還點與「臺北車站（鄭州）」站位，再對照 M7 周邊最近清冊桶位方向，分開記錄不同出口的可及性。',
        '逐一核實出口 300 公尺聯集內五個不同清冊桶位是否仍在、可用且對一般行人開放；不可將五處當作 M2 都能直接使用。',
        '比較有桶與無桶記錄的候車側、出口尖峰人流方向、滿溢及清運間隔；整站高比值只能提出查核問題，不能單獨證明容量不足。'],
    '東門': [
        '先查 5 號出口借還點至「信義永康街口（捷運東門站）」站位，記錄可見桶位、過街及實際步行距離。',
        '對照愛國東路 35 之 1 號清冊桶位：整站出口聯集內有一處，但 5 號出口借還點距最近清冊桶位約 400 公尺，確認是否存在出口間配置落差。',
        '核對九個公車站位中四個未見附近桶位的站位側，觀察人流、投放與地面垃圾是否集中；同時記錄站內替代桶與開放條件。'],
    '行天宮': [
        '先查 3 號出口借還點及「捷運行天宮站（松江路）」站位，分別查看松江路 209 號與民權東路／松江路口的清冊桶位。',
        '比較不同出口、候車側到兩處桶位的過街與視線條件；即使整站有兩處，也不能假定所有轉乘路徑都有服務。',
        '尖峰前後記錄桶況、投放頻率與清運時間，分辨是漏列／動線問題，還是容量與維護需要再評估。'],
    '南港展覽館': [
        '出發前先向管理單位核對南港現行街頭與場域清冊、異動日期及座標；現存主檔全區只有四列，不能據此判定站區無桶。',
        '以 5 號出口借還點及「南港展覽館」站位為核實起點，逐出口、候車側確認站內外替代桶、開放時間及一般行人能否使用。',
        '記錄是否展期及當日活動；如有活動日效應，另外安排同時段非展期對照，再判斷需求，不能把整月均值當成展期尖峰。'],
    '石牌': [
        '出發前先核對北投最新街頭與場域清冊；現存主檔全區零列，本點第一任務是補查存量，而非證明無桶。',
        '以 2 號出口借還點和「捷運石牌站（西安）」站位為起點，核實名稱、座標及道路側是否一致，再查看兩個出口周邊的實際投放選擇。',
        '平日 8–9 時先觀察轉乘動線，再於 9–10 時對照；把未列桶、不可用桶及真正需繞行的路段分開記錄。'],
}


def build(data):
    bikes = {p['id']: p for p in data['stations']}
    buses = {p['id']: p for p in data['buses']}
    days = data['transport']['meta']['days']
    assert days == data['meta']['activityDays'] == 29
    candidates = []
    for p in data['transport']['stations']:
        if not p['bikeIds'] or not p['busIds']: continue
        nearby = [bikes[i] for i in p['bikeIds']]
        observed = [b for b in nearby if b['events'] is not None]
        if not observed: continue
        matching = [b for b in observed if p['name'].replace('台', '臺') in b['name'].replace('台', '臺')]
        anchor = sorted(matching or observed, key=lambda b: (-b['events'], b['id']))[0]
        refs = [r for r in anchor['buses'] if r['id'] in p['busIds']]
        assert refs, p['name']
        stop = buses[min(refs, key=lambda r:(r['distanceM'],r['id']))['id']]
        count = p['binCounts']['300']
        daily = (p['entries']+p['exits'])/days
        candidates.append(dict(p, daily=daily, ratio=daily/count if count else None,
            bikeDaily=sum(b['events'] for b in observed)/days, unknown=len(nearby)-len(observed),
            busUncovered=sum(buses[i]['nearestBin']['distanceM']>300 for i in p['busIds']),
            anchor=anchor, stop=stop))
    coverage = {'北投區', '南港區'}
    regular = [p for p in candidates if not coverage.intersection(p['areas'])]
    zero = sorted((p for p in regular if p['ratio'] is None),key=lambda p:(-p['daily'],p['id']))[:3]
    positive = sorted((p for p in regular if p['ratio'] is not None),key=lambda p:(-p['ratio'],p['id']))[:3]
    inventory = [max((p for p in candidates if area in p['areas']),key=lambda p:p['daily']) for area in ['南港區','北投區']]
    assert len({p['id'] for p in zero+positive+inventory}) == 8
    return [('A', '第一輪：高活動、出口周邊零清冊桶位', zero),
            ('B', '第二輪：有桶位，查出口與轉乘動線的配置差異', positive),
            ('C', '同步先補清冊：完成資料核對後安排現勘', inventory)]


def render(data, groups):
    number=lambda v:f'{v:,.0f}'
    lines=['# 交通交叉分析：八點現勘順序提案', '',
        '整理日期：2026-10-22。狀態：未現勘；不是新增垃圾桶建議或已證實的缺桶名單。', '',
        '先走 A 組三站，再走 B 組三站；C 組兩站同步做清冊核對，核對後再排現場。這是問題驗證優先序，不是最短交通路線，也不是全市缺桶嚴重度排名。', '',
        '## 怎麼選出這八點', '',
        '- 固定以出口 300 公尺聯集比較，不因地圖當下篩選改變。從 73 個已配對捷運站中，保留周邊有已觀測 YouBike 活動及公車站位的站。',
        '- A 組：排除周邊涉及北投／南港的清冊覆蓋疑點後，取零桶位站中日均進出站紀錄最高的三站。',
        '- B 組：同樣排除上述覆蓋疑點，取有桶位站中「日均進出站紀錄 ÷ 不同桶位數」最高的三站。零桶位不算比值。',
        '- C 組：南港與北投各取上述候選中日均進出站紀錄最高的一站，代表需要優先補冊的交通節點。周邊區別來自 YouBike 所屬區，不是捷運站行政界線判定。',
        '- 三／三／二的名額是這輪可執行範圍；這是看過結果後整理的描述性清單，沒有合成需求分數或預測驗證。',
        '- 每站集合點選周邊與站名相符、已觀測活動最高的 YouBike 站；附近站位選集合點可配對且最近的一個。集合點只是可定位的查核起點，不代表該出口最繁忙。', '',
        '## 一眼看順序', '',
        '| 順序 | 查核站區 | 日均捷運進出紀錄 | 出口 300m 清冊桶位 | 周邊 YouBike 日均事件 | 公車未見桶位／站位 |',
        '|---|---|---:|---:|---:|---:|']
    for group, _, rows in groups:
        for i,p in enumerate(rows,1):
            lines.append(f"| {group}{i} | {p['name']} | {number(p['daily'])} | {p['binCounts']['300']} | {number(p['bikeDaily'])} | {p['busUncovered']}／{len(p['busIds'])} |")
    lines += ['', '捷運為來源 OD 的整站進出事件，不是獨立人數或站外人流；YouBike 為借還端點事件；公車為站位，不是上下車量。周邊站點、桶位可能跨站重疊，各列不能相加。', '']
    for group,title,rows in groups:
        lines += [f'## {title}', '']
        for i,p in enumerate(rows,1):
            a,b,near=p['anchor'],p['stop'],p['nearestBin']
            peaks=[h for h,v in enumerate(p['weekday']) if v==max(p['weekday'])]
            times='、'.join(f'{h:02d}:00–{h+1:02d}:00' for h in peaks)
            if group=='A':
                why=f"整站日均 {number(p['daily'])} 進出紀錄，但各出口 300 公尺聯集沒有清冊桶位，周邊 {p['busUncovered']}／{len(p['busIds'])} 個公車站位也未配到 300 公尺內的清冊桶位。先確認是否漏列、替代桶是否可用，再判斷轉乘路段的服務缺口。"
            elif group=='B':
                why=f"整站日均 {number(p['daily'])} 進出紀錄，出口聯集僅 {p['binCounts']['300']} 個不同清冊桶位，約 {number(p['ratio'])} 人次／日／桶位；周邊仍有 {p['busUncovered']}／{len(p['busIds'])} 個公車站位未配到桶位。優先查不同出口及候車側的可及性，不直接判定桶不夠。"
            else:
                count='4' if '南港區' in p['areas'] else '0'
                area='南港' if '南港區' in p['areas'] else '北投'
                why=f"日均 {number(p['daily'])} 進出紀錄，交通節點值得核實；但主檔在{area}全區僅 {count} 列，零桶位結果首先反映清冊覆蓋疑點。必須先補清冊，不能依這個結果排增設。"
            lines += [f"### {group}{i}｜{p['name']}", '', '**優先理由**：'+why, '',
                f"**集合起點**：{a['name']}，{a['address']}（WGS84 緯度 {a['y']}、經度 {a['x']}）。先查至公車「{b['name']}」站位的路段；實際可走路線及道路側現場確認。", '',
                '**資料依據**：', '',
                f"- 捷運來源站 `{p['id']}`：29 日進站 {number(p['entries'])}、出站 {number(p['exits'])}，日均合計 {number(p['daily'])}；{len(p['exitLocations'])} 個來源出口。",
                f"- 清冊：100／200／300 公尺出口聯集分別 {p['binCounts']['100']}／{p['binCounts']['200']}／{p['binCounts']['300']} 個不同座標。任一出口至最近清冊桶位最短直線 {number(near['distanceM'])} 公尺：{near['address']}（`{near['id']}`）。",
                f"- YouBike：周邊 {len(p['bikeIds'])} 站，已觀測日均 {number(p['bikeDaily'])} 次端點事件；{p['unknown']} 站活動未知。集合站 `{a['id']}` 的 29 日事件數為 {number(a['events'])}，該集合點至最近清冊桶位 {number(a['nearestBin']['distanceM'])} 公尺，與整站最短距離分開判讀。",
                f"- 公車：出口 300 公尺聯集內 {len(p['busIds'])} 個不同站位，其中 {p['busUncovered']} 個站位周邊 300 公尺未見清冊桶位；集合點附近站位 ID `{b['id']}`。", '',
                '**現場要確認**：', '']
            lines += [f'{j}. {q}' for j,q in enumerate(QUESTIONS[p['name']],1)]
            lines += ['', f'**建議觀察時段**：平日 {times}，依該站來源進站紀錄的平日尖峰選取；另做 09:00–10:00 同長度對照。09:00–10:00 僅借用全市路面清潔陳情受理尖峰作比較，不表示本站曾有陳情。', '',
                '**帶回的判讀**：有桶卻漏列 → 補清冊；有桶但受限或不易到達 → 記錄開放／動線問題；確認無可用替代點且重複觀察到投放困難 → 才進下一步容量、維護或配置評估。', '']
    m=data['transport']['meta'];meta=data['meta']
    lines += ['## 統一的現勘紀錄方式', '',
        '每個觀察時段先採相同的 20 分鐘，記錄實際日期、起訖時間、天氣、是否活動日及觀察者。這是第一輪觀察規格，不能由單次結果估算全年需求。', '',
        '| 要記錄的項目 | 現場紀錄 |', '|---|---|',
        '| 位置 | 出口編號、道路側、站位 ID、GPS、照片時間；與來源位置不符時保留差異。 |',
        '| 桶況與使用條件 | 是否存在、可用、可見、可接近；一般垃圾／回收別、開放時間、滿溢與明顯清潔狀況。 |',
        '| 步行可及性 | 從集合點／候車處至最近可用桶的實走時間、路徑、過街次數及障礙；不可把直線距離當實走距離。 |',
        '| 相同長度觀察 | 行經人次、實際投放次數、攜帶／找桶行為及各位置新增地面垃圾；無法辨認原因就記未知。 |',
        '| 清運 | 現場觀察到的清運時間，與管理單位提供的班表分欄；沒有證據不填「未清運」。 |',
        '| 回訪 | 比較相同位置、相同時段；活動日與一般日分開，必要時增加週末樣本。 |', '',
        '垃圾車服務陳情的全市尖峰為 21:00–22:00（35／320 件）。只有在取得該點實際清運班表、確認夜間可觀察後，才安排夜間補查；不把這個時段套用為八站的清運或滿溢時段。', '',
        '## 來源、分母與限制', '',
        f"- [捷運逐時 OD]({m['odSource']})：2026 年七月，排除 7/10、7/11，29 日（平日 22、週末 7）。起迄站原始名單 119／108 不對稱，只代表收錄旅次；時段為來源欄位，未另核實刷卡時鐘。",
        f"- [捷運出入口]({m['exitSource']})：2026/08 更新；[YouBike 活動]({meta['activitySource']})：同 29 日；[YouBike 站點]({meta['stationSource']})：2026-10-18 快照。",
        f"- [公車站位]({meta['busSource']})：{meta['busUpdatedAt']}，使用既有分析保留的站位集合，並非所有臺北公車站；路線數、站位數不當成人數。",
        f"- [清潔箱主檔]({meta['binSource']})：2026-09-30 更新、2026-10-15 下載，681 列、680 筆可定位，完整性未核實。桶位以不同座標計數，不等於現場容器數或容量。",
        f"- [陳情類別明細]({m['complaintSource']})：依真正受理日期篩選，同 29 日的路面清潔 749 件，09:00–10:00 最高 70 件；垃圾車服務 320 件，21:00–22:00 最高 35 件。沒有案件位置，不能定位到八站，受理時間也不是事件發生時間。",
        '- 捷運 OD 下載回應的 Content-MD5 與保存內容不符，尚未釐清；資料摘要只用來辨識保存版本，不是官方完整性驗證。現勘優先序限於這份保存內容。',
        '- 七月活動、八月出口、九月清冊與十月交通站點為跨期桌面比對。任何現場變動均需另記，不可回填成當時已知。', '',
        '## 重算與證據定位', '',
        '執行 `python3 scripts/prepare-field-visit-list.py` 重算此文件。這份文件使用保存的交叉分析，不重新下載或更改分母。', '',
        f"輸入：[cross-analysis.json](../dist/data/cross-analysis.json)，SHA-256：`{hashlib.sha256(SOURCE.read_bytes()).hexdigest()}`。",
        '每站可用上列捷運 ID 找 `transport.stations`，集合點 ID 找 `stations`，公車 ID 找 `buses`；原始輸入路徑與摘要見 `meta.inputs`、`transport.meta.inputs`。',
        '方法：[交叉分析方法](cross-analysis.md)；本提案補充既有研究，未取代其他批次的現勘名單。',
        '新增證據對照：[中山、忠孝新生場域補查](../research/station-venue-recheck-2026-10-22/README.md)已保留官方站內設施設計線索及十月街頭清冊複查；中山有包含垃圾桶的服務帶紀錄，忠孝新生有場域名錄線索。這些尚未證實現場可用數量、付費區界線或一般行人可及性，現勘應帶著線索核實，不能把街頭零列當成站內無桶。',
        '另有[九月捷運比較](../research/mrt-bin-comparison-2026-10-22/README.md)，其月份、74 站行政範圍及排名母體不同；本提案沿用七月 29 日、73 站交通鄰近範圍，不拼接兩份名次。', '']
    return '\n'.join(lines)


if __name__ == '__main__':
    data = json.loads(SOURCE.read_text())
    groups = build(data)
    TARGET.write_text(render(data, groups))
    print(TARGET)
    print([(group,[p['name'] for p in rows]) for group,_,rows in groups])

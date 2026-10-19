"""Build private handoff tables and a planned, never observed, field schedule."""
import csv
import hashlib
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent

def read(path):
    return json.loads(path.read_text())

def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def write_json(name, data):
    (HERE / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')

def write_csv(name, rows):
    with (HERE / name).open('w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)

def window(hour):
    return f'{hour:02d}:00–{hour+1:02d}:00'

def build():
    summary = read(ROOT / 'results/summary.json')
    manifest = read(ROOT / 'manifest.json')
    config = read(HERE / 'field-plan-config.json')
    assert digest(ROOT / 'protocol.md') == manifest['protocol_sha256']
    for source in manifest['inputs']:
        assert digest(ROOT / source['path']) == source['sha256'], source['path']
    districts = summary['districts'][:12]
    by_area = {d['source_area']: d for d in summary['districts']}
    areas = [d['source_area'] for d in districts]
    grouped = [d for g in config['geographic_groups'] for d in g['districts']]
    assert len(grouped) == len(set(grouped)) == 12 and set(grouped) == set(areas)
    assert config['observation_minutes'] == 15 and config['minute_offset'] + 15 <= 60
    assert [d['id'] for d in config['day_slots']] == ['WD1', 'WD2', 'WE1']
    group_by_area = {area: g for g in config['geographic_groups'] for area in g['districts']}
    candidates = summary['candidates']
    assert len(candidates) == 39 and len({c['candidate_id'] for c in candidates}) == 39
    sessions, handoff, district_rows = [], [], []
    for d in summary['districts']:
        area = d['source_area']
        selected = [c for c in candidates if c['source_area'] == area]
        assert len(selected) == 3
        is_city = area in areas
        priority = '優先補清冊：來源缺列不代表現場缺桶' if area in ['北投區', '南港區'] else '核對來源清冊、箱況、步行與清運'
        district_rows.append({
            'area': area, 'stream': 'city' if is_city else 'campus',
            'group': group_by_area[area]['id'] if is_city else 'U',
            'snapshot_stations': d['snapshot_stations'], 'eligible_stations': d['eligible_stations'],
            'observed_stations': d['observed_stations'], 'unknown_stations': d['unknown_stations'],
            'observed_events': d['events'], 'street_source_rows': d['street_rows'], 'venue_source_rows': d['venue_rows'],
            'candidate_ids': '|'.join(c['candidate_id'] for c in selected),
            'weekday_activity_window': window(d['weekday_peak_hour']),
            'weekday_control_window': window(d['weekday_baseline_hour']),
            'weekend_activity_window': window(d['weekend_peak_hour']),
            'weekend_control_window': window(d['weekend_baseline_hour']),
            'data_task': priority, 'field_status': '未執行', 'authority_status': '逐點待核實',
        })
        for rank, c in enumerate(selected, 1):
            wave = f'W{rank}' if is_city else 'U'
            group = group_by_area[area]['id'] if is_city else 'U'
            handoff.append({
                'candidate_id': c['candidate_id'], 'stream': 'city' if is_city else 'campus',
                'wave': wave, 'geographic_group': group, 'area': area,
                'station_id': c['station_id'], 'name': c['name'], 'address': c['address'],
                'lat': c['lat'], 'lon': c['lon'], 'observed_events': c['events'],
                'events_excluding_flagged_dates': c['events_excluding_flags'],
                'area_activity_rank': c['area_rank'], 'city_activity_rank': c['city_rank'],
                'nearest_street_record_m': c['street_nearest_m'], 'street_record': c['street_name'],
                'street_record_area': c['street_source_area'], 'nearest_venue_hint': c['venue_name'],
                'next_check': c['next_check'], 'district_data_task': priority,
                'point_authority': '未確認', 'actual_bin_status': '未查核', 'walking_route': '未查核',
                'collection_capacity': '未確認', 'handoff_to': '配置比較承接人待確認',
                'ready_for_siting': False,
            })
            for day in config['day_slots']:
                prefix = day['day_type']
                for kind, suffix in [('control', 'baseline'), ('activity', 'peak')]:
                    hour = d[f'{prefix}_{suffix}_hour']
                    minute = config['minute_offset']
                    sessions.append({
                        'visit_id': f'{c["candidate_id"]}-{day["id"]}-{kind}',
                        'stream': 'city' if is_city else 'campus', 'wave': wave,
                        'geographic_group': group, 'area': area, 'candidate_id': c['candidate_id'],
                        'anchor_name': c['name'], 'day_slot': day['id'], 'day_type': prefix,
                        'window_kind': kind, 'allowed_window': window(hour),
                        'suggested_start': f'{hour:02d}:{minute:02d}',
                        'suggested_end': f'{hour:02d}:{minute+15:02d}',
                        'planned_minutes': 15, 'actual_date': '', 'team': '', 'actual_start': '',
                        'actual_end': '', 'effective_minutes': '', 'status': '未排日期',
                        'route_version': '', 'weather': '', 'site_changes': '',
                        'litter_start_count': '', 'litter_end_count': '', 'observed_disposal_attempts': '',
                        'observed_successes': '', 'observed_blocked_attempts': '', 'observed_unresolved_attempts': '',
                        'collection_event': '', 'service_point_record_ids': '',
                        'reason_or_deviation': '', 'reviewer': '',
                    })
    city_sessions = [r for r in sessions if r['stream'] == 'city']
    campus_sessions = [r for r in sessions if r['stream'] == 'campus']
    assert len(city_sessions) == 216 and len(campus_sessions) == 18
    assert len({r['visit_id'] for r in sessions}) == 234
    waves = [{'id': f'W{i}', 'label': f'第{i}輪：12區各第{i}錨點',
              'candidate_ids': [r['candidate_id'] for r in handoff if r['wave'] == f'W{i}'],
              'anchors': 12, 'sessions': 72, 'observation_hours': 18} for i in [1, 2, 3]]
    capacity = []
    for teams in [1, 2, 3]:
        groups = math.ceil(len(areas) / teams)
        # Every assigned cohort repeats WD1/WD2/WE1 in each of three rounds.
        capacity.append({'teams': teams, 'people': teams * config['people_per_team'],
                         'city_observation_dates': groups * 3 * 3,
                         'weekday_dates': groups * 3 * 2, 'weekend_dates': groups * 3,
                         'interpretation': '每輪12點按可用組數分批、兩時窗同日完成；不是連續日曆天或完工承諾'})
    plan = {'version': config['version'], 'status': 'planned_not_executed',
            'city': {'districts': 12, 'anchors': 36, 'sessions': 216, 'observation_hours': 54,
                     'person_observation_hours': 54 * config['people_per_team']},
            'campus': {'anchors': 3, 'sessions': 18, 'observation_hours': 4.5,
                       'person_observation_hours': 4.5 * config['people_per_team']},
            'waves': waves, 'geographic_groups': config['geographic_groups'],
            'capacity_scenarios': capacity, 'config': config, 'districts': district_rows,
            'source_hashes': {str(p.relative_to(ROOT)): digest(p) for p in [ROOT/'protocol.md', ROOT/'manifest.json', ROOT/'results/summary.json', ROOT/'results/stations.csv', HERE/'field-plan-config.json']},
            'limits': ['七月活動時窗不是現時垃圾尖峰；現場時段有效性須另外記錄。',
                       '每小時內的15–30分是本次排程提案，來源只有小時精度，未提供分鐘級尖峰證據。',
                       '兩人一組僅為人力試算；實際承接人、日期、通勤與許可均未確認。',
                       '觀察小時是站點時間；兩人同步記錄不增加站次或事件分母。',
                       '三點只是首輪查核額度，不能代表整區垃圾問題；全站與無YouBike情境保留補查。']}
    scopes = [{'candidate_id': c['candidate_id'], 'area': c['source_area'], 'anchor_name': c['name'],
               'scope_version': '', 'confirmed_date': '', 'start_landmark': '', 'end_landmark': '',
               'street_side': '', 'safe_observer_location': '', 'view_direction': '',
               'scope_area_or_length': '', 'measurement_unit': '', 'service_point_ids': '',
               'access_rules_checked': '', 'manager_or_authority_evidence': '',
               'photo_reference': '', 'status': '未查核', 'reason_or_change': ''} for c in candidates]
    write_csv('anchor-scope-setup.csv', scopes)
    write_csv('hotspot-candidates-handoff.csv', handoff)
    write_csv('district-readiness.csv', district_rows)
    write_csv('planned-visits.csv', sessions)
    write_json('field-plan.json', plan)
    sources = [ROOT/'results/stations.csv', ROOT/'results/candidates.csv', ROOT/'results/districts.csv', ROOT/'results/sensitivity.csv', ROOT/'results/hourly-profiles.csv']
    write_json('handoff-manifest.json', {'status': 'desk_delivery_and_field_plan_only',
        'field_visits_completed': 0, 'agency_commitments_confirmed': 0,
        'source_files': [{'path': '../'+str(p.relative_to(ROOT)), 'sha256': digest(p)} for p in sources],
        'generated_files': [{'path': n, 'sha256': digest(HERE/n)} for n in ['hotspot-candidates-handoff.csv','district-readiness.csv','planned-visits.csv','anchor-scope-setup.csv','field-plan.json']],
        'existing_validation': read(ROOT/'validation.json')})
    city_events = sum(d['events'] for d in districts)
    lines = ['# 熱點分析交接：全市都有查核入口，尚不能推薦桶位', '',
             f'全臺北市12區的桌面交付已整理成13列區域狀態（校區另列）與39列觀察錨點交接表。12區有{sum(d["eligible_stations"] for d in districts):,}個啟用有效站、{city_events:,}個已觀測借還端點；這是交通活動代理，不是垃圾量。', '',
             '## 接收者先看什麼', '',
             '| 交付 | 內容 | 使用方式 |', '|---|---|---|',
             '| district-readiness.csv | 12區及校區的分母、清冊列數、未知站、時窗與待辦 | 保留全部區域；先追北投與南港清冊覆蓋 |',
             '| hotspot-candidates-handoff.csv | 36個全市錨點、校區另3點；座標、活動、鄰近線索與未知現場條件 | 當作訪查入口，不能直接當新桶位置 |',
             '| ../results/stations.csv | 全部1,821站與停用、無觀測、排序狀態 | 候選名單以外的站仍保留；未知不填零 |',
             '| ../results/sensitivity.csv | 排除異常日期、改150／500m分散門檻的對照 | 檢查選點對規則的依賴，不挑最好看的版本 |',
             '| planned-visits.csv、field-plan.md | 234筆未執行訪次與分輪計畫 | 先填日期、人員與觀察範圍，再記真實結果 |', '',
             '## 查核優先順序', '',
             '1. 12區同步核對清冊；北投0街道列、南港4列列為優先補件，不能推定現場沒有桶。',
             '2. 按W1→W2→W3讓所有12區先有首點基線，再加深同區查核。輪次是執行順序，沒有重新計算垃圾風險排名。',
             '3. 將現場結果分成資料不足、資訊／可達性、清運維護與配置比較條件。缺資料或權責未明者保留未知，不能強行推薦桶位。', '',
             '## 每區交接索引', '', '| 區域 | 觀測站／啟用站 | 未知站 | 街道列／場所線索 | 錨點 |', '|---|---:|---:|---:|---|']
    lines += [f'| {d["area"]} | {d["observed_stations"]}／{d["eligible_stations"]} | {d["unknown_stations"]} | {d["street_source_rows"]}／{d["venue_source_rows"]} | {d["candidate_ids"].replace("|", "、")} |' for d in district_rows]
    lines += ['', '## 接收與進入配置比較的條件', '',
              '- 可回查站號、來源日期、計數分母及選點理由；本交付的來源雜湊見handoff-manifest.json。',
              '- 實際可用箱況、步行路線、清運條件、場地管理及必要核准仍逐點待查；表內不預填完成。',
              '- 有了可比較的現場基線後，才交接A現況、B原位指引與C等總量位置調整。各方案保持同一邊界、時窗與資料版本。',
              '- 交通／場地窗口與土地或設施核准者分列；不把建議主責寫成已承接。', '',
              '## 證據限制與交付範圍', '',
              '七月借還資料有7/10、7/11品質問題，站點是10月快照，不能視為全年同步現況。47個啟用有效站無可配對觀測；未知不等於零。681街道列與130場所線索不可相加為箱數。回饋不是代表性抽樣，不對應特定錨點；公車、行人、商圈、垃圾事件與清運容量仍須補查。', '',
              '既有分析規則與已驗證結果保留不變。本次新增的是交接與排程；沒有新增實測、機關同意或改善成效。']
    (HERE/'hotspot-handoff.md').write_text('\n'.join(lines)+'\n')
    write_field_plan(plan)
    return plan

def write_field_plan(plan):
    lines = ['# 首輪現勘計畫：先覆蓋12區，再增加每區觀察點', '',
             '計畫與空白紀錄已備妥，實際現勘尚未執行。日期與人員待確認；本文件不代表機關承接或已預約。', '',
             '## 三輪順序', '',
             '| 輪次 | 覆蓋 | 每點要求 | 站次／純觀察 |', '|---|---|---|---|']
    lines += [f'| {w["id"]} | 12區各第{w["id"][1]}錨點，共12點 | 兩個不同平日＋一個週末，每日對照與活動兩窗 | 72站次／18小時 |' for w in plan['waves']]
    lines += ['', 'W1完成或明確保留各區未完成原因後才彙整下一輪排班。個別區無法進場時保留待補；其餘區可繼續，不把缺測區當零，也不將已觀察區宣稱全市代表。W2、W3維持相同方法。校區U序列獨立安排3點、18站次、4.5小時，不占12區額度，也不重複計入全站分母。', '',
              '## 區域協調分組', '', '| 分組 | 行政區 | 用途 |', '|---|---|---|']
    lines += [f'| {g["id"]} {g["label"]} | {"、".join(g["districts"])} | 共用查核與協調清單；不是同一條步行路線 |' for g in plan['geographic_groups']]
    lines += ['', '四組都從本輪開始盤點；北投與南港清冊補件優先送出待詢問清單。分組不代表需求或垃圾風險排名，亦未驗證最短交通路線。觀察組可依可用時間跨分組分派，但每組每日只排一個錨點。', '',
              '## 人力情境與排程方式', '',
              '以兩人一組作為規劃情境：一人固定觀察投放事件，另一人記錄服務點、路徑與清掃脈絡；同一事件不重複加總。先確認是否有這些人力，再填真實排班。', '',
              '| 可用觀察組 | 人數假設 | 全市觀察日期數 | 平日／週末日期數 |', '|---|---:|---:|---:|']
    lines += [f'| {c["teams"]}組 | {c["people"]}人 | {c["city_observation_dates"]}日 | {c["weekday_dates"]}／{c["weekend_dates"]} |' for c in plan['capacity_scenarios']]
    lines += ['', '上述按每輪12點、每組每觀察日一點、三個日期及兩個時窗換算；各組同日並行，沒有同時段跨點衝突。日期數不是連續日曆天，也不是完工日期；週末可用性、交通、排班、改期與跨輪落差另計。校區在1／2／3組情境下，若另批執行還需9／6／3個觀察日期。', '',
              '全市54小時是216站次的純觀察時長；兩人同步為108人時，校區另4.5小時／9人時。這些都不含事前範圍確認、路線與桶況盤點、交通、整理、等待、陪同及重訪，不能當作總工時或預算。兩時窗之間不預設連續值勤。', '',
              '## 實際排班規則', '',
              '1. 對每個錨點先填WD1、WD2兩個不同平日與WE1一個週末日期，確認場域規則、安全觀察位置和兩個時窗都可到場。',
              '2. 同一錨點、同一日槽的control與activity兩筆訪次使用同日；同組同日不分派第二個錨點。三輪各組的日期可不同，不強稱全市同步量測。',
              '3. planned-visits.csv已列完整234筆訪次。預排觀察為來源小時窗內15–30分；分鐘選擇是排程提案，並非分鐘級活動證據。到場起迄與有效分鐘照實填寫。',
              '4. 錨點的觀察邊界、路徑、方向與服務點清單在首次正式觀察前固定；後續變更須另記版本，不與舊邊界直接合併。',
              '5. 未能完成的訪次保留原ID及原因；補訪用原ID加R1、R2另列，不覆寫原紀錄。補訪維持同一日型及時窗，無法維持時標偏離。', '',
              '## 各區點位與時間窗', '',
              '| 區域 | W1／W2／W3錨點 | 平日：對照／活動 | 週末：對照／活動 |', '|---|---|---|---|']
    lines += [f'| {d["area"]} | {d["candidate_ids"].replace("|", "／")} | {d["weekday_control_window"]}／{d["weekday_activity_window"]} | {d["weekend_control_window"]}／{d["weekend_activity_window"]} |' for d in plan['districts']]
    lines += ['', '點名、地址、經緯度、來源活動、最近街道紀錄及場所線索見hotspot-candidates-handoff.csv。既有直線距離不能當步行距離；現地安全站位及路線需另核對。', '',
              '## 每次做什麼、如何回報', '',
              '- 到場前：查實際通行與場域規則、天候或施工、觀察邊界版本、現有服務點及時窗；不放設備、不移桶、不妨礙通行。',
              '- 到場：記真實日期、起迄、有效分鐘；一人記直接看見的投放嘗試，另一人記箱況、街面存量與清掃事件。逐桶填service-point-records.csv，不能把多桶合併成一個滿度。',
              '- 離場：按field-record-guide.md核對欄位與照片編號，保留未觀察、部分完成、取消、改期及反例，交另一人複核；不得預填零。',
              '- 每批交付：訪次狀態表、逐服務點表、缺測原因、權責待查及四類問題判讀。下一輪與配置比較均保留未完成區域。', '',
              '## 通過與停止條件', '',
              '每個錨點需六筆可回查訪次，或逐筆保留未完成原因；只有完整同邊界、同日型／時窗、可辨別清掃脈絡的紀錄才進入相應比較。首次現勘只能建立基線，不宣稱改善成效。', '',
              '任何危及安全、現場要求停止、範圍屬性不明或規則要求事先許可的情況，停止相關觀察並查明；不因此停止無關的桌面分析。實際設桶、移桶、採購與試辦另案取得全部必要核准，不屬本輪。', '',
              '方法沿用../protocol.md的2平日＋1週末、每次15分鐘與分區小時窗；本次僅新增輪次、協調分組、分鐘偏移和容量情境，詳見field-plan-config.json。']
    (HERE/'field-plan.md').write_text('\n'.join(lines)+'\n')

if __name__ == '__main__':
    p=build()
    print(f'Built {p["city"]["anchors"]} city anchors / {p["city"]["sessions"]} planned visits; campus separate.')

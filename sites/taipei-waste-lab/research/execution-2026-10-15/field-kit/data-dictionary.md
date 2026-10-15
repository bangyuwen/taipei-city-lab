# 資料字典與代碼

本字典對應同目錄 CSV。所有預排模板都不是已觀察資料。日期建議 ISO 8601 (`YYYY-MM-DD`)，時間使用台北當地 24 小時制 (`HH:MM`)；有時區時間戳記用 `YYYY-MM-DDThh:mm:ss+08:00`。ID 一經使用不得重用。

## 通用規則

- 空白＝未知／尚未填／不適用待區分；只有確認量測為零時填 `0`。
- 狀態值建議：`planned`、`scheduled`、`completed`、`partial`、`cancelled`、`not_started`、`not_observed`、`invalid_protocol`。取消或偏離保留列及原因。
- 來源歸屬：`direct_observation`、`official_record`、`participant_report`、`photo_record`、`researcher_inference`、`unknown`。推論不可當成確認來源。
- 研究槽位：`SEG-01`–`SEG-06`。目前只在 `segments.csv`、排程訪次及任務槽中使用。實際地址、座標、日期、觀察者與參與者均空白。
- 日期槽：`WD1`、`WD2` 是兩個不同平日；`WE1`、`WE2` 是兩個不同假日。每個日期槽各排 `peak`、`offpeak` 兩個時段。各段實際日期／鐘點需在基線前固定。
- 時段視窗：規劃值 30 分鐘到訪、其中固定 15 分鐘行為／人流計數；任何預試修訂要在基線前凍結並保存版本。
- 雙人記錄：`double_code_status` 使用 `not_selected`、`independent_recorded`、`adjudication_pending`、`adjudicated`、`not_completed`；`review_status` 使用 `not_reviewed`、`agreement`、`adjudicated`、`unresolved`。未抽中複核時，第二觀察者與裁決欄留空，不得補值。

## CSV 欄位

### `segments.csv` — 每列一個研究街段槽位

| 欄位 | 定義／允許值 |
|---|---|
| `segment_id` | 槽位 ID `SEG-01`–`SEG-06`，不等於官方設施 ID。 |
| `stratum_slot` | 規劃情境槽：`commercial_tourism_1/2`、`transit_1/2`、`residential_mixed_1/2`。此為抽樣配置，不是現地分類結論。 |
| `record_status` | 初始 `planned_placeholder`；選址後可為 `candidate`、`selected`、`excluded`。 |
| `site_name`、`start_anchor`、`end_anchor` | 現地名稱及可重現邊界；未選址前空白。 |
| `side_of_street` | `north`、`south`、`east`、`west`、`other`；方向相對於路段走向。 |
| `planned_reference_length_m` | 設計起點 100 公尺，不是現地實測。 |
| `actual_length_m` | 現地核實的固定量測路線長度；每次訪次的 `fixed_route_length_m` 必須一致。 |
| `measurement_route_id`、`measurement_route_version` | 凍結核心量測路線及版本；訪次表重複記錄同一組 ID／版本以便核對。 |
| `fixed_observation_area_m2` | 固定核心街面觀察範圍面積；每次訪次須重複記錄相同值。 |
| `footfall_cross_section_id`、`footfall_count_direction` | 固定人流斷面及計數方向；訪次記錄須與街段凍結值一致。 |
| `route_description`、`route_photo_reference` | 固定路線描述和可重現的地圖／照片索引；避免以路人影像作記錄。 |
| `land_use_context` | 現場分類及理由；可用多值文字，不從槽位自動推定。 |
| `selection_rationale` | 選入／排除理由、候選來源及限制。 |
| `boundary_version` | 範圍變更時遞增版本；基線後不得靜默改界。 |
| `verified_date`、`verified_by` | 核實時間與責任角色。 |

### `service_points.csv` — 每列一個現地服務點或箱體

`service_point_id` 是研究 ID；`official_id` 僅在來源確有官方編號時填。`segment_id` 可空白，代表段外鄰接點並需在 `notes` 說明。記錄 `point_type`（`pedestrian_bin`、`recycling_bin`、`commercial_collection`、`household_collection`、`other`、`unknown`）、`count_of_containers`、`public_access_status`（`open`、`restricted`、`closed`、`unknown`）、`opening_hours`、`location_description`、`latitude`、`longitude`、`coordinate_source`、`verified_date`、`verified_by`、`photo_reference`、`notes`。不同用途的服務點不可合併成「公桶」。

### `observation_visits.csv` — 每列一個預排到訪或實際到訪

預排列的槽位、30 分鐘預排時長、15 分鐘預排行為視窗及 `planned` 狀態已填；日期、路線、量測視窗及所有觀察結果皆空白。核心街面值由主要觀察者填入 `_observer_1` 欄；雙人複核時另填 `_observer_2` 和 `_adjudicated`。只有裁決欄有值時，才以裁決值作主要報告值；否則使用主要觀察者值。單一觀察者不得補造第二人或裁決值。

| 欄位 | 定義／允許值 |
|---|---|
| `visit_id`、`segment_id`、`date_slot`、`day_type`、`time_slot` | 唯一訪次、街段槽及分層；`day_type` 為 `weekday`／`weekend`。 |
| `planned_date`、`planned_start_time` | 基線前填入實際排程日期與台北當地時間；目前故意空白。 |
| `planned_duration_min`、`behavior_window_min` | 預排總時長及行為視窗分鐘；模板值為 30、15。 |
| `status`、`actual_start`、`actual_end` | 訪次狀態及實際到訪起迄。取消、部分與偏離均保留。 |
| `observer_1`、`observer_2` | 訪次人員代碼；未指派留白。各量測的獨立讀值依欄位後綴保存。 |
| `weather_code`、`special_event` | 天候及活動狀態；活動名稱、施工等寫入 `notes`。 |
| `measurement_route_id`、`measurement_route_version` | 凍結的核心街段量測路線 ID 與版本；每次訪視須與 `segments.csv` 一致。變更需新版本並說明。 |
| `fixed_observation_area_m2`、`fixed_route_length_m` | 固定範圍面積及實測路線長度；基線前核實，不以 100 公尺設計值冒充實測。`fixed_route_length_m` 須等於街段清冊的 `actual_length_m`。 |
| `footfall_cross_section_id`、`footfall_count_direction` | 固定人流斷面 ID 與計數方向；須與街段清冊凍結值一致。 |
| `surface_count_start`、`surface_count_end`、`surface_count_actual_min` | 街面存量計數實際起迄時間與有效分鐘；遮擋／中斷不計入有效分鐘並記缺測原因。 |
| `behavior_window_start`、`behavior_window_end`、`actual_behavior_window_min` | 本次行為觀察的實際起迄及有效分鐘；不是預排值。 |
| `footfall_window_start`、`footfall_window_end`、`footfall_window_actual_min` | 固定斷面人流計數的實際時間窗及有效分鐘。 |
| `disposal_window_start`、`disposal_window_end`、`disposal_window_actual_min` | 自然投放行為的實際時間窗及有效分鐘；不含標準化任務。若與人流同窗，記相同起迄；不按規劃分鐘外推。 |
| `pedestrian_count_observer_1/2/adjudicated` | 固定斷面通過人次，各觀察者分開記錄；不是獨立人數。確定無人通過才填 0。 |
| `observed_disposal_attempts_observer_1/2/adjudicated` | 視窗內直接看到的自然投放嘗試數，不含任務。 |
| `observed_successful_disposals_observer_1/2/adjudicated` | 嘗試中完成投放的數量；分母為同一視窗直接觀察到的嘗試。 |
| `observed_blocked_or_abandoned_observer_1/2/adjudicated` | 直接看到的受阻／放棄數；原因及觀察線索記於 `review_notes` 或 `notes`。 |
| `ground_litter_items_observer_1/2/adjudicated` | 固定核心範圍逐件可辨識散落物數；不含分列的煙蒂、服務點溢出或鄰接區。 |
| `cigarette_butts_observer_1/2/adjudicated` | 固定核心範圍煙蒂數。 |
| `suspected_non_target_bags_observer_1/2/adjudicated` | 固定核心範圍內依外觀疑似非目標整袋數；不代表來源確認。 |
| `unitemized_piles_observer_1/2/adjudicated` | 無法逐件辨識的堆置數；不估虛構件數。 |
| `last_collection_time`、`last_sweep_time`、`service_time_source` | 僅在可確認為整段共通時間時填訪次層級；若不同服務點時間不同，改以 `cleaning_collection_log.csv` 逐點記錄。未知不得推算。 |
| `double_code_status` | `not_selected`、`independent_recorded`、`adjudication_pending`、`adjudicated`、`not_completed`。抽複核比例以所有完成訪次為分母。 |
| `review_status`、`review_notes` | `not_reviewed`、`agreement`、`adjudicated`、`unresolved`；記錄差異及裁決理由，不以平均掩蓋分類差異。 |
| `photo_reference` | 整體街段／固定路線照片索引；逐點或鄰接區影像索引放附表。避免可辨識路人。 |
| `missing_reason` | `none`、`weather_safety`、`blocked_view`、`equipment_issue`、`time_unknown`、`cancelled`、`other`；多原因以 `|` 分隔。 |
| `protocol_version`、`notes` | 凍結協定版本及異常情境。 |

### `visit_detail_appendix.csv` — 每列一個訪次 × 服務點或鄰接區

此為唯一附表，用來保存逐服務點滿度／溢出及周邊外移觀察，避免把多個桶體塞入訪次單欄。每個訪次對每個核實服務點建立 `record_type=service_point` 一列；另對事前界定的鄰接緩衝區建立 `record_type=adjacent_area` 一列。現模板只有表頭，沒有假造服務點或觀察資料。

| 欄位 | 定義／允許值 |
|---|---|
| `detail_id` | 附表列唯一 ID。 |
| `visit_id` | 外鍵，必須對應 `observation_visits.csv.visit_id`。 |
| `record_type` | `service_point` 或 `adjacent_area`。 |
| `service_point_id` | 當 `record_type=service_point` 時必填，外鍵對應 `service_points.csv.service_point_id`；鄰接區列留空。 |
| `adjacent_area_id` | 當 `record_type=adjacent_area` 時必填。以街段槽、固定區序號構成穩定 ID（例如 `SEG-01-BUF-01`）；它不是另一份 CSV 的外鍵，定義、邊界描述與版本須在本列及圖／照片參照中保持一致。服務點列留空。 |
| `area_boundary_version`、`area_definition`、`area_length_m`、`area_m2` | 鄰接區的凍結邊界版本、範圍描述、長度與面積；核心服務點列可留空。不得事後依垃圾位置改畫緩衝區。 |
| `unit_observation_status` | 服務點列用 `usable`、`blocked`、`closed`、`fault`、`unknown`；鄰接區列用 `observed`、`partial`、`not_observed`、`unknown`。 |
| `bin_fill_band_observer_1/2/adjudicated` | 每個服務點的目測滿度：`empty`、`1_25`、`26_50`、`51_75`、`76_99`、`full_no_overflow`、`overflow`、`unknown`。不是精確容量；每個桶一列。 |
| `overflow_items_observer_1/2/adjudicated` | 服務點周圍可逐件辨識的溢出物數；無法辨識則留空並記堆置狀態及原因。 |
| `ground_litter_items_observer_1/2/adjudicated` | 鄰接區固定範圍內可逐件辨識散落物數；服務點列留空。 |
| `suspected_non_target_bags_observer_1/2/adjudicated` | 該服務點周邊或鄰接區依外觀疑似整袋數；只可作待核實類別，不證明來源。 |
| `observer_1_id`、`observer_2_id`、`double_code_status` | 該列讀值者及雙人獨立記錄狀態；狀態碼同上；第二人未量測時留空。 |
| `review_status`、`review_notes` | 複核狀態（`not_reviewed`、`agreement`、`adjudicated`、`unresolved`）、讀值差異及裁決依據；裁決不能靠平均值。 |
| `photo_reference`、`notes` | 該服務點或鄰接區的照片索引及補充；不得含可辨識路人影像。 |

### `cleaning_collection_log.csv` — 每列一個清運、掃街或清潔事件

欄位：`service_event_id`、`segment_id`、`service_point_id`、`event_type`、`event_start`、`event_end`、`event_status`、`source_type`、`source_reference`、`waste_removed_count_or_volume`、`unit`、`crew_minutes`、`observed_by`、`notes`。`event_type` 使用 `bin_emptying`、`street_sweeping`、`repair`、`washing`、`other`；無法確認分量則留空，不填零。清空與掃街不能合併成同一事件。

### `user_task_slots.csv` — 30 個尚未執行的任務槽

五個任務槽分配給每一個 `segment_id`。所有列初始 `status=planned`，`task_date`、`planned_start_time`、`participant_id`、任務結果及耗時空白；不得作為路人行為或成功／失敗觀察使用。

執行欄位：`task_id`、`segment_id`、`slot_number`、`status`、`task_date`、`planned_start_time`、`participant_id`、`participant_familiarity`（`familiar`、`unfamiliar`、`unknown`）、`information_condition`、`test_object`、`task_started`、`task_start_time`、`task_end_time`、`success`、`failure_reason`、`detour_m`、`elapsed_min`、`protocol_deviation`、`consent_status`、`notes`。`success` 使用 `yes`／`no`／空白；任務未開始不填 `no`，而填 `task_started=no` 及原因。任務開始後的中止、找不到箱或無法操作計為失敗，仍在分母。預試後固定的停止上限及繞行標準寫入 `information_condition` 或版本文件。

### `event_verification.csv` — 每列一個事件候選核驗

欄位：`event_candidate_id`、`segment_id`、`service_point_id`、`event_type`、`event_date_claimed`、`source_type`、`source_reference`、`evidence_date`、`evidence_description`、`verification_status`、`verified_by`、`verification_date`、`alternative_explanation`、`notes`。`event_type`：`installation`、`removal`、`relocation`、`replacement`、`reopening`、`unknown`。`verification_status`：`confirmed`、`not_confirmed`、`unresolved`、`not_observed`。來源列差異或現勘未見不單獨確認撤除。

### `trial_registration.csv` — 每列一個已凍結試辦協定

欄位：`trial_id`、`registration_status`、`decision_owner`、`protocol_version`、`registered_at`、`diagnosis_evidence_ids`、`target_mechanism`、`single_intervention`、`randomization_unit`、`cluster_count`、`pairing_variables`、`treatment_definition`、`control_definition`、`buffer_definition`、`baseline_start`、`baseline_end`、`intervention_start`、`intervention_end`、`primary_outcome`、`primary_outcome_unit`、`MDE`、`MDE_rationale`、`power_or_precision_plan`、`guardrails`、`decision_thresholds`、`analysis_plan`、`missing_data_plan`、`spillover_plan`、`collection_time_handling`、`rollback_rule`、`permissions_status`、`resource_commitment`、`freeze_signature_or_record`、`notes`。在基線完成、決策者確認、介入前不得猜填 MDE、guardrail、門檻、群集數或主要結果。狀態用 `draft_baseline_pending`、`ready_to_freeze`、`frozen_before_assignment`、`cancelled`。

### `trial_execution.csv` — 每列一個群集 × 執行日或偏離事件

欄位：`trial_id`、`cluster_id`、`assignment`、`execution_date`、`intervention_delivered`、`delivery_start`、`delivery_end`、`fidelity_status`、`deviation_code`、`deviation_description`、`actual_collection_count`、`actual_sweeping_count`、`crew_minutes`、`resource_cost`、`weather_code`、`special_event`、`spillover_observed`、`adjacent_area_reference`、`rollback_or_issue`、`recorded_by`、`source_reference`、`notes`。原分派組別不可因未執行而改寫；`assignment` 只由已凍結登記表帶入。

## 分母與分類規則速查

| 結果 | 分母 | 失敗／缺失處理 |
|---|---|---|
| 街段每 100m 散落物 | 固定、已完成計數的實際路段長度 | 不可數的堆置另列；視線遮擋時標缺測，不當零。 |
| 固定斷面人流 | 該訪次實際有效人流觀察分鐘 | 斷面被封或觀察中斷則記缺測與分鐘數；不得按預排 15 分鐘外推。 |
| 自然投放成功率 | 直接觀察到的投放嘗試數 | 受阻／放棄均屬失敗；觀察者未看到不能推定無嘗試。 |
| 使用者任務成功率／失敗率 | 所有已開始任務 | 未開始任務另報；已開始後的中止保留失敗／中止原因。 |
| 試辦成效 | 分派街段／群集 | 到訪是同一群集內重複量測，不能充當新群集；遺失結果須列明。 |
| 家戶垃圾混入 | 有可核實來源的投入事件或管理記錄 | 外觀只可列疑似；未知不能併入已確認家戶數。 |

# Transport and bin position cross-check

The map supports a desktop inspection proposal, not a finding of insufficient bins. The user requested transport and pedestrian activity to be compared with existing bins on 2026-10-22. The implementation preserves the site's existing routes and explicitly dated historical queries; the default map now uses the fixed September 2026 bin inventory.

## Inputs and reproducibility

Run `npm run prepare-cross-analysis` from the site, then `python3 scripts/prepare-public.py`. The full `prepare-data.py` workflow also regenerates this join. The generator stores SHA-256 digests of all source inputs in `dist/data/cross-analysis.json`.

- `research/taipei-citywide-2026-10-19/results/stations.csv`: retained citywide analysis of 1,821 YouBike stations. The station snapshot is dated 2026-10-18. Activity uses July endpoint events excluding July 10 and 11, following the existing quality flags. Unique matching and other source limitations remain those of the retained analysis.
- `data/cross-analysis-inputs/bus-stops-2026-10-22.json.gz`: the retained official response from https://tcgbusfs.blob.core.windows.net/blobbus/GetStop.gz, retrieved on 2026-10-22. Its embedded update is `2026/10/22 08:03:04`, coordinate system WGS84. The 28,826 route-stop rows form 5,375 stop-location groups. Two groups (833 and 14604) have conflicting coordinates and are excluded. Group by `stopLocationId`, retain distinct route counts, and choose the lowest source Id for display labels. Route counts are neither frequencies nor passenger counts.
- `dist/data/datasets.json`: the fixed `2026-main` baseline, 681 rows with 680 plottable coordinates. Source update 2026-09-30; download 2026-10-15. Citywide completeness is unverified. Beitou has zero rows and Nangang four; these require inventory verification before any service-gap claim.

Only aggregate map data, the UI module and stylesheet are added to the public runtime allowlist. The raw response and research files remain private. The runtime JSON is required by the map; it is not exposed as a research download link.

## Rules

Use all 1,790 active, coordinate-valid YouBike stations. Preserve unknown activity as null. Of these, 1,743 have positive observed activity. Define high activity using the nearest-rank 75th percentile of these positive observations (10,925 events); ties are included. Do not combine activity, distances and station counts into a synthetic score.

Calculate Haversine distances on WGS84 coordinates with a 6,371,000 m sphere. Find the nearest plottable bin in the complete fixed inventory before applying any UI filters. Retain bus locations within 300 m of an eligible station; this proximity scope can include cross-city locations and is not an administrative boundary. Bus-only areas outside these station buffers are not evaluated. Excluding conflicted bus groups may omit nearby service.

Default candidates have activity at or above the threshold, a nearest recorded bin over 100 m away, and at least one retained bus location within 300 m. Sort by activity descending, then station ID. The UI also offers all active stations and 200/300 m distance thresholds. These are desktop prompts, not legal service radii or measured walking distances. Candidate counts are 332 / 259 / 201 for 100 / 200 / 300 m; nearby station buffers overlap, so counts are not independent service gaps.

Click a station to draw its nearest-bin line and inspect each nearby bus stop's distance to its nearest recorded bin. The fixed inventory is never filtered before the nearest-bin calculation. At city scale, bus markers are hidden to keep the map readable; they appear at zoom 14 and above. Historical inventory selections hide cross-analysis layers and results.

## Missing evidence and interpretation

Pedestrian counts and bus boarding/alighting counts are unavailable in these inputs and remain null. YouBike events are travel endpoints, not distinct people; one trip can contribute two events. No garbage-demand measure, route-based walking distance, capacity, usable-bin status, causality or siting approval is inferred. July activity, September inventory and October station locations are a cross-period comparison.

Near recorded bins: inspect visibility, access and maintenance. Far from recorded bins: inspect omitted records, alternatives and crossing/route barriers. In low-coverage districts, verify the inventory first. Add actual pedestrian or passenger measurements only after a compatible spatial unit and observation period are established.

## Reference-driven comparison extension (2026-10-22)

The supplied example motivates three additional views. Its displayed values are not input data. Freeze these rules before generating the extension:

1. Count distinct retained bin coordinates within each station's 100/200/300 m radius (inclusive). Keep source-row counts separately. Divide observed YouBike endpoint events by the 29 retained calendar days, then by the coordinate count when positive. Label this as daily endpoint events per recorded bin location, never people served, capacity or waste demand. Separate zero-bin and unknown-activity cases; neither receives an infinite or zero ratio. Overlapping station circles can share bin locations, so these ratios are not additive.
2. Within the selected stations' 300 m buffers, take the union of bus stop-location IDs. Report how many have no recorded bin within the selected radius, with numerator and denominator. A district comparison means buffers around that district's YouBike stations; it is not an administrative assignment of the bus stops. Never label this as the proportion of all Taipei bus stops. Preserve low inventory coverage caveats.
3. Reuse the existing citywide district hourly profiles, excluding the two flagged July dates. Weekday and weekend daily means use 22 and 7 days respectively. Compute weekend/weekday daily activity and each day type's peak hour. These are district-level YouBike profiles, not station typologies, pedestrian peaks, complaint times or approved cleaning schedules. Search terms do not filter these district aggregates.

The subsequent MRT/complaint extension below fills these two input gaps. Do not reproduce the example's station ranking, 54% claim, complaint peak or cleaning recommendation without its underlying data.

At 300 m, the complete station scope has 729 stations with a calculable ratio, 1,014 observed stations with zero recorded bin coordinates, and 47 stations with unknown activity. The median calculable ratio is approximately 80 daily endpoint events per recorded bin location; the maximum is approximately 993. The bus-buffer union contains 2,741 distinct stop locations, of which 1,719 (62.7%) have no recorded bin within 300 m. These are source coverage and activity comparisons, not observed service capacity.

Verification: all 140 site tests pass, including portable regeneration, independent distance/count checks, zero-denominator handling, unknown activity, shared bus deduplication, and district day denominators. Public asset integrity checks pass. Desktop (1440 px) and phone (390 px) views, district/search filters, empty results and chart-to-map selection were checked in the local browser. No production publication was performed.


## MRT and complaint extension (2026-10-22)

Rebuild raw aggregates with `npm run prepare-transport-time`, then `npm run prepare-cross-analysis` and `python3 scripts/prepare-public.py`. Ordinary builds reuse the retained aggregate and check both raw source hashes before using it. Raw aggregation is deliberately separate because it streams 8,366,652 OD rows. Both source bytes and derived aggregates are retained for offline reproduction; none of the raw complaint records or case identifiers enter the public allowlist. Download URLs and original-byte hashes are in `data/cross-analysis-inputs/source-receipts.json` and `mrt-od-202607.csv.receipt.json`.

Primary period is July 2026 excluding July 10 and 11, matching YouBike quality exclusions: 29 days, 22 weekdays and seven weekend days. Full July totals are also retained as a sensitivity check. The download month is not assumed to be the complaint acceptance month. Source-schema decisions are recorded below.

- Official OD source: https://data.taipei/dataset/detail?id=63f31c7e-7fc3-418b-bd82-b95158755b4d. Source hourly blocks have 119 origin names and 108 destination names, so no claim of complete cross-line coverage is made. Normalize the three G/O destination prefixes only. Validate unique origin/destination pairs per date/hour, a complete rectangular matrix per supplied block, 31 dates, and equal total origin/destination counts. Observed hours are 00, 01 and 05–23; 02–04 are absent, not measured zero. The retained 29-day sum is 62,555,809 source trips; full month 63,379,613. Hourly plots use origin counts under the source's record-hour field, not inferred destination arrival hours. The exact meaning of that clock remains unverified.
- Official exits: https://data.taipei/dataset/detail?id=cfa4778c-62c1-497b-b704-756231de348b, 390 CP950-encoded rows. Parse station names and explicitly match 大橋頭 to 大橋頭站. Retain stations with any exit within 300 m of a retained Taipei YouBike station. This is a proximity scope, not a city boundary. There are 73 matched stations, 45 outside scope and one unmatched in scope (廣慈/奉天宮). Unmatched flow is unknown, not zero. Count bin coordinates in the union of exit circles; do not distribute station traffic across exits. District filters use nearby YouBike area labels, not asserted station administrative assignments. Bus statistics use the existing retained bus universe, not all official bus rows.
- Official complaints: https://data.taipei/dataset/detail?id=cb423c17-88eb-4231-a725-f1b93247d1bf, July resource. All 45,763 rows have unique case IDs; 698 acceptance dates fall outside July. Use exact category labels, acceptance timestamps, and deduplicate by case ID (fail on duplicates rather than silently decide which row to retain). Street cleanliness has 785 source rows minus 18 outside-month and 18 excluded-day cases = 749. Garbage-truck service has 358 minus 2 and 36 = 320. No address or coordinate fields exist. Do not spatially join cases to stations or infer location from receiving agency/department.

At 300 m, 40 of 73 MRT stations have a positive bin-coordinate denominator and 33 have zero recorded coordinates. 台北車站 has 315,942 source-recorded daily entry/exit events and five recorded bin locations (63,188 events/day/location); 東門 has 53,170 and one; 行天宮 has 53,779 and two. These are inspection indicators, not capacity or persons served. 中山 (108,553 daily events), 忠孝新生 (72,573), 南港展覽館 (71,368), 龍山寺 (55,434) and 石牌 (55,117) lead the separate zero-coordinate list. Source completeness, substitute bins and real walking paths must be checked before attributing these to missing infrastructure.

In the 29-day scope, matched MRT origin records and citywide YouBike endpoint events both peak at 18–19. Street-cleanliness acceptance peaks at 09–10 (70/749 cases); garbage-truck-service acceptance peaks at 21–22 (35/320). Full July has 767/356 cases with the same category peaks (71/38). Weekday/weekend selectors recompute totals and peaks independently, using 22/7 daily denominators. All four plots use shares of their own totals and one common percentage scale. Different geography and units remain explicit. This suggests distinct observation windows, not proof of a causal delay, overflow, bin shortage or a specific cleaning schedule.

Validation covers raw-input custody, aggregate conservation, excluded dates, category denominators, day-type additivity, absent hourly data, unknown station matching, independent exit-to-bin distance/count calculations, and zero-denominator handling. New desktop/mobile interactions are verified with the local preview; public publication is outside this task.

Final verification for this extension: 143 site tests passed; runtime integrity verified 72 public assets and 876 unique HTML IDs. Desktop 1440 px and mobile 390 px confirmed station-to-map selection, distance changes, district/search/empty filters, historical hiding, and all/weekday/weekend charts. No browser console errors were observed. Full-source OD regeneration and portable source-package builds both completed successfully.

The main branch also retains a September MRT comparison and a later station/venue recheck. This July aligned-period analysis is a separate cohort, not an update of their ranking. The field list links their evidence: known station-interior facility clues must be checked for access and availability, rather than treating zero street rows as evidence of no station bins.

The July OD HTTP Content-MD5 (`VtCA+GFASJBW3VN7h+kO1A==`) does not match the retained body. The receipt records both header and computed values. SHA-256 binds the retained content, not official authenticity or completeness. The UI discloses this unresolved integrity discrepancy; calculations describe only those retained bytes.

A second retrieval on 2026-10-22 returned the same 305,954,434 bytes and SHA-256. This supports repeatability of the retained body but does not resolve the header MD5 mismatch.

# MRT station activity and recorded street facilities

Analysis date: 2026-10-22. This study tests recorded provision differences, not actual bin adequacy. The frozen protocol predates the computed comparison. The public article is generated from retained inputs and outputs by `render.py`.

## Scope and counts

- The official station catalog contains 75 Taipei City records representing 74 station names; Nangang Exhibition Center has two line records. The OD label `大橋頭站` maps explicitly to `大橋頭`; `臺` normalizes to `台`. All 74 Taipei names have both directions on all 30 September dates.
- Rank the 74 names by September OD entries plus exits and retain the first 10. This is the ranking within this OD file, not a verified count of unique people, outdoor pedestrians or garbage disposal demand.
- Sum origins and destinations once each. A journey produces two endpoints; same-station trips also contribute an entry and an exit. Paid-area transfers do not create a new recorded OD endpoint unless the source records one. This study does not infer exit-level pedestrian volume.
- Use all listed exits for each selected name. Taipei Main uses the source's M1–M8 only; connected rail, airport and underground-mall exits are not a complete catchment here.
- For each station, count each valid street CSV row once if within 300 m of any exit. Use 100/200/500 m checks with the same cohort. Catchments differ in shape and may overlap between stations; never sum station rows as a city inventory. Distances are straight-line, not walking distances. No adequacy standard is supplied.
- The street input contains 681 rows, 680 valid coordinates and one invalid longitude preserved in the input. Keep co-located source rows and also count distinct coordinates; for the selected stations their counts are identical at all four radii. This does not verify equipment identity or availability.
- The venue input contains 130 records. Match exact station names, with the explicit alias `101站/世貿捷運站` to `台北101/世貿`. Keep every original district and remark. No summing of identical or conflicting `處` values. No name match is not proof of absence.

## Quality and interpretation

The raw file has 8,240,400 unique date/hour/origin/destination records across 30 dates and 21 hour labels (00, 01 and 05–23). Hours 02–04 are absent, not filled with zeros. The source retains some New Taipei labels differently between origins and destinations. Missing directions remain blank in the station/day extract; all Taipei names used here have both directions. No cross-jurisdiction aliases are forced.

The OD total is 64,273,963 journeys. The separate official system table totals 64,319,630, a difference of 45,667 (0.0710% of the system total). The reason is unverified. Both values and all 30 daily differences are retained in `results/validation.json`. Do not rescale station counts. The top-10 boundary is specific to the OD file; its order is not certified against complete station totals.

The quantitative table supports a descriptive claim about **street records**. It cannot establish physical bin counts, available capacity, service fairness, shortage, why people leave litter, or new-bin locations. Venue notes indicate another inventory scope, not a correction factor for street rows. Qualitative personas remain unmatched to these station catchments.

The same official URL was downloaded twice (one repeat with a no-cache request). Both 302,444,881-byte bodies have identical SHA-256. The declared HTTP Content-MD5 does not match the body MD5. This unresolved source-header inconsistency is retained in `inputs/retrieval-validation.json`, not marked as a pass. The public article discloses this and restricts findings to the retained content. No data repair was attempted.

## Reproduce

Run from the standalone site root:

```sh
python3 research/mrt-bin-comparison-2026-10-22/aggregate_od.py /path/to/od-202609.csv
python3 research/mrt-bin-comparison-2026-10-22/analyze.py
python3 research/mrt-bin-comparison-2026-10-22/validate.py
python3 research/mrt-bin-comparison-2026-10-22/render.py
```

The official OD download URL and the locally retained original are in `inputs/od-receipt.json`. The 302 MB raw input is retained outside Git; the source includes the official URL/index, retrieval headers, fingerprints, and compact station/day counts for rerunning the comparison. `aggregate_od.py` reconstructs those counts from the raw file. Small original coordinate and catalog files are retained byte-for-byte, including their encodings. Street and venue snapshots reuse the already preserved source-recovery inputs and provenance.

`validate.py` independently recounts all selected station/radius combinations with the spherical cosine distance formula, checks the fixed selection, verifies all monthly entry/exit sums and retains the separate system-total mismatch. Generated tables and article are public consumers; raw snapshots and fieldwork records are not added to the public asset allowlist.

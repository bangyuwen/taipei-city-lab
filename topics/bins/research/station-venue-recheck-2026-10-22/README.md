# Zhongshan and Zhongxiao Xinsheng venue recheck

Checked on 2026-10-22. This bounded follow-up checks venue location, access conditions and duplicate relationships for two stations. It does not estimate usable bins, select new installations, or replace the frozen ten-station comparison.

## Findings and claim boundaries

- The freshly retrieved August 18 venue file has 130 parsed rows, identical to the retained prior file. Preserve rows 34, 54 and 68 (including header). The two Xinsheng rows differ only in district; matching attributes do not prove that the same physical facilities were counted. Physical overlap and usable-bin counts remain null in `results.json`.
- Metro's November 7, 2022 announcement identifies a service strip containing trash bins at the Tamsui-Xinyi Zhongshan station. Metro reiterated it on October 20, 2023. TDRI's December 12, 2025 project case identifies integrated facilities extending to either side of the information desk. None gives the venue file's ten individual locations, unique bin IDs, present status, or a mapping to the August venue record.
- Current Metro pages provide station addresses and information-desk locations. These are fieldwork starting points, not verified trash-bin locations. Zhongshan's venue district and station-address district differ; neither was silently corrected.
- Both official maps were visually inspected. The retained Zhongshan map is labeled G14R11-SW(26.05); Xinsheng is BL14O07-SW(24.01). Neither legend identifies trash bins. This is a map limitation, not evidence of absence. The diagrams do not resolve paid-area placement of unidentified bins.
- The official bilingual glossary includes the Metro label “禁止丟棄家庭垃圾”. It establishes official wording only, not its presence on each station's bins, accepted waste types, public access or opening hours.
- October 21 street data contains 661 records, 659 with valid coordinates. With the same August 4 exit coordinates, both stations remain at zero rows within 100/200/300 m. Zhongshan has one within 500 m; Xinsheng has zero. Record changes do not establish actual installation/removal dates. Only these two stations were recalculated.

## Evidence retained

`inputs/` retains original official CSV, HTML and PDF bytes because live resources change in place. `retrieval.json` and `additional-retrieval.json` record URLs, timestamps, lengths and SHA-256 values. `evidence.json` contains short supporting excerpts and limits. Full source snapshots are research inputs, excluded from the public runtime allowlist. The public article provides source links and bounded excerpts.

Searches included official Metro and Taipei government pages for each station plus trash-bin terms, current station pages/maps, Metro signage and TDRI's project case. No published per-bin list or station-specific access conditions were obtained for Xinsheng. This limited search does not establish that such records do not exist. No agency was contacted and no field observation was performed.

## Reproduce from retained inputs

From the Site source checkout:

```sh
python3 research/station-venue-recheck-2026-10-22/analyze.py
python3 research/mrt-bin-comparison-2026-10-22/render.py
python3 research/station-venue-recheck-2026-10-22/render.py
python3 scripts/prepare-public.py
node scripts/check.mjs
npm test
```

The analysis validates input digests, compares all parsed venue rows with the prior source, verifies the duplicate fields, and independently checks distances with the spherical law of cosines. `article.html` is the authored public narrative consumed by `render.py`. Computed tables come from `results.json`. Regeneration is idempotent. The earlier MRT renderer owns links from analysis, districts, and its own comparison article; this renderer owns the follow-up article.

Do not rerun retrieval over this historical evidence set. For a later source version, create a separately dated input set and receipt. Screenshots and QA output remain outside Git.

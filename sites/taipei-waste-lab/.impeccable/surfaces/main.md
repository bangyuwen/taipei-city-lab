# Taipei Waste Lab research workspace

Scope: `sites/taipei-waste-lab/` only. Refreshed 2026-10-24 from the current
research routes, the plan reading-flow revision and the dedicated Gantt page.
This is a Read surface for residents, reviewers and researchers using
Traditional Chinese on desktop and phones. Map and comparison controls are
Operate surfaces; country 3D supplements remain optional illustrations.

## Direction contract

THESIS: Readers understand the question, evidence, current proposal and unknowns
before opening methods or historical material.
OWN-WORLD: Preserve the implemented open-shelf research index: deep petrol
navigation, cool paper, pale blue selected states, quiet rules, tabular figures
and native controls. This refresh does not choose a new visual identity.
STORY: 研究總覽 is the brand destination. Four primary routes are 理解問題,
資料分析, 百日計畫 and 參考資料. Each detail belongs to one parent and has a
breadcrumb and local navigation. Dated drafts remain in the reference archive.
FIRST VIEWPORT: State the current question and evidence status, followed by
useful reading links. Do not turn planned fieldwork into completed results.
FORM: Continuous reading, aligned factual rows and meaningful disclosure labels;
keep sources and limitations beside the claim. Preserve the phone menu and
existing petrol/paper tokens rather than adding another visual system.

## Plan overview

`#plan` presents purpose/MVP scope, a short schedule summary, the four resource
requests, acceptance and responsibility, pending questions and next steps.
Its local index names those reading destinations. Resource requests remain fully
visible. Execution details follow in five native disclosures: configuration
methods, candidate fields, crew research, conditional checks and blank records.
Deep links open containing disclosures before focus and scroll.

## Dedicated Gantt page

`#plan-timeline` owns the generated inauguration-relative chart, delivery milestones,
work/owner/gate table and delay rules. The table is a native disclosure. The
chart uses available space up to 1140px; prose stays at 76ch. On phones, each
label/day range moves above its track so there is no page-wide horizontal scroll.
Day 0 is inauguration; preparation starts at day -45 and follow-up runs through
day 100. Bars are planned time windows, not progress or proof of execution.
Dates, agreements and actual participants are still unconfirmed.

All five plan pages share 計畫總覽 / 百日甘特圖 / 需求規格 / 協作與承接 / 團隊交接.
The Gantt page returns to the overview, resources and acceptance. Existing
`#plan-100day`, `#plan-100day-heading` and `#plan-schedule-details` anchors belong
to `#plan-timeline`; crew research and blank forms remain in `#plan`.

## Information ownership and evidence boundaries

`dist/index.html` owns page composition. The canonical decision-check generator
in `topics/bins/research/decision-checks-2026-10-22/build.py` owns the schedule
and conditional checks; `prepare-data` rebuilds site copies. Preserve source
facts, dates, unknowns, proposal labels and the retained offline research package.
The demo is a browser-local simulation, not formal dispatch or an accepted MVP.

Understanding the problem owns people and source-backed journeys. Analysis owns
activity/coverage comparisons, not waste-demand or outcome claims. The current
plan owns proposed next decisions and acceptance. References own historical
snapshots, country strategies, saved candidate maps, source records and dated
unexecuted drafts. Existing country media, credits, licenses, data and deep
links remain intact. No new raster assets or third-party dependencies are needed.

## Verification contract

Check the new route, existing schedule anchors, overview return links, active
parent/local navigation and browser history. Inspect desktop and phone together;
verify the phase table opens from its deep link. Rebuild the canonical research
copies and offline package, run the existing site tests and public allowlist
checks, and keep the original dirty checkout out of the release.

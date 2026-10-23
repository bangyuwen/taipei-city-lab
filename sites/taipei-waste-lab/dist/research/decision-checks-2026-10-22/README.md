# Hundred-day plan and conditional evidence checks

Current revision: 2026-10-23. The user selected existing bin locations as the
initial configuration and scoped the MVP to crew reporting, reviewed
configuration adjustment, and before/after follow-up. This is a planning change,
not a measured result, field deployment, or authorization to move physical bins.

## Current plan

1. Confirm participating crews, existing bins and collection arrangements.
   Retained inventories are source leads, not a complete verified live baseline.
2. Record fullness and exceptions before collection, with observation time,
   capacity and the last known collection time. Record collection completion
   separately. Missing observations and unknown intervals never become empty bins.
3. Review repeated, comparable observations before proposing a change. A low
   fullness observation is not surplus capacity: check interval, capacity,
   access, time-specific demand and original-area service. A receiving location
   needs separate evidence of a disposal problem; traffic activity alone is not
   sufficient. Retain no-change and further-check outcomes.
4. Confirm management approval, collection ownership, actual implementation,
   comparison windows and rollback before a small physical adjustment. Track
   both receiving and original service areas, including where the bin was removed.
5. Compare matched conditions and, where available, an unchanged reference.
   Preserve missingness and confounders. Report retain, revise, revert or
   insufficient evidence; do not equate sampled fullness with overflow duration.

Before launch, agree on the participating inventory, reporting opportunities,
minimum coverage, low-use/overflow rules, review windows, success/stop thresholds
and owners. No invented percentage, bin quota or promised staff saving is set.
Day 0 is the mayor's inauguration. Negative days are preparation before
inauguration; positive days are the first 100 days afterward. Day -45 is a
proposed preparation start, not a claimed actual start. The calendar date and
role assignments are not yet fixed in this plan.

| Days | Work and deliverable | Suggested owner (not yet assigned) |
| --- | --- | --- |
| -45 to -31 | Prepare existing-bin/service inventory and source gaps | Analyst and management contact |
| -30 to -16 | Activity/service overlay; candidate table v1 on day -16 | Analyst |
| -30 to -16 | Minimal prototype and simulated exercise; propose comparison/stop rules | Product and reviewer |
| -15 to -1 | With current management/crew agreement, trial reporting and targeted candidate checks; initial baseline or gaps | Crews, manager and analyst |
| 0 | Mayor takes office; timeline reference, not automatic operating permission | — |
| 1–15 | Confirm handoff, roles, inventory and comparability of pre-inauguration data | Manager and crews |
| 16–30 | Fill two-area baseline gaps and update candidates | Crews and follow-up owner |
| 16–30 | Pair donors/receivers and compare alternatives; proposal on day 30 | Planner and reviewer |
| 31–45 | Approve and execute eligible changes; actual record on day 45 | Manager and operator |
| 46–90 | Track both areas from each actual change under agreed windows | Crews and follow-up owner |
| 91–100 | Assess retain/revise/revert/insufficient evidence and hand off | Reviewer and manager |

Pre-inauguration operational records and crew participation require agreement;
without it, stay with simulation and source preparation. Reporting continues
through follow-up once actual trials start. Check the date, bin positions,
collection and observation conditions before reusing an earlier baseline.
Keep non-comparable periods separate and fill gaps before physical adjustments.
Late candidates or changes delay comparison; never shorten an agreed window to
meet day 100. Failed gates retain the current configuration.

The receiving-location table is defined in `#plan-candidates`: candidate ID and
version; road side/entrance and coordinate precision; activity source/date/unit
and coverage; existing services/access/time; crew reports or separate disposal
obstacles; reasons and counterevidence; feasibility/owner; donor pairing and
original-area impact; two-area baseline/reference/windows; unknowns, reviewer
and status. It starts with no invented candidate observations. Day -16 is a draft; day -1 is a reviewed list or an explicit gap record.
Update the list on day 30; deferred and rejected locations remain visible.
Retained July YouBike endpoints, MRT entries and bus locations remain distinct
proxies; do not sum them into unique pedestrians or correlate them as concurrent
with new crew reports. Source coverage gaps never imply no demand.

## Ownership and evidence

`checks.json` owns the current revision/status, initial-configuration and MVP
scope metadata, plus the retained Q01–Q04 source-specific checks. Those checks
are conditional supplements to the reporting loop, not the new primary workload.
Their original evidence and null outcomes remain unchanged; `inputs.json`
binds the retained source files. No agency contact, field findings, scheduled
visits or approved installation is implied.

`build.py` renders the conditional checks and current relative schedule.
`sites/taipei-waste-lab/dist/index.html` owns the current plan, PRD v0.7,
coordination and handoff narrative. PRD v0.5 remains retrievable at repository
commit `8cbc2b5e82d9977ba80392bc8f329d25c6ceabfa`; existing journey/basket forms
remain optional evidence tools, not crew-reporting or follow-up deliverables.

The existing demo remains a local simulation and has not passed v0.7 acceptance.
Full pedestrian navigation, prediction, automatic relocation, smart hardware,
citywide optimization and new-bin procurement are deferred from this MVP.

Historical district quotas, three waves, 234 visits and derived work estimates
remain unexecuted history. Original research records, candidate indices, source
dates and limitations remain intact. `#methods` and retained field links still
open the hundred-day plan.

Rebuild with root `npm run build`, or run this folder's `build.py` from a
standalone site. Run the decision-plan and affected site tests/checks.

Q05 (2026-10-23) adds worker phone-use, bin-route and staffing evidence before real app use. Its role hypothesis and research delivery are in `../crew-persona-2026-10-23/`; this builder renders them while retaining the existing day-0 inauguration timeline. No interviews or field outcomes are claimed.

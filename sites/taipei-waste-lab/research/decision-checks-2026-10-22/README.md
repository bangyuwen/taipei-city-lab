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
The proposed schedule uses relative days from an agreed launch, not today's date:

| Days | Work and deliverable | Suggested owner (not yet assigned) |
| --- | --- | --- |
| 1–7 | Confirm existing bins, service area, roles and source dates | Manager and crews |
| 8–15 | Exercise reporting/candidate/change/follow-up records; agree comparison and stop rules | Product and review roles |
| 16–40 | Collect unchanged-bin baseline; retain collection intervals and missingness | Crews and reviewer |
| 16–30 | Cross-reference activity and service overlays; deliver candidate table v1 on day 30 | Analyst |
| 31–40 | Confirm candidate road side, access, need and ownership; deliver reviewed v2 on day 40 | Analyst, crews and manager |
| 31–55 | Establish receiving-area and original-area service baseline and reference | Follow-up owner |
| 41–55 | Pair donors and receivers; compare no-change/frequency/capacity/location options | Planner and reviewer |
| 56–65 | Approve and execute eligible small changes; record actual configurations | Manager and operator |
| 66–90 | Observe both areas under the agreed post-change windows | Crews and follow-up owner |
| 91–100 | Assess retain/revise/revert/insufficient evidence and hand off | Reviewer and manager |

Reporting continues through follow-up; the day-40 milestone freezes the baseline
rather than stopping reports. Observation windows are measured from each actual
change. Late candidates or changes delay their comparison; never shorten an
agreed window to meet day 100. Failed gates retain the current configuration.

The receiving-location table is defined in `#plan-candidates`: candidate ID and
version; road side/entrance and coordinate precision; activity source/date/unit
and coverage; existing services/access/time; crew reports or separate disposal
obstacles; reasons and counterevidence; feasibility/owner; donor pairing and
original-area impact; two-area baseline/reference/windows; unknowns, reviewer
and status. It starts with no invented candidate observations. Day 30 is a draft,
day 40 a reviewed list which may still contain deferred or rejected locations.
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

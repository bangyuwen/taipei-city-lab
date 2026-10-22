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
The proposed windows are days 1–15 for readiness and prototype exercises,
16–40 for the unchanged baseline, 41–65 for reviewed small adjustments, and
66–100 for follow-up. Failed gates delay work; late changes do not shorten the
agreed observation window merely to finish within 100 days.

## Ownership and evidence

`checks.json` owns the current revision/status, initial-configuration and MVP
scope metadata, plus the retained Q01–Q04 source-specific checks. Those checks
are conditional supplements to the reporting loop, not the new primary workload.
Their original evidence and null outcomes remain unchanged; `inputs.json`
binds the retained source files. No agency contact, field findings, scheduled
visits or approved installation is implied.

`build.py` renders the conditional checks and current relative schedule.
`sites/taipei-waste-lab/dist/index.html` owns the current plan, PRD v0.6,
coordination and handoff narrative. PRD v0.5 remains retrievable at repository
commit `8cbc2b5e82d9977ba80392bc8f329d25c6ceabfa`; existing journey/basket forms
remain optional evidence tools, not crew-reporting or follow-up deliverables.

The existing demo remains a local simulation and has not passed v0.6 acceptance.
Full pedestrian navigation, prediction, automatic relocation, smart hardware,
citywide optimization and new-bin procurement are deferred from this MVP.

Historical district quotas, three waves, 234 visits and derived work estimates
remain unexecuted history. Original research records, candidate indices, source
dates and limitations remain intact. `#methods` and retained field links still
open the hundred-day plan.

Rebuild with root `npm run build`, or run this folder's `build.py` from a
standalone site. Run the decision-plan and affected site tests/checks.

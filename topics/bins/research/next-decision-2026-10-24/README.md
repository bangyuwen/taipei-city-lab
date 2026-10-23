# Next decision: completed desktop evidence bridge

Prepared 2026-10-24 (Asia/Taipei). The decision is which existing-service option
is worth comparing before any configuration change. This update completes a
bounded desktop synthesis, not a field visit or reconstruction of the four
commenters' missing journeys.

The four retained journey summaries are the source grain. E06 alone states a
final disposal outcome; the other three leave it unknown. None contains the
shared event-time, route and service-point keys required for a verified linkage.
The audited linkage coverage is 0/4 source cases, not an event failure rate.

Three named desk cases are explicitly analyst proposals: D11-2 for a post-meal
market setting, D03-1 for a metro/YouBike service comparison, and the existing
Q03/D04-3 for conditional department-store access. E02 remains geographically
unassigned. Each proposed case preserves separate street and venue records,
straight-line distances and null physical identity/walkability/current status.
No source comment is assigned to one of these cases as an observed event.

The two newly reviewed primary pages are attributed in `web-evidence.json`.
They establish market scope/hours and the function of bag dispensers; they do
not establish individual bins' present usability. The linked site notes contain
all decision-relevant findings. Web-tool excerpts are not represented as raw
HTTP archives, and the page's dog-bag totals are not used as an inventory.
Older station, street and venue inputs retain their own dates. `inputs.json`
binds the exact source bytes used by the desktop analysis.

`assessment.json` owns the authored comparison and conditional action rules;
`analyze.py` checks the frozen inputs and existing event-form fields, then builds
`results.json`. `render.py` owns only the analysis-pending block inside the
existing analysis panel. It preserves persona blanks, current Q01–Q05, the
absence of a visit schedule, and all existing public routes. Raw source data and
this package remain outside the public runtime allowlist.

From the repository root, run `python topics/bins/research/next-decision-2026-10-24/render.py`,
then `npm --prefix sites/taipei-waste-lab run prepare-data`. The normal build
also invokes the renderer and packages its sources for standalone reproduction.

What remains unavailable is explicit: actual event timestamps and routes,
manager acceptance/access rules, on-site usability, worker interviews and
before/after outcomes. Field collection, manager contact and physical changes
have not been performed. Existing event forms provide the join contract; no
synthetic records are added to them.

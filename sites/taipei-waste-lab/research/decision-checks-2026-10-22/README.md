# Decision-dependent checks in the hundred-day plan

Current planning owner from 2026-10-22. The user replaced district coverage quotas
with checks that can change a concrete decision, and requested integration into
the hundred-day plan. This revises planning, not historical observations.

The three named issues start with retained records and proposed manager questions.
Fieldwork is conditional on an unresolved distinction that changes an option.
The fourth check is conditional on a defined intervention comparison. These are
planning choices, not measured priorities. There is no new field evidence,
agency contact, approved installation, fixed sample size or district quota.

`checks.json` owns each purpose, existing evidence, desk-first action, field trigger,
and possible decisions. `inputs.json` binds retained source files. Outcomes stay
null. The relative 100-day windows in `build.py` are proposed, not booked dates.

The 2026-10-20 priority list, three waves, 234 visits and derived work estimates
are retained as superseded history. They must not become the current workload.
Original city activity candidates and source dates stay unchanged. The UI retains
legacy links; `#methods` and field links now open the hundred-day plan.

Rebuild: `python3 research/decision-checks-2026-10-22/build.py` from the standalone
site, or run root `npm run build`. Run the decision-plan and existing site tests.

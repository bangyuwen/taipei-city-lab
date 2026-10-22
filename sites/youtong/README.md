# 有桶體驗 /demo/

This directory owns the interactive prototype in the combined Taipei waste site.
It was imported from [evachen0927/youtong](https://github.com/evachen0927/youtong),
branch `beta`, commit `c42a8d3`. The integration now changes navigation, local
state isolation, report wording and the current research-plan reference.

## Entrances

| Published path | Purpose |
| --- | --- |
| `/` | Equal entrances to the demo and research |
| `/demo/` | Opens the pedestrian prototype |
| `/demo/pedestrian.html` | Saved bin locations, walking navigation and local report simulation |
| `/demo/planning.html` | Scenario comparison and historical research context |
| `/demo/crew.html` | Assigned-bin list, optional location map and local amount reports |
| `/research/` | Evidence, sources and the current decision plan |

Build and serve from `sites/taipei-waste-lab`, using Python 3.12 or newer:

```sh
python scripts/prepare-public.py
python scripts/prepare-portal.py
python -m http.server 4186 --bind 127.0.0.1 --directory public
```

The normal research `prepare-data` flow and `npm run check` also assemble this
publication. Only the explicit runtime allowlist in `prepare-portal.py` is
published. Source scripts, private research attachments, Firebase administration
tools and test fixtures stay out of `public/`.

## Demo data boundary

- `CONFIG.demo` is true and `firebaseConfig` is empty. Cloud startup and queue
  writes refuse demo mode, including test configuration overrides.
- All state uses the `有桶demo_v1_` prefix. Existing `有桶_`, `有桶beta_`,
  `有桶tcl_` and research keys are neither imported nor cleared.
- Reports, needs and simulated collection records stay in the same browser.
  Role tabs can share them through the existing local storage event flow.
  Devices and browser profiles do not synchronize.
- Reports do not notify an authority or create real dispatches. Confirmation
  copy and the persistent demo notice state that boundary.
- `?reset=1` clears only the demo prefix. It does not touch any remote database.
- Maps and optional route/navigation services still use the network. Local-only
  refers to demo reports and operational state, not to map-tile requests.

## Plan and research boundary

`/demo/current-plan.json` is generated from the same canonical
`topics/bins/research/decision-checks-2026-10-22/checks.json` used by the research
site; the standalone source package uses its retained research copy. The
publication records that source's SHA-256. No district quota or scheduled visits
are authorized. The former 12-point / 72-visit schedule is no longer displayed.
Old anchors and candidates remain historical context, never a current schedule.
The complete current plan is linked at `/research/#plan`.

A is the saved baseline. B1 changes information only. B2 is an additional
capacity/frequency simulation, not a research finding. C simulates relocating one
bin without increasing the count. Saving a scenario is a local demonstration,
not approval to relocate a bin. Traffic activity is not observed waste volume;
inventory rows are not verified usable facilities. Predicted fullness and crew
order remain simulations.

## Verification

The integrated Node tests cover publication boundaries, source identity, legacy
research links, demo storage isolation and reset behavior. The browser check is
`sites/taipei-waste-lab/scripts/check-portal-browser.cjs`; it exercises both
desktop and mobile, report/undo, a crew tab, research links and zero Firebase
requests. Set `PLAYWRIGHT_MODULE` and `CHROME_PATH` for your installed tooling.

The imported Python recordings and cloud/emulator scripts remain upstream
reference tools. They are not the acceptance suite for this local-only demo and
must not be used to enable or clear the former live database.

## Current MVP requirements (2026-10-23)

The hundred-day plan and PRD v0.7 start with existing bin locations. The MVP
requirements are pre-collection crew reports, reviewed configuration changes,
and follow-up of both receiving and original service areas. This repository's
current interactions remain a local demonstration; reporting fields, durable
handoff, approval/execution states and comparable outcome review have not been
accepted against v0.7. Full pedestrian navigation, prediction and automatic
relocation are deferred from current MVP acceptance. See
[the current plan](../taipei-waste-lab/dist/index.html#plan) and
[PRD v0.7](../taipei-waste-lab/dist/index.html#spec).

## Assigned-bin reporting entry

The crew page opens a list of every street-inventory bin in the existing
Gongguan–Daan demo bounds, in source inventory order. This is a demo assignment,
not a confirmed staff roster or collection route. Forecast fullness, traffic
activity, threshold settings and pedestrian reports never filter or reorder it.
The map is optional and opens the same bin report as the list.

Today means the Asia/Taipei calendar day. Only retained crew amount reports
count as reported; missing records, old route progress, pedestrian reports, and
legacy completion events without an amount do not imply an empty or reported bin.
Reload and same-browser tabs read the same local events. Undo recomputes status
from any earlier report that remains. The existing amount action still also
records simulated collection completion; separating those actions is a later
product decision. Forecast and navigation remain secondary simulation controls.

# Research reading architecture

Baseline: main `284577042b0cca9e315612bad4c51684faa5b312`, checked 2026-10-22.
Scope: the independent Taipei Waste Lab site. Preserve its petrol/paper design,
research evidence, public/private boundary, and existing hash links. Publish updates to the existing Site after validation.

## Problems to resolve

- The seven-item hotspot navigation mixes personal accounts, city comparisons,
  field preparation and source records without a clear reading task.
- The methods page puts city tables and two MRT studies before field priorities
  and blank observation forms. A reader preparing fieldwork must traverse unrelated detail.
- The home page repeats its purpose, reading path, deliverables and pending work.
- Current problem definition, older problem classifications and historical PRDs
  can appear equally current. Team and government responsibilities are separated.

## Target sitemap and ownership

| Primary entry | Pages and purpose | Previous location |
| --- | --- | --- |
| Research overview `#research` | Current evidence, limits, reading path and scope | Work overview; consolidate repeated status and next-step lists |
| Understand the problem `#personas` | Personas and journeys; current definition `#problem`; feedback analysis `#feedback`; evidence index `#evidence` | Hotspot research |
| Check distribution `#analysis` | City summary; district checks `#districts`; comparisons, methods and source limitations `#data-methods` | Hotspot research and the first seven chapters of Methods |
| Hundred-day plan `#plan` | The current proposal: goal, options, checks, schedule, requirements `#spec`, work packages `#work`, team handoff `#team` and optional forms | Former separate Ideas, field preparation and government plan pages |
| References and history `#library` | Sources `#sources`; countries `#countries`; history `#history`; saved map `#map`; inventory comparison `#comparison`; decisions `#definition`; older materials `#materials`; old proposals `#archive`, `#siting`, `#design` | Reference library and decision records |

Read: overview → personas → current problem → city comparison → district/detail
checks → decision-dependent hundred-day plan. Options and history remain available as separate
branches; this reading path does not imply that quantitative activity is matched
to personal accounts or that fieldwork has happened.

## Content rules

- The current definition belongs to `#problem`. Evidence pages own provenance
  and interpretation; earlier classifications stay explicitly historical.
個別留言與可重建個人內容已因隱私移除。
個別留言與可重建個人內容已因隱私移除。
- Move quantitative chapters byte-for-byte. Keep 9/30 ten-station and 10/21
  two-station snapshots distinct. Keep their source limitations adjacent.
- The current plan starts with existing bin locations, then crew reporting,
  reviewed configuration adjustment and before/after follow-up. Analysis remains
  a research input. Low fullness alone does not justify moving a bin. No district
  quota or automatic visits. Historical schedules remain closed by default.
- `topics/bins/research/decision-checks-2026-10-22` owns current plan metadata (revised 2026-10-23) and conditional checks. Preserve
  frozen source protocols and all unknown outcomes. `#methods` routes to `#plan`.
- Home links to page owners instead of repeating their detailed task lists.
- Retain old IDs and resolve moved chapter links to their new panel. Plain HTML
  remains readable without JavaScript. No new public research files/downloads.

## Verification

Run root build and affected site tests/checks. Verify that rebuilding does not
change the authored HTML. In one browser batch, check desktop and phone reading,
primary/local navigation, old deep links, keyboard/menu behavior and public
asset boundaries. Preserve screenshots and receipts outside version control.

## Current validation

Verify all retained IDs and quantitative chapters, current/legacy plan routing,
desktop and mobile navigation, no-JavaScript reading, generator stability and
the existing public asset allowlist. Historical fixed rounds are explicitly
superseded, not overwritten or represented as completed observations.

The proposal and hundred-day plan are one current document, not separate generations.
`#ideas` and all its chapter links resolve inside `#plan`. Specification versions
are revision records of that proposal. Four primary entries remain.

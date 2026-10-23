# Cleaning-worker persona and app suitability

Research date: 2026-10-23 (Asia/Taipei). Status: desk research and proposed work only. No worker interviews, agency contact, shadowing, usability tests or staffing commitments have occurred.

The user requested a cleaning-worker persona, evidence about phone use, routes and staffing, and inclusion of missing evidence in the current hundred-day plan. The decision is whether an app should serve frontline workers, supervisors, or neither until service conditions improve. Smartphone ownership, task competence, safe opportunity to use a device, and operational benefit are separate unknowns. Do not substitute age, national smartphone penetration, resident apps or a manager's ability for frontline evidence.

`persona.html` owns the public role hypothesis, official evidence and gaps. `plan.html` owns the proposed Q05 research delivery aligned to the current mayor-inauguration timeline (day 0), including pre-inauguration preparation and post-inauguration follow-up. The current `decision-checks-2026-10-22/build.py` renders both. The four comment-based journeys remain unchanged and are not a worker sample. Do not edit the historical 2026-10-17 deployment plan as if it were current.

## Official sources checked

| Source | What was checked | Boundary |
|---|---|---|
| [DEP organization](https://www.dep.gov.taipei/cp.aspx?n=DD34C671F97B74E5) | District teams' street and bin cleaning; direct team's bin repair and installation/removal responsibilities. | Institutional responsibility, not observed practice or allocation. |
| [Environmental cleaning duty rules](https://laws.gov.taipei/Law/LawSearch/LawArticleContent/FL015308) | Page shows amendment 2020-07-07; sections 4 and 6 describe supervisory preparation and protective gloves. | A phone interaction constraint to investigate, not proof that workers cannot use phones. Current local arrangements still need confirmation. |
| [Garbage-truck route dataset](https://data.taipei/dataset/detail?id=6bb3304b-4f46-4bb0-8cd1-60c66dcd1cae) | Metadata shows 2026-10-16 resource update, district, squad, vehicle, route, trip, arrival/departure time, location and coordinates. | Metadata only; not a downloaded/validated route map, bin collection route, street-sweeping area or GPS trace. |
| [Annual cleaning personnel dataset](https://data.gov.tw/dataset/156680) | Catalog fields include year, total, workers, collection, recycling and other categories. | CSV could not be read through this search tool; no current totals or staffing allocation claimed. Search snippets and localized catalog views differed in update metadata, so no freshness claim is made. |
| [2026 short-term recruitment](https://www.dep.gov.taipei/News_Content.aspx?n=CB6D5C560DE4D2DD&s=FDC07E2872A7FD42) | Announcement and linked attachment 1: planned 854 workers across 12 districts. PDF body explicitly says year 115 even though its metadata title is older. | Planned recruitment, not actual hires, permanent establishment or staff assigned to bins. |
| [Resident garbage-truck app announcement](https://www.gov.taipei/News_Content.aspx?n=F0DDAF49B89E9413&s=04E4B398C7814090&sms=72544237BBE4C5F6) | 2018 announcement describes arrival reminders for residents. | Not evidence of workers' phone proficiency or adoption. |

Search scope included Taipei official duties, cleaning-worker phone/app use, cleaning routes, and staffing datasets. No representative Taipei bin-worker phone-use survey or complete bin-route-to-shift roster was obtained in this bounded search. This is a research gap, not proof that the agency has no such records. No nationwide or other-city finding is presented as Taipei prevalence.

## Information to request before choosing an app workflow

Request dated, de-identified responsibility-area maps, bin route/order/frequency, stable route/bin identifiers, shift roles, established/attending/available staffing, vehicles, relief arrangements, dispatch authority, current reporting examples and phone policies. Separate road sweeping, bin emptying, driving, repairs and supervision. Do not infer staffing from total headcount divided by bins. Only request districts and shifts needed for a concrete decision.

Observe device access, task completion, safety constraints, reporting burden and willingness separately. Compare the same tasks with the current method and a simple prototype, balance order, count assistance and failures, and include supervisor time. Set acceptable time/error criteria and a time budget before results. Retain negative outcomes. There is no assumed representative sample, fixed district quota, universal numerical pass threshold or promised efficiency gain.

The existing Youtong crew demo describes simulated ordering and browser-local records. It is not a verified official route or evidence of worker adoption. This research does not change the demo, issue work orders or alter actual staffing.

## Rebuild and verification

Run `python3 topics/bins/research/decision-checks-2026-10-22/build.py` from the repository root, then synchronize the two changed research packages into the standalone site without deleting unrelated local work. Assemble the public output with the existing prepare-public and prepare-portal commands. Run the site tests and checks. `npm run prepare-data` also renders the content, but its whole research-copy replacement must not be used over unrelated local work.

Publication reconciliation: based on live Sites version 117, commit c82c3583c9e3cd1e0263e2ce23898ed3f62762af. Preserve its timeline, planning changes, demo and styles. Q05 preparation now precedes real app use; no scheduled work or result is implied.

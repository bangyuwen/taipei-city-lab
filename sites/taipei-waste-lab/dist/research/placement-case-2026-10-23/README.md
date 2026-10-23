# Zhongshan placement decision case

Prepared on 2026-10-23 from retained evidence checked on 2026-10-22. This case
applies the user's selected rule: cap total operating cost, compare adjustments
to existing bins first, and consider additions only for confirmed unmet demand.

The reader follows one unresolved service question around Zhongshan station's
information desk and exits 1 and 4. It is a proposed use scenario, not an observed
journey. No fieldwork, manager response, budget allocation, relocation candidate,
cost estimate, pilot result, or approved installation is introduced.

`page.html` owns the case narrative and its local presentation. `render.py`
validates `inputs.json`, fills quantitative fields from the retained two-station
results, generates `dist/cases/zhongshan.html`, and inserts one bounded link beside
the existing Zhongshan evidence. It works from the canonical topic package or its
generated standalone-site copy. It does not fetch current sources or modify
historical inputs. The page preserves dates and null/unknown meanings.

Rebuild from the site with `python3 scripts/prepare-placement-case.py`,
`python3 scripts/prepare-public.py`, then
`python3 scripts/prepare-portal.py`. The first command renders the case; the second stages
only allowlisted runtime files. The raw evidence, source manifest, and source
package remain private. The delivered route is `/research/cases/zhongshan.html`.

The new page inherits the existing petrol navigation, cool paper background,
system typography, quiet rules and native disclosures. It adds no shared visual
system changes. Verify desktop/mobile rendering, source links, disclosure
operation, generated values, idempotence and historical input digests.

The full `npm run prepare-data` build renders the case before creating the
private research ZIP. The ZIP contains `dist/cases/zhongshan.html`; its local
links name `index.html` explicitly so they also resolve after extraction.

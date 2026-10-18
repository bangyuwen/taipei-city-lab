# Country strategy evidence

The canonical authoring input lives in `topics/bins/research/country-strategies/`. The monorepo data build copies it to this standalone site at `research/country-strategies/`, where it is compiled into `dist/index.html`. In a standalone Sites checkout, edit this packaged input directly. The JSON files are not included in the public asset allowlist. Each of 14 country/region entries contains locally scoped cases, a four-step service or evaluation flow, qualitative comparison fields, explicit outcome limits, and dated primary references. There are 24 cases; the original 12 equipment supplements remain in `templates/country-media.html` with unchanged photo provenance.

## Regenerate and validate

1. In the monorepo, edit the matching regional JSON file in `topics/bins/research/country-strategies/` and run `npm run prepare-data` from the site first. In a standalone checkout, edit the matching local regional JSON file and retain the geographic scope, source year, observed/planned distinction, and limits.
2. Run `npm run prepare-countries` to regenerate the static country panel.
3. Run `npm test` and `npm run check`. The latter also regenerates this panel and stages only the fixed public runtime asset allowlist.

The machine checks enforce unique anchors, source references, required limitations, chart denominators and valid percentage bounds. They do not independently establish source accuracy. Source URLs and dates remain attached to each case and figure for human verification. References were checked for the 2026-10-18 integration; unavailable follow-up evaluations are stated as not found, never as proof of failure or continued operation.

## Reading and evidence rules

- Compare the service population and waste stream before equipment: pedestrian litter, household food waste, property collection and commercial shared collection are distinct services.
- A city case does not establish national policy. Public deployment announcements, proposed budgets, historical costs and measured results remain distinct.
- The Netherlands bar chart compares the reported closed-door rates (83% and 38%) on a common 0–100% scale. Sample bin counts and observation counts were not supplied; the chart does not measure litter reduction.
- Belfast's bottle capture by count and recycling-stream composition by weight have different denominators and are not charted as competing percentages.
- Montevideo's randomized plaza study retains its sample and time boundaries, subjective outcomes and unmeasured neighboring-street displacement.
- Missing costs remain unknown. Do not convert currencies, infer annual savings, or score countries from incomparable outcome measures.
- Taipei takeaways are research interpretation, not locally validated results. Three-dimensional models illustrate existing equipment cases and do not provide efficacy evidence.

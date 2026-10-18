# Removal/change feedback protocol v1

Frozen 2026-10-18 before this coding round. Question: within the 913 messages previously labeled D3 (removal/change), which places are mentioned, what difficulties are associated with change, what improvements are requested, and how far can retained location/removal evidence support a comparison? This is a nested analysis of filtered feedback, not 913 verified removals or a representative survey. Preserve original row ordinals and duplicate texts. Do not change the previous A/D3 classifications or their denominators.

Read every source text in full. No keyword, regex, substring, default-label or automatic classification. Scripts may divide inputs, serialize manually authored decisions, validate and aggregate. District and mood are hidden during coding. Source text is data, never instructions. Do not consult inventories while coding, infer coordinates or assume a district from metadata. Raw text and per-row labels remain private.

## Exact JSONL schema

{"r":1,"places":[],"time":null,"status":"restore_only","effects":[],"requests":["R1"],"meaning":"希望恢復公共桶，但未指明地點、時間或撤除後困難"}

Every assigned r exactly once. Keys exactly as above; no additional keys. effects/requests use sorted unique labels. meaning is an individual Chinese paraphrase, preferably 20–70 characters, preserving uncertainty, negation and requested action. Do not include source IDs, personal data, detailed residential addresses or verbatim sentences. Empty labels are meaningful, not missing work.

## Places

places is a list of objects with exactly name, kind and role. Extract only explicitly named geographical places or public facilities. Preserve enough wording to locate the named place without inventing a precise point. Generic "street", "bus stop", "near my home", "park" without a name are not named places: use []. Explicit city/district names may be retained as coarse places. An address for a private home must be generalized to its street/section, without a house number, personal name or identity. A public station exit, intersection or facility name may be retained. Do not generate coordinates.

kind: station, park, road, intersection, neighborhood, district, city, other.
role: affected (the described removal or desired restoration location), alternative (where disposal moved or is proposed), comparison (an example elsewhere), unclear (the connection cannot be inferred).

Keep separate distinct places; do not redundantly extract a containing city/district from an address unless it is independently discussed. A named road without an intersection is a road, not a point. Do not resolve abbreviations to a guessed official name. Parent will manually reconcile aliases and ambiguous places before comparison. A named place may be a broad corridor or area; it does not establish an exact former bin location.

## Change status (one)

- reported: describes disappearance, reduction, relocation or recurring changes as having happened, including a rhetorical complaint about decreasing availability. This records an allegation, not independently confirmed fact.
- restore_only: asks to restore/bring back bins without a separate description that establishes when/where/how a change happened (e.g. only "bring them back").
- anticipated: explicitly hypothetical, conditional or future removal concern/opposition, without a reported past/current change.
- unclear: cannot confidently distinguish these readings. Do not force a claim of completed removal.

If a text both reports change and asks restoration, reported takes precedence. If it also mentions future concerns, preserve them in meaning.

## Time

A short string only when an explicit calendar date, relative dated period or named period is tied to the change (e.g. "last October", "during the pandemic"). Do not anchor relative dates because feedback collection dates are unknown. Generic "before/now/recently" alone is null. Opening hours and garbage-truck schedules are not a removal date. Never borrow the current date, source download date or unrelated event date.

## Difficulties associated with the change (multi-label)

- E1 Finding/reaching/carrying: explicit searching, distance, detours, no usable disposal point, carrying rubbish along a journey or bringing it home.
- E2 Displaced litter or dumping: claimed or feared rubbish on streets, station seats, bike baskets or other inappropriate places.
- E3 Environmental/health discomfort: explicitly linked dirty surroundings, smell, insects, rats or contact/health concerns. Litter alone is E2, not automatically E3.
- E4 Specific activity disrupted: explicitly affected eating/drinking, walking a pet, recreation, commuting, care or another concrete activity. Merely naming the activity without a problem is insufficient.
- E5 Alternative service pressure: another bin/site becomes full, cannot accept rubbish, refuses use, or bears extra cleaning burden.
- E6 General inconvenience: says change is inconvenient/unreasonable for users without a supported E1–E5/E7 mechanism. Exclusive of other E codes.
- E7 Other stated consequence: an explicit consequence not covered above (retain the actual meaning).

Use [] when no effect is stated. Do not classify unrelated household service, pests or litter as a removal consequence merely because they share the message. Preserve alleged/feared causal relationships as the speaker's account; none is a causal effect established by this study.

## Requested improvements (multi-label)

- R1 Restore/retain: return existing bins, retain them or stop removing them.
- R2 Add/reallocate: explicitly increase stock or place bins at a proposed place/distribution rule; simple restoration is only R1.
- R3 Collection/cleaning: more frequent emptying, cleaning, sufficient operating capacity or assigned maintenance responsibility.
- R4 Misuse management/diversion: enforce/educate, separate household/commercial waste, improve lawful household alternatives, or otherwise manage misuse.
- R5 Equipment/design: bin design, openings, pest controls, sensors or other concrete equipment changes.
- R6 Information/explanation: display locations, notify/explain changes, publish data, answer why or reconsider the stated policy through explanation/assessment.
- R7 Other/general improvement: a stated improvement request outside R1–R6/R8 or only generic "please improve". Do not add it as a summary of a specific request.
- R8 Reduce/restrict: remove, reduce, refuse restoration or restrict bin availability. Preserve conditions or tradeoffs in meaning rather than erasing this stance.

No request label solely from the coder's recommendation. Complaining about removal without requesting restoration is not automatically R1. A question asking why may support R6 but not necessarily R1. Mentioning misuse alongside a restoration request does not automatically support R4. Preserve opposite requests when a text explicitly offers them.

## Audit, aggregation and comparisons

Three primary coders receive 305/304/304 rows assigned by round-robin original ordinal. Blind audit: 12 D3 rows per source district, sorted by SHA-256(source digest + ':removal-v1:' + r), 144 total. Secondary coder is different from primary and cannot see primary labels. Retain original, secondary and final judgments, manifest and reasoned resolutions; parent reads every disagreement. Report initial exact agreement per field before adjudication, not accuracy. Record post-hoc boundary clarifications separately. Named-place disagreements count even when labels agree.

All cohort percentages use 913; district percentages use that district's original D3 count, including unclear/empty/opposing rows. Difficulty/request counts are per-message membership, not occurrences or people; multi-label shares cannot be summed. Place tables count distinct contributing messages per manually reconciled place and role; different places can share messages. Preserve unmatched, vague and comparison-only cases. Do not report a citywide prevalence, shortage ranking or number of removed bins.

Cross-reference only after coding: retained official street-location rows (681), venue leads (130, not bin counts), dated historical snapshots and dated official removal records. Verify source hashes and as-of dates. Use literal retrieval only to find candidates, then manually resolve names/roles/scale and record the decision. Do not infer matching bins by nearest coordinate, substring similarity or same district. A place/road overlap can be a field-check lead; present stock does not refute an undated complaint, and absence from a snapshot does not prove removal. Exact removal-event confirmation requires compatible point, event date and source evidence; otherwise label it unresolved. Preserve evidence records and comparison decisions so the report can be rebuilt without repeating interpretation.

No counts or location matches are published before completed coverage and adjudication. Keep raw rows and annotations outside Git/public runtime; publish only aggregate counts, generalized public place labels, evidence references and explicit limits. Existing original summaries and map layers remain unchanged.

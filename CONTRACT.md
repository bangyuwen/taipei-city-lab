# Taipei City Lab implementation contract

Buildless ES modules; no remote runtime dependencies. All UI is Traditional Chinese (Taiwan).
Root owns index.html, app.js, styles.css, viz.js, registry.js, hosting/publish and integration tests.
Each delegated module exports an object with:
- id, number, title, subtitle, defaults (object)
- controls: [{key,label,type:'range'|'select', min,max,step,unit,options:[{value,label}]}]
- evaluate(params, data): returns {metrics:[{label,value,unit?,detail?}], map?:{points:[{id,x,y,label,kind?,value?,selected?}],lines?:[{points:[{x,y}],color?,label?}],caption?}, chart?:{labels:string[],series:[{label,color?,values:number[]}],unit?,caption?}, table?:{columns:[{key,label}],rows:object[]}, explanation:string, assumptions:string[], sources:string[]}
- evaluate must be deterministic, finite, handle extreme/empty inputs, and calculate all measures from the same scenario. Own meaningful tests in tests/<module>.test.mjs using node:test.
- Export named objects, no side effects/DOM use; every file <=500 LOC.
- number metrics are numbers, formatting handled by root. delta requires explicit comparison label if used.
- source IDs: trees, sidewalks, bins, complaints, metro, vd, bus, buildings, population, soil, fire, rat, puma. Source metadata will live in data/snapshot.json.
- Models must disclose synthetic inputs and actual source grain. Do not represent assumed interventions as causal predictions or invent raw observed demand, real structural danger, or real shade coverage.
- No network requests in browser. Real reviewed snapshot values only from data; synthetic scenarios deterministic. #3/#5/#6 can use clearly labeled synthetic records.

Data contract: snapshot has trees:[{id,x,y,height,diameter,species,district,surveyDate,updatedAt}], bins:[{id,x,y,address,district}], sources:object, meta:{retrievedAt,buildStatus,scope,bbox}. Optional missing tables: disclose and use intentionally synthetic scenarios, not fake observations.

Canonical module sources live in topics/<id>/model.js. The following dist paths are generated compatibility copies; rebuild with npm run build-models.

Module paths and exports:
dist/modules/shade.js -> shade (id shade, number 1)
dist/modules/bins.js -> bins (id bins, number 2)
dist/modules/rat.js -> rat (id rat, number 3)
dist/modules/traffic.js -> traffic (id traffic, number 4)
dist/modules/bus.js -> bus (id bus, number 5)
dist/modules/buildings.js -> buildings (id buildings, number 6)
dist/modules/audit.js -> audit (id audit, number 7), plus parseCSV(text) and inspectCSV(text, options)

#7 custom UI owned by root: local CSV upload/text, question & reference-date selection, profile audit report. Module evaluate can return official source suitability demo; inspectCSV handles uploaded datasets. All CSV processing remains local; no LLM integration implied.

## Topic site boundaries

Each of the seven topics owns its canonical data, model and research under topics/<id>/. Cross-topic source definitions and pure helpers live under shared/. Each sites/<site>/dist is a self-contained deployment with its own topic registration, browser storage key, data and export. Only the shade site carries tree observations; the waste site carries bin positions. The audit site may carry the cross-topic source catalogue, never other topics' observation arrays or user uploads. Root dist remains the shared rendering template and integrated compatibility output.

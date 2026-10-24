export function normalizeSearch(value='') {
  return String(value).normalize('NFKC').replace(/臺/g,'台').replace(/\s+/g,'').toLowerCase();
}
export function filterPoints(dataset, {district='',search=''}={}) {
  const q=normalizeSearch(search);
  return dataset.points.filter(p=>(!district||p.district===district)
    && (!q||normalizeSearch(p.district+p.address).includes(q)));
}
// A venue is a separate evidence unit, never another street-inventory row.
export function filterVenuePoints(catalog,{year='',showVenues=true,district='',search=''}={}) {
  return year==='2026-main'&&showVenues&&catalog.venueLeads
    ?filterPoints(catalog.venueLeads,{district,search}):[];
}
export function recordStats(points) {
  return {rows:points.length,mapRows:points.filter(p=>p.plottable).length,
    coordinates:new Set(points.filter(p=>p.x!==null&&p.y!==null).map(p=>`${p.x},${p.y}`)).size};
}
export function csvForPoints(points, dataset) {
  const safe=value=>{
    let s=String(value??'');
    if(/^[=+@-]/.test(s))s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  const headers=dataset?['資料版本','資料日期','完整性限制']:[];
  const context=dataset?[dataset.label,dataset.dateLabel,dataset.note]:[];
  return '\uFEFF'+[[...headers,'本站列號（非官方箱號）','行政區','地址','經度','緯度','座標初篩'],
    ...points.map(p=>[...context,p.id,p.district,p.address,p.rawX??p.x,p.rawY??p.y,p.quality])].map(r=>r.map(safe).join(',')).join('\r\n')+'\r\n';
}
export const historyPages=['map','comparison','history'];
export const allowedPages=[...historyPages,'siting','countries','design','definition','research','analysis','sources','materials','plan','plan-timeline','plan-resourcing','plan-readiness','plan-tools','feedback','districts','evidence','work','spec','archive','library','team','personas','problem','data-methods'];
export const workspacePages={"research":["research"],"personas":["personas","problem","feedback","evidence"],"analysis":["analysis","districts","data-methods"],"plan":["plan","plan-timeline","plan-resourcing","plan-readiness","plan-tools","spec","work","team"],"library":["library","history","map","comparison","countries","sources","materials","archive","siting","design","definition"]};
export function workspaceForPage(page){return Object.keys(workspacePages).find(key=>workspacePages[key].includes(page))||'research';}
export function pageFromHash(hash,currentPage='research') {
  const page=hash.replace(/^#/,'');
  if(["plan-preparation", "plan-after-inauguration", "panel-plan-preparation", "plan-preparation-chart", "plan-preparation-chart-heading", "plan-preparation-heading"].includes(page))return 'plan-timeline';
  if(["panel-plan-resourcing", "plan-resources", "plan-resourcing-heading"].includes(page))return 'plan-resourcing';
  if(["panel-plan-readiness", "plan-readiness-heading", "plan-departments", "plan-schedule-details", "plan-validation", "plan-work-heading"].includes(page))return 'plan-readiness';
  if(["definition-evidence-heading", "field-form-basket-handling", "field-form-basket-observations", "field-form-basket-survey", "field-form-cases", "field-form-journey", "field-form-rules", "field-forms", "field-priority", "ideas", "ideas-conclusion", "ideas-heading", "ideas-options", "methods", "methods-heading", "panel-plan-tools", "plan-candidates", "plan-candidates-heading", "plan-check-Q01", "plan-check-Q02", "plan-check-Q03", "plan-check-Q04", "plan-check-Q05", "plan-checks-heading", "plan-crew-research", "plan-crew-research-heading", "plan-execution", "plan-overlay", "plan-overlay-heading", "plan-tools-heading", "reader-field-forms"].includes(page))return 'plan-tools';
  if(page==='ideas')return 'plan-tools';
  if(page==='methods'||page==='methods-heading')return 'plan-tools';
  if(page==='main'&&allowedPages.includes(currentPage))return currentPage;
  if(allowedPages.includes(page))return page;
  if(/^(?:plan-timeline-heading|plan-100day(?:-heading)?|plan-schedule-details)$/.test(page))return 'plan-timeline';
  if(/^(?:reader-)?definition-prd-(?:roles|next)(?:-|$)/.test(page))return 'team';
  // Dated drafts live under references; current forms and requirements stay in the plan.
  if(/^plan-prior-field-plan$|^archive-build-draft$|^reader-field-priority$|^(?:reader-)?field-(?!forms$|form-|priority$)|^reader-work-|^(?:reader-)?government-|^reader-WP|^work-(?:WP|prior-contract)|^hotspot-(?:times|government|handoff)$/.test(page))return 'archive';
  if(/^(?:reader-)?definition-prd(?!-current|-roles|-next|-v0[12])|^(?:reader-)?definition-not-doing|^reader-research-overview-scope/.test(page)||['definition-scope-heading','research-overview-scope','research-overview-mvp','research-overview-unknowns'].includes(page))return 'archive';
  if(/^field-form|^reader-field-forms$|^field-priority$|^plan-purpose$/.test(page))return 'plan';

  if(/^(?:reader-)?field-|^reader-work-observation$/.test(page)||page==='hotspot-times')return 'plan';
  if(['plan-districts'].includes(page))return 'analysis';
  if(/^plan-(?:conclusion|details|pending|next|validation|resources|execution|schedule-summary|checks-heading|check-Q\d+|overlay(?:-heading)?|candidates(?:-heading)?|crew-research(?:-heading)?|support|prior-field-plan)$/.test(page))return 'plan';
  if(/^reader-district-|^citywide-area-|^plan-area-/.test(page))return 'districts';
  if(/^reader-method-|^method-|^hotspot-(?:heading|quality|sources|source-)|^citywide-(?:heading|districts)$/.test(page))return 'data-methods';
  if(page==='demand-evidence')return 'evidence';
  if(/^reader-(?:evidence|problem|definition-evidence|claim-check)|^definition-(?:focus-|research-basis|evidence-(?!heading)|workbook-P01-claims)/.test(page)||/^research-overview-evidence/.test(page))return 'evidence';
  if(/^reader-(?:work-|WP)|^work-|^hotspot-(?:times|government|handoff)$/.test(page))return 'work';
  if(/^reader-definition-prd|^reader-definition-not-doing|^reader-research-overview-scope|^definition-prd(?!-v0[12])/.test(page)||['definition-not-doing-heading','definition-scope-heading','research-overview-scope'].includes(page))return 'spec';
  if(/^reader-archive-|^plan-(?!heading$|work-heading$|departments$|districts$)/.test(page))return 'archive';
  if(/^reader-history-/.test(page))return 'definition';
  if(/^problem-(?:heading|known|contrast|unknown|boundary)$/.test(page))return 'problem';
  if(/^persona(?:s)?-/.test(page)||page==='journey-reading-note')return 'personas';
  if(page==='data-methods-heading')return 'data-methods';
  if(/^analysis-|^decision-(?:context-|choice-rules$|event-link$|source-dates$)/.test(page)||page==='hotspot-candidates')return 'analysis';
  if(/^ideas-|^definition-current-/.test(page)||['t1-process-heading','definition-evidence-heading'].includes(page))return 'plan';
  if(['t1-thinking-heading','definition-cycle-heading'].includes(page))return 'plan';
  if(['research-overview-mvp','research-overview-unknowns'].includes(page))return 'spec';
  if(/^reference-[LP]\d{2}$/.test(page)||/^source-/.test(page)||/^research-(?:literature|papers|paper-records|full-bibliography|practices|practice-records|operating-sources|audit)/.test(page))return 'sources';
  if(/^feedback-/.test(page))return 'feedback';
  if(/^plan-/.test(page))return 'plan';
  if(['budget-heading','implementation-heading'].includes(page))return 'materials';
  // Retained research links now open their dated material, not the current summary.
  if(/^(?:conclusion-|service-|dc-|district-service-)/.test(page)||['research-synthesis','current-evidence-heading','problem-map-heading','disposal-continuity'].includes(page))return 'materials';
  if(/^research-(?:materials|candidates|field|budget|paid|execution)/.test(page))return 'materials';
  if(/^definition-/.test(page)||['t1-process-heading','t1-problems-heading','t1-thinking-heading'].includes(page))return 'definition';
  if(/^t1-/.test(page))return 'design';
  if(/^country-/.test(page))return 'countries';
  return 'research';
}
export function escapeHTML(value) {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

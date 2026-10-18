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
export const allowedPages=[...historyPages,'siting','countries','design','definition','research','sources','materials','plan','feedback'];
export function pageFromHash(hash,currentPage='research') {
  const page=hash.replace(/^#/,'');
  if(page==='main'&&allowedPages.includes(currentPage))return currentPage;
  if(allowedPages.includes(page))return page;
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

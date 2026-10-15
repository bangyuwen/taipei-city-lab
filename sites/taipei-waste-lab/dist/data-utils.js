export function normalizeSearch(value='') {
  return String(value).normalize('NFKC').replace(/臺/g,'台').replace(/\s+/g,'').toLowerCase();
}
export function filterPoints(dataset, {district='',search=''}={}) {
  const q=normalizeSearch(search);
  return dataset.points.filter(p=>(!district||p.district===district)
    && (!q||normalizeSearch(p.district+p.address).includes(q)));
}
export function recordStats(points) {
  return {rows:points.length,mapRows:points.filter(p=>p.plottable).length,
    coordinates:new Set(points.filter(p=>p.x!==null&&p.y!==null).map(p=>`${p.x},${p.y}`)).size};
}
export function csvForPoints(points) {
  const safe=value=>{
    let s=String(value??'');
    if(/^[=+@-]/.test(s))s="'"+s;
    return '"'+s.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+[['本站列號（非官方箱號）','行政區','地址','經度','緯度','座標初篩'],
    ...points.map(p=>[p.id,p.district,p.address,p.x,p.y,p.quality])].map(r=>r.map(safe).join(',')).join('\r\n')+'\r\n';
}
export const allowedPages=['map','history','design','sources'];
export function pageFromHash(hash) {
  const page=hash.replace(/^#/,'');
  return allowedPages.includes(page)?page:'map';
}
export function escapeHTML(value) {
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

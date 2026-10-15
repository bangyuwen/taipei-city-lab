import {normalizeSearch} from './data-utils.js';

export const categories={
  not_reappeared:{label:'2024 地址未再出現',note:'完整行政區與地址在 2026 主檔未找到。這是待查清單，不能據此確認撤除；也可能是缺列、地址改寫或搬移。'},
  only_2026:{label:'只在 2026 出現的地址',note:'完整行政區與地址在 2024 封存版未找到。不能據此確認新設；也可能是補列、地址改寫或搬移。'},
  same_address_changed:{label:'同址座標不同，待核對',note:'兩版在這個地址都只有一筆，但座標欄位不同。可能是座標修正或其他變動，尚未確認遷移。'},
  ambiguous:{label:'同址多筆，未能配對',note:'地址在兩版都存在，但原始群組有多筆。先配對相同欄位後，其餘列保留為未配對，不強行認定彼此對應。'},
  same_fields:{label:'地址及座標欄位相同',note:'正規化後的行政區、完整地址及座標欄位相同。這只確認資料欄位一致，不能證明同一個實體箱；無效座標也會保留。'}
};

export function filterComparison(entries,{district='',category='not_reappeared',search=''}={}){
  const q=normalizeSearch(search);
  return entries.filter(e=>(!district||e.district===district)&&(!category||e.category===category)
    &&(!q||[e.address,...e.before.map(r=>r.address),...e.after.map(r=>r.address)].some(a=>normalizeSearch(e.district+a).includes(q))));
}
export function comparisonCounts(entries){
  return {groups:entries.length,beforeRows:entries.reduce((n,e)=>n+e.before.length,0),afterRows:entries.reduce((n,e)=>n+e.after.length,0)};
}
export function mapURL(record,version){
  const query=new URLSearchParams({year:version,district:record.district,q:record.address});
  return `?${query}#map`;
}
function csv(rows){
  const cell=value=>{
    let text=String(value??'');
    if(typeof value!=='number'&&/^[\s\uFEFF]*[=+@-]/u.test(text))text="'"+text;
    return '"'+text.replaceAll('"','""')+'"';
  };
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function comparisonCSV(entries,meta,distanceAnalysis=null){
  const rows=[['比對組號（非官方箱號）','分類','行政區','群組地址','版本','資料日期','來源檔案','來源 SHA256','原檔實體起始行（含標頭）','本站列號（非官方箱號）','原始地址','原始經度','原始緯度','座標初篩','配對規則版本','判讀限制']];
  const distances=new Map((distanceAnalysis?.pairs??[]).map(p=>[p.comparisonId,p]));
  if(distanceAnalysis)rows[0].push('兩版座標差距（公尺，非遷移距離）','全 75 對距離排序','距離品質備註','距離公式','球面半徑（公尺）','距離分析版本');
  for(const entry of entries)for(const side of ['before','after']){
    const source=meta[side];
    for(const record of entry[side]){
      const row=[entry.id,categories[entry.category].label,record.district,entry.address,source.key,source.date,source.file,source.sha256,record.sourceRow,record.id,record.address,record.rawX,record.rawY,record.quality,meta.protocolVersion,'資料列差異不代表撤除或新設；兩版全市現場完整性均未核實。座標差距不代表遷移。'];
      if(distanceAnalysis){const pair=distances.get(entry.id);row.push(pair?.distanceMeters??'',pair?.rank??'',pair?.qualityNote??'',pair?distanceAnalysis.meta.method.name:'',pair?distanceAnalysis.meta.method.radiusMeters:'',pair?distanceAnalysis.meta.analysisVersion:'')}
      rows.push(row);
    }
  }
  return csv(rows);
}
export function formatCoordinateDistance(meters){
  if(typeof meters!=='number'||!Number.isFinite(meters)||meters<0)return '無法計算';
  if(meters<0.1)return '<0.1 公尺';
  return new Intl.NumberFormat('zh-TW',{minimumFractionDigits:1,maximumFractionDigits:1}).format(meters)+' 公尺';
}
export function sortByCoordinateDistance(entries,pairs){
  const byID=new Map(pairs.map(p=>[p.comparisonId,p]));
  const distance=e=>byID.get(e.id)?.distanceMeters;
  const valid=n=>typeof n==='number'&&Number.isFinite(n)&&n>=0;
  return [...entries].sort((a,b)=>{
    const x=distance(a),y=distance(b);
    if(valid(x)!==valid(y))return valid(x)?-1:1;
    if(valid(x)&&x!==y)return y-x;
    return a.id<b.id?-1:a.id>b.id?1:0;
  });
}
export function districtCSV(districts,meta){
  return csv([['行政區','2024 資料列','2026 資料列','列數差額（非撤除數）','地址及座標欄位相同配對','同址座標不同配對','同址多筆未配對 2024 列','同址多筆未配對 2026 列','2024 地址未再出現列','2024 地址未再出現地址數','只在 2026 出現列','只在 2026 出現地址數','2024 日期','2026 日期','配對規則版本','限制'],
    ...districts.map(d=>[d.district,d.beforeRows,d.afterRows,d.deltaRows,d.exactPairs,d.sameAddressPairs,d.ambiguousBeforeRows,d.ambiguousAfterRows,d.notReappearedRows,d.notReappearedAddresses,d.only2026Rows,d.only2026Addresses,meta.before.date,meta.after.date,meta.protocolVersion,'未再出現不等於撤除；兩版全市現場完整性均未核實。'])]);
}

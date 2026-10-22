// 方案引擎：A 維持現況 / B 原位改善（模擬）/ C 同桶數挪一處。共用於規劃頁與行人頁。
const SC={};
SC.inArea=(la,lo)=>{const[[a,b],[c,d]]=CONFIG.demoArea.bounds;return la>=a&&la<=c&&lo>=b&&lo<=d};
// 最近桶距離：全臺北市步行路網距離（OSM，多源 Dijkstra）；點無法對應路網（離路 >150m）或路網未載入 → 直線並標示。回傳 [m, bin, 'walk'|'line']
SC.walk=null;SC.WALK_LIMIT_M=3000;
SC.nearestDist=(p,bins)=>{if(SC.walk){const r=RT.nearestWalk(SC.walk,p,bins);if(r)return[r[0],r[1],'walk']}
  let m=1e9,bi=null;for(const b of bins){const d=hav(p.la,p.lo,b.la,b.lo);if(d<m){m=d;bi=b}}return[m,bi,'line']};
SC.median=a=>{const s=[...a].sort((x,y)=>x-y),n=s.length;return n?(n%2?s[(n-1)/2]:(s[n/2-1]+s[n/2])/2):0};
// stations: [{t:'yb'|'bus',la,lo,act,routes,name}] in demo area; bins: [{id,la,lo}] street bins
SC.metrics=(stations,bins)=>{const ds=stations.map(s=>SC.nearestDist(s,bins)[0]);
  return{n:stations.length,over100:ds.filter(d=>d>100).length,over200:ds.filter(d=>d>200).length,median:SC.median(ds),ds,
    actServed100:stations.reduce((a,s,i)=>a+(ds[i]<=100?(s.act||0):0),0),routesServed100:stations.reduce((a,s,i)=>a+(ds[i]<=100?(s.routes||0):0),0)}};
// 查核優先序＝借還量 ×（步行距離 − 門檻）。距離一律為步行路網距離（無法對應路網時才用直線）
SC.lineNearest=(p,bins)=>{let m=1e9,bi=null;for(const b of bins){const d=hav(p.la,p.lo,b.la,b.lo);if(d<m){m=d;bi=b}}return[m,bi]};
SC.hotspots=(stations,bins,thr=CONFIG.hotspot.gapThresholdM)=>stations.filter(s=>s.t==='yb'&&s.act).map(s=>{const[d,b,k]=SC.nearestDist(s,bins);return{...s,nb:d,nbBin:b,nbKind:k,gap:s.act*Math.max(0,d-thr)}})
  .filter(h=>h.nb>thr).sort((a,b)=>b.gap-a.gap);
SC.walkNearest=(p,bins)=>{const r=SC.nearestDist(p,bins);return r[2]==='walk'?r[0]:null};
SC.demandAround=(b,stations)=>stations.reduce((a,s)=>a+(s.t==='yb'&&hav(b.la,b.lo,s.la,s.lo)<=CONFIG.scenarioC.demandRadiusM?(s.act||0):0),0);
SC.all=[]; // 全市站點（頁面載入後設定），檢查原位置附近新增缺口用
SC.newGaps=(donor,binsBefore,binsAfter)=>{const C=CONFIG.scenarioC;return SC.all.filter(s=>hav(s.la,s.lo,donor.la,donor.lo)<=C.checkRadiusM&&SC.nearestDist(s,binsBefore)[0]<=C.noNewGapM&&SC.nearestDist(s,binsAfter)[0]>C.noNewGapM)};
SC.pickDonor=(h,stations,bins)=>{const C=CONFIG.scenarioC;const pool=SC.all.length?SC.all:stations;
  const c=bins.filter(b=>hav(b.la,b.lo,h.la,h.lo)<=C.donorRadiusM&&hav(b.la,b.lo,h.la,h.lo)>C.noNewGapM).map(b=>({b,dem:SC.demandAround(b,pool)})).sort((x,y)=>x.dem-y.dem);
  let tried=0,best=null;
  for(const d of c){tried++;const after=SC.applyC(h,bins,d);const g=SC.newGaps(d.b,bins,after);if(!g.length)return{...d,newGaps:[],tried,cands:c.length};if(!best||g.length<best.newGaps.length)best={...d,newGaps:g}}
  return{infeasible:true,cands:c.length,best}};
SC.applyC=(h,bins,donor)=>bins.map(b=>b.id===(donor.b||donor).id?{...b,la:h.la+0.00008,lo:h.lo+0.00008,moved:true}:b);
// B：模擬滿溢 — 每桶每日產生量 ∝ 附近 YouBike 活動量；滿溢時數 = 每趟清運間隔 − 裝滿所需時數
SC.overflow=(bin,stations,capL,perDay,extra=0)=>{const P=CONFIG.scenarioB;const act=extra+stations.reduce((a,s)=>a+(s.t==='yb'&&hav(bin.la,bin.lo,s.la,s.lo)<=P.nearRadiusM?(s.act||0):0),0);
  const lpd=act/1000*P.litersPer1000Trips+5;const interval=24/perDay;const hFull=capL/(lpd/24);return{lpd,hFull,overflowH:Math.max(0,interval-hFull)*perDay}};
SC.evaluate=(h,stations,bins)=>{
  const A=SC.metrics(stations,bins);const P=CONFIG.scenarioB;
  const nb=[h.nbBin];const ex=hav(h.la,h.lo,h.nbBin.la,h.nbBin.lo)>P.nearRadiusM?h.act:0; // 熱點使用者走到最近桶
  const ovA=nb.map(b=>SC.overflow(b,stations,P.baseCapacityL,P.baseCollectionsPerDay,ex)),ovB=nb.map(b=>SC.overflow(b,stations,P.newCapacityL,P.newCollectionsPerDay,ex));
  const pk=SC.pickDonor(h,stations,bins);const donor=pk.infeasible?null:pk;let C=null,binsC=null,lost=[];
  if(donor){binsC=SC.applyC(h,bins,donor);C=SC.metrics(stations,binsC);lost=stations.filter((s,i)=>A.ds[i]<=100&&C.ds[i]>100)}
  const R=CONFIG.suggestion;const rec=h.nb<=R.bIfBinWithinM?'B1':(donor&&C&&A.over100-C.over100>=R.cMinReduction100?'C':'A');
  return{A,B:{...A,bins:nb,ovA,ovB},C,binsC,donor,pk,lost,rec}};
SC.load=()=>{try{return JSON.parse(localStorage.getItem(CONFIG.storageKeys.scenario))}catch(e){return null}};
SC.save=o=>localStorage.setItem(CONFIG.storageKeys.scenario,JSON.stringify(o));

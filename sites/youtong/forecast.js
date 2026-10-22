// ===== 有桶・清潔隊預測調度（邏輯層；UI 在 crew.html）=====
// 人流：由交通活動推估（YouBike 借還實際紀錄），不是實測人流。產生量用官方清運頻率校準但仍是假設；填充度為模擬。
const FC={};
FC.cfg=()=>CONFIG.forecast;
FC.hm=s=>{const[h,m]=s.split(':').map(Number);return h*60+m};
FC.fmt=min=>{const d=Math.floor(min/1440),m=((min%1440)+1440)%1440;return `${d>0?'隔天 ':''}${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`};
FC.state=()=>{try{return JSON.parse(localStorage.getItem(CONFIG.storageKeys.forecast))||{cal:{},clear:{}}}catch(e){return{cal:{},clear:{}}}};
FC.save=st=>localStorage.setItem(CONFIG.storageKeys.forecast,JSON.stringify(st));
// bins:[{id,la,lo}], hourly:footfall_hourly.json（只用 YouBike；公車不納入）
FC.prepare=(bins,hourly)=>{const C=FC.cfg(),S=Object.values(hourly.stations);
  return bins.map(b=>{const ys=S.filter(s=>hav(b.la,b.lo,s.la,s.lo)<=C.radiusM);
    const curve=k=>Array.from({length:24},(_,h)=>ys.length?ys.reduce((a,s)=>a+s[k][h],0)/ys.length:0);
    return{...b,nYb:ys.length,curve:{wk:curve('wk'),we:curve('we')},start:seedFill(b.id)/100*C.startFillMaxPct}})};
FC.lph=(b,k,h,st)=>{const C=FC.cfg(),cal=(st.cal[b.id]&&st.cal[b.id].k)||1;return b.curve[k][h]*C.litersPerRide*cal}; // 公升/小時
// 從「上次清運」累積到 t（分鐘，自當天 00:00 起；可 >1440 表示隔天，同一日型）
FC.fillAt=(b,k,t,st)=>{const C=FC.cfg(),s0=FC.hm(C.shiftStart),cl=st.clear[b.id]&&st.clear[b.id].k===k?st.clear[b.id]:null;
  const day=Math.floor(t/1440)*1440,rc=(C.routineClears||[C.shiftStart]).map(FC.hm).sort((x,y)=>x-y);
  const prev=[...rc.map(m=>day+m),...rc.map(m=>day-1440+m)].filter(m=>m<=t).sort((x,y)=>y-x)[0]; // 最近一次例行清運
  const useCl=cl&&cl.min<=t&&cl.min>=prev;let from=useCl?cl.min:prev,L=0; // 例行或手動清運都歸零（不再疊加模擬殘留量）
  for(let m=from;m<t;m+=15){const h=Math.floor((((m%1440)+1440)%1440)/60);L+=FC.lph(b,k,h,st)/4}
  return L/C.capacityL*100};
FC.fullAt=(b,k,t,st)=>{const C=FC.cfg();let f=FC.fillAt(b,k,t,st);if(f>=100)return t;let L=f/100*C.capacityL;
  for(let m=t;m<t+1440*2;m+=15){const h=Math.floor((m%1440)/60);L+=FC.lph(b,k,h,st)/4;if(L>=C.capacityL)return m+15}return Infinity};
// 收班前最後一輪：預計在收班後、隔天上班前滿
FC.lastRound=(full,t)=>{const C=FC.cfg(),day=Math.floor(t/1440)*1440,e=day+FC.hm(C.shiftEnd),n=day+1440+FC.hm(C.shiftStart);return full>e&&full<=n};
FC.evaluate=(P,k,t,st)=>P.map(b=>{const f=FC.fillAt(b,k,t,st),fa=FC.fullAt(b,k,t,st);return{b,fill:f,fullAt:fa,last:t<=FC.hm(FC.cfg().shiftEnd)&&FC.lastRound(fa,t),cal:!!st.cal[b.id]}}).sort((x,y)=>x.fullAt-y.fullAt||y.fill-x.fill);
FC.nnRoute=(start,items)=>{const left=[...items],out=[];let cur=start;while(left.length){let bi=0,bd=1e18;left.forEach((x,i)=>{const d=hav(cur[0],cur[1],x.b.la,x.b.lo);if(d<bd){bd=d;bi=i}});const x=left.splice(bi,1)[0];out.push(x);cur=[x.b.la,x.b.lo]}return out};
// 已清運＋回報滿度：重設為 0，並以 實際/預測 校正產生量（EMA）
FC.clearAndCalibrate=(b,k,t,reportedPct,st)=>{const C=FC.cfg(),pred=FC.fillAt(b,k,t,st);const old=(st.cal[b.id]&&st.cal[b.id].k)||1;let ratio=pred>1?reportedPct/pred:1;ratio=Math.min(5,Math.max(0.2,ratio));
  const k2=Math.min(5,Math.max(0.2,(1-C.emaAlpha)*old+C.emaAlpha*old*ratio));st.cal[b.id]={k:+k2.toFixed(3),n:((st.cal[b.id]&&st.cal[b.id].n)||0)+1};st.clear[b.id]={k,min:t};FC.save(st);return{pred,old,k:k2}};

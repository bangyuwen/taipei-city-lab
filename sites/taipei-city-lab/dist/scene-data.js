import {projection,worldPoint} from './geo.js';
export {projection,worldPoint} from './geo.js';
import {bboxOf,validFacilities,coverageBy} from './modules/spatial.js';
import {syntheticArrivals,shiftArrivals,simulateQueue} from './modules/traffic.js';
import {simulateShuttle} from './modules/bus.js';

export const SCENE_COLORS={existing:'#75bfa0',demand:'#849fba',candidate:'#a5b8ae',recommended:'#ffcc70',covered:'#55cfb1',newlyCovered:'#ffcc70',contextGround:'#e7e9e3',mapExisting:'#236749',mapRecommended:'#b67608',mapCandidate:'#737d79',mapSelection:'#ae432c'};
export function samplePoints(points,limit=3000){
  if(points.length<=limit)return points;
  const step=points.length/limit;
  return Array.from({length:limit},(_,i)=>points[Math.floor(i*step)]);
}
function spatialScene(id,result,data){
  const bbox=bboxOf(data),project=projection(bbox);
  const map=result.map.points,chosen=map.filter(p=>p.selected);
  const facilities=['shade','bins'].includes(id)?validFacilities(data[id==='shade'?'trees':'bins'],bbox):[];
  const shown=samplePoints(facilities);
  const demand=map.filter(p=>p.kind==='demand');
  const radius=id==='shade'?result.model.radius:id==='bins'?result.model.effectiveRadius:0;
  const newRadius=id==='shade'?result.model.newRadius:radius;
  const baseline=coverageBy(facilities,demand,radius);
  const added=newRadius>0?coverageBy(chosen,demand,newRadius):demand.map(()=>false);
  const candidates=map.filter(p=>p.kind==='candidate'||p.selected);
  const rows=result.table.rows;
  const marker=p=>({...p,...worldPoint(p,project),longitude:p.x,latitude:p.y,
    detail:rows.find(row=>row.id===p.id)?.reason||p.label||p.id});
  const points=candidates.map(marker);
  return {kind:'spatial',id,project,radius:radius*project.scale,newRadius:newRadius*project.scale,
    existing:shown.map(p=>marker({...p,label:p.species||p.address||p.id,kind:'existing'})),
    demand:demand.map((p,i)=>({...marker(p),baseline:baseline[i],planned:baseline[i]||added[i]})),points,
    focus:points.filter(p=>p.selected).concat(points.filter(p=>!p.selected)),
    labels:['西南模擬區','東南模擬區','西北模擬區','東北模擬區'],
    note:['shade','bins'].includes(id)
      ? `既有有效點位 ${facilities.length.toLocaleString('zh-TW')} 處；3D 顯示 ${shown.length.toLocaleString('zh-TW')} 處。模型仍使用全部點位。圓盤是距離假設，造型／高度為示意；道路底圖僅供定位，未用來計算步行路網或施工可行性。`
      : '全部位置、造型與指數為合成情境；柱高表示安排優先指數，不表示鼠患率、建物高度或安全程度。',
    extent:180};
}
function trafficScene(params){
  const original=syntheticArrivals(),capacity=Number(params.capacity)/60;
  const baseline=simulateQueue(original,capacity),scenario=simulateQueue(shiftArrivals(original,Number(params.shift)/100,Number(params.delay)),capacity);
  const duration=Math.max(baseline.queue.length,scenario.queue.length);
  return {kind:'traffic',baseline,scenario,duration,capacity,
    represented:Math.max(1,Math.ceil(Math.max(baseline.peakQueue,scenario.peakQueue)/160)),focus:[],extent:140,
    note:'雙佇列示意，非內湖路網。每個車形代表一批模型車流，尾端圖示可能是不滿一批；下方精確值與模型一致。空間隊長不是公尺。'};
}
function busScene(params){
  const scenario=simulateShuttle(params);
  return {kind:'bus',scenario,duration:120,extent:150,
    represented:Math.max(1,Math.ceil(scenario.peakQueue/80)),
    focus:scenario.schedule.map((trip,i)=>({id:String(i),label:`${clock(8*60+trip.minute)} · 第 ${trip.vehicle} 組 · 搭載 ${trip.boarded} 人`,...trip})),
    note:'站址、路線與車形是示意。往返 30 分鐘在動畫分成去回各 15 分鐘，沒有增加模型需求。每個人形代表一批留站者；精確人數另列。'};
}
function auditScene(data,report){
  const catalogOnly=data?.meta?.observationStatus==='catalog-only';
  const profiled=Array.isArray(report?.profiles)&&report.profiles.length>0;
  const all=profiled?report.profiles.map(p=>({id:p.name,label:p.name,value:100*p.missingRate,
    detail:`${p.name}：空白 ${p.missingCount}／${report.rowCount} 列（${(100*p.missingRate).toFixed(2)}%）；推定類型 ${p.type}`}))
    :Object.entries(data?.sources||{}).map(([id,s])=>({id,label:s.title,value:!catalogOnly&&s.integrationStatus==='loaded'?1:0,
      detail:`${s.title}：${s.integrationStatus==='loaded'?(catalogOnly?'原題已載入觀測；本站僅保存目錄':'已載入觀測快照'):'未載入觀測；僅來源資訊'}；${s.grain}`}));
  return {kind:'audit',profiled,columns:all.slice(0,20),focus:all.slice(0,20),extent:130,
    note:profiled?`顯示前 ${Math.min(all.length,20)}／${all.length} 欄的空白比例，完整欄位見健檢表。空值代碼由資料契約另行檢查，未合併到空白比例；沒有上傳 CSV。`
      :'資料目錄的載入狀態：等高卡片以顏色區分，未當作資料品質分數。執行 CSV 健檢後切換為欄位空白比例。'};
}
export function sceneSpec({id,result,data,params,report}){
  if(result.map)return spatialScene(id,result,data);
  if(id==='traffic')return trafficScene(params);
  if(id==='bus')return busScene(params);
  return auditScene(data,report);
}
export function clock(minutes){const rounded=Math.floor(minutes);return String(Math.floor(rounded/60)).padStart(2,'0')+':'+String(rounded%60).padStart(2,'0');}
export function trafficFrame(spec,elapsed){
  const t=Math.min(spec.duration,Math.max(0,Math.floor(elapsed))),index=t-1;
  const profile=p=>({queue:index<0?0:p.queue[index]||0,arrivals:index<0?0:p.arrivals[index]||0,served:index<0?0:p.served[index]||0});
  return {time:clock(360+t),elapsed:t,baseline:profile(spec.baseline),scenario:profile(spec.scenario)};
}
export function vehicleFrame(scenario,vehicle,elapsed){
  const t=Math.max(0,Math.min(120,elapsed));
  const trip=scenario.schedule.filter(p=>p.vehicle===vehicle&&p.minute<=t).at(-1);
  if(!trip)return {vehicle,state:'候班',progress:0,trip:null};
  const delta=t-trip.minute;
  if(delta<15)return {vehicle,state:'往園區',progress:delta/15,trip};
  if(delta<30)return {vehicle,state:'返回接駁站',progress:(delta-15)/15,trip};
  return {vehicle,state:t<trip.ready?'休息':'可發車',progress:0,trip};
}
export function busFrame(spec,elapsed){
  const t=Math.max(0,Math.min(120,Math.floor(elapsed))),p=spec.scenario;
  return {time:clock(480+t),elapsed:t,queue:t?p.queue[t-1]:0,
    boarded:p.served.slice(0,t).reduce((sum,n)=>sum+n,0),arrived:p.arrivals.slice(0,t).reduce((sum,n)=>sum+n,0),
    vehicles:Array.from({length:p.config.fleet},(_,i)=>vehicleFrame(p,i+1,t))};
}

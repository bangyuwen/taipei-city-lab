import {bins} from './modules/bins.js';
import {bboxOf,bounded,validFacilities} from './modules/spatial.js';

// These are reviewed source summaries, not additional observations in the model.
export const answerSources={
  policy:{title:'環保局：高人流配置與滾動調整',url:'https://www.dep.gov.taipei/News_Content.aspx?n=D6521D207DE817C2&s=4C05484B6C9CE4B4&sms=53780C1906F94AB4',updatedAt:'2026-09-03',checkedAt:'2026-10-14',status:'已查核官方說明'},
  siting:{title:'環保局：新設、拆除與遷移要件',url:'https://www.dep.gov.taipei/News_Content.aspx?n=ACEFA960B5A4ACD7&s=B90A10FBBF73521B',updatedAt:'2026-09-29',checkedAt:'2026-10-14',status:'已查核官方說明'},
  sidewalks:{title:'人行道範圍與淨寬圖資',url:'https://data.taipei/dataset/detail?id=715d3a83-8445-4496-b6bf-b0900538b7e7',updatedAt:'2026-01-14',checkedAt:'2026-10-14',status:'已查目錄，未載入幾何'},
  entrances:{title:'捷運車站出入口座標',url:'https://data.taipei/dataset/detail?id=cfa4778c-62c1-497b-b704-756231de348b',updatedAt:'2026-08-04',checkedAt:'2026-10-14',status:'已查目錄，未載入座標'},
  ridership:{title:'捷運各站進出量統計',url:'https://www.metro.taipei/cp.aspx?n=FF31501BEBDD0136',checkedAt:'2026-10-14',status:'已找到統計入口，未載入旅運量'},
};
const benchmarkCache=new WeakMap();
const value=(result,label)=>result.metrics.find(m=>m.label===label)?.value;
export function binSnapshotFacts(data){
  const points=validFacilities(data?.bins,bboxOf(data));
  const districts=new Map();for(const p of points){const name=p.district||'未標示行政區';districts.set(name,(districts.get(name)||0)+1);}
  return {count:points.length,districts:[...districts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'zh-TW')),
    bbox:bboxOf(data),retrievedAt:data?.meta?.retrievedAt||null};
}
export function binBenchmark(params=bins.defaults,data={}){
  const key=JSON.stringify(params),cache=benchmarkCache.get(data)||new Map();benchmarkCache.set(data,cache);
  if(cache.has(key))return cache.get(key);
  const current=bins.evaluate(params,data),limit=Math.floor(bounded(params.budget,0,100,bins.defaults.budget));
  const budgets=[...new Set([0,5,10,20,limit])].sort((a,b)=>a-b);
  const rows=budgets.map(budget=>{
    const r=budget===limit?current:bins.evaluate({...params,budget},data);
    return {budget,selected:value(r,'建議新增數量'),baseline:value(r,'已知垃圾桶基準服務率'),rate:value(r,'推薦方案需求服務率'),
      gain:value(r,'相對已知垃圾桶基準增加'),labor:value(r,'新增桶每日清運工時'),minimum:value(r,'最低模擬區服務率')};
  });
  if(cache.size>=16)cache.delete(cache.keys().next().value);cache.set(key,rows);return rows;
}
const findings={
  shade:{headline:'先找樹冠與熱暴露缺口，再排補樹順序。',conclusion:'樹木位置能支持現況盤點；真正的補樹優先名單還需要遮蔭、行人需求與可施工位置。目前不能把樹點半徑當成實際樹蔭。',basis:['模型使用示範範圍內全部有效樹點，比較同條件的既有與補樹情境。','公平權重反映研究取捨，尚未接入實際弱勢人口與熱暴露。'],gaps:['樹冠輪廓與不同時段的熱暴露。','實際步行需求、人口與可施工樹穴。']},
  bins:{headline:'先盤點高人流節點，再決定新增、移位或清運調整。',conclusion:'建議優先查核商圈、夜市、景點及交通場站的服務缺口，同時盤點既有公共與合作回收據點。現在的資料還不足以交付實際新增位置清單。',basis:['官方配置方向以高人流場域及既有資源整合為重點；住宅區違規棄置嚴重的點位採評估後滾動調整。','官方新設／遷移問答提到一般以寬度 1.5 公尺以上的人行道為限，並考量實際人潮與交通影響；仍需主管機關檢核，不能只看地圖空位。','目前真實清潔箱快照可支持既有位置盤點；144 個合成需求與候選點只能支援方法比較。'],gaps:['實測分時人流、隨身垃圾量及滿溢紀錄，確認需求而非用網格權重代替。','人行路網、可設置空間與土地／設施管理條件，形成實際候選名單。','每桶容量、清運頻率、路線與工時，公平比較新增、移位與增班。']},
  rat:{headline:'先查核源頭，再安排改善與複查。',conclusion:'治理順序應以鼠跡、食物與棲地的現勘證據為依據，並追蹤改善後是否覆查。本站的合成街廓不能當作台北鼠患熱點名單。',basis:['目前可比較同巡查工時下的查核排序與模擬個案流程。','通報數量可能受通報習慣影響，不能直接當作鼠患強度。'],gaps:['可定位且去重的通報與歷次現勘。','源頭改善紀錄、複查結果與未覆查比例。']},
  traffic:{headline:'錯峰是否有效，要看需求與瓶頸容量。',conclusion:'應以累積延誤、尖峰佇列及上下游影響比較錯峰方案。目前單瓶頸合成車流能說明機制，尚不能回答內湖實際會少塞多久。',basis:['基準與錯峰方案使用同一批合成車流，兩者都計算到佇列清空。','延後出發可能移轉排隊時段，必須一起看總延誤，不能只看最高排隊量。'],gaps:['歷史到達車流、旅行時間與瓶頸容量校準。','道路回堵、上下游影響及不同日期的可靠度。']},
  bus:{headline:'車數與班距，必須一起滿足需求和休息。',conclusion:'推薦班表應同時比較留站人數、全體等待及車輛／駕駛資源。本站可檢查假設班距的可行性，實際接駁配置仍需旅運與勤務資料。',basis:['同需求與休息條件下比較固定基準及目前班表。','已搭載旅客平均等待不涵蓋留站者，需一併看累積候車與剩餘需求。'],gaps:['逐站上下車與轉乘需求、實際旅行時間。','全日勤務、替班與營運約束；模型不是法規合規認證。']},
  buildings:{headline:'先補齊文件與專業查勘，不以屋齡判安全。',conclusion:'健檢名單應依資料缺口與專業評估需求安排優先順序。本站合成社區的準備指數不能判定某棟建築的耐震能力或倒塌機率。',basis:['模型比較同訪查工時下的文件補查與健檢準備排序。','現有全市彙總資料不足以支持真實逐棟安全評級。'],gaps:['逐棟位置、結構文件與現勘紀錄。','專業耐震評估與後續轉介／追蹤結果。']},
  audit:{headline:'先確認資料能回答問題，再判斷品質。',conclusion:'資料存在不代表足以支持結論。應先確認粒度、日期及必要欄位，再檢查缺漏、重複與契約；需要的觀測未載入時，就列明缺口。',basis:['來源目錄區分已載入觀測與只查過資料介紹的來源。','CSV 健檢在本機執行；規則檢查不能代替分析問題的適用性與因果驗證。'],gaps:['與目標問題對應的必要欄位、主鍵與新鮮度要求。','來源與轉換版本，以及不能由現有欄位推論的結論。']},
};
export function researchAnswer({id,result,data,params,report}){
  const f=findings[id];if(!f)throw new Error('未知研究題目');
  const answer={id,status:id==='audit'?'資料適用性查核':'研究方向可支持；實際方案待驗證',...f,
    modelLabel:'以下數值是目前參數下的模型結果，並非實際政策成效。',metrics:result.metrics,assumptions:result.assumptions,
    params:{...params},model:result.model,modelTable:result.table,explanation:result.explanation,snapshotMeta:data.meta,
    sources:result.sources.map(key=>({id:key,...data.sources?.[key]})),
    checkedAt:'2026-10-14'};
  if(id==='bins'){answer.snapshot=binSnapshotFacts(data);answer.benchmark=binBenchmark(params,data);answer.references=Object.values(answerSources);}
  if(id==='shade')answer.observedCount=validFacilities(data.trees,bboxOf(data)).length;
  if(id==='audit'&&report){
    const errors=report.findings.filter(f=>f.severity==='error').length;
    answer.csv={rows:report.rowCount,columns:report.columns.length,findings:report.findings,request:report.request};
    answer.headline=errors?'這份 CSV 有錯誤，先修正再進行分析。':'先核對這份 CSV 的粒度與品質，再支持結論。';
    answer.status=errors?'規則檢查發現錯誤':'未發現規則錯誤；問題適用性仍待判讀';
    answer.conclusion=`已檢查 ${report.rowCount} 列、${report.columns.length} 欄，發現 ${errors} 項錯誤與 ${report.findings.length-errors} 項提醒。這是資料品質檢查，不代表已回答「${report.request.question||'研究問題'}」。`;
    answer.basis=[`有 ${report.missingness.missingCells} 個空白儲存格、${report.duplicateCount} 筆完全相同的重複列；未擅自補值或刪除。`,'完整欄位、日期、座標與資料契約檢查結果列在下方；未上傳 CSV。'];
  }
  return answer;
}

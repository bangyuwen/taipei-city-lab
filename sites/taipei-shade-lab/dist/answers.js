import {bboxOf,validFacilities} from './modules/spatial.js';
const findings={
  shade:{headline:'先找樹冠與熱暴露缺口，再排補樹順序。',conclusion:'樹木位置能支持現況盤點；真正的補樹優先名單還需要遮蔭、行人需求與可施工位置。目前不能把樹點半徑當成實際樹蔭。',basis:['模型使用示範範圍內全部有效樹點，比較同條件的既有與補樹情境。','公平權重反映研究取捨，尚未接入實際弱勢人口與熱暴露。'],gaps:['樹冠輪廓與不同時段的熱暴露。','實際步行需求、人口與可施工樹穴。']}
};
export function researchAnswer({id,result,data,params,report}){
  const f=findings[id];if(!f)throw new Error('未知研究題目');
  const answer={id,status:id==='audit'?'資料適用性查核':'研究方向可支持；實際方案待驗證',...f,
    modelLabel:'以下數值是目前參數下的模型結果，並非實際政策成效。',metrics:result.metrics,assumptions:result.assumptions,
    params:{...params},model:result.model,modelTable:result.table,explanation:result.explanation,snapshotMeta:data.meta,
    sources:result.sources.map(key=>({id:key,...data.sources?.[key]})),
    checkedAt:'2026-10-14'};
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

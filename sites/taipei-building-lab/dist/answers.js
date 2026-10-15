const findings={
  buildings:{headline:'先補齊文件與專業查勘，不以屋齡判安全。',conclusion:'健檢名單應依資料缺口與專業評估需求安排優先順序。本站合成社區的準備指數不能判定某棟建築的耐震能力或倒塌機率。',basis:['模型比較同訪查工時下的文件補查與健檢準備排序。','現有全市彙總資料不足以支持真實逐棟安全評級。'],gaps:['逐棟位置、結構文件與現勘紀錄。','專業耐震評估與後續轉介／追蹤結果。']}
};
export function researchAnswer({id,result,data,params,report}){
  const f=findings[id];if(!f)throw new Error('未知研究題目');
  const answer={id,status:id==='audit'?'資料適用性查核':'研究方向可支持；實際方案待驗證',...f,
    modelLabel:'以下數值是目前參數下的模型結果，並非實際政策成效。',metrics:result.metrics,assumptions:result.assumptions,
    params:{...params},model:result.model,modelTable:result.table,explanation:result.explanation,snapshotMeta:data.meta,
    sources:result.sources.map(key=>({id:key,...data.sources?.[key]})),
    checkedAt:'2026-10-14'};
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

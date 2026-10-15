const findings={
  bus:{headline:'車數與班距，必須一起滿足需求和休息。',conclusion:'推薦班表應同時比較留站人數、全體等待及車輛／駕駛資源。本站可檢查假設班距的可行性，實際接駁配置仍需旅運與勤務資料。',basis:['同需求與休息條件下比較固定基準及目前班表。','已搭載旅客平均等待不涵蓋留站者，需一併看累積候車與剩餘需求。'],gaps:['逐站上下車與轉乘需求、實際旅行時間。','全日勤務、替班與營運約束；模型不是法規合規認證。']}
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

const findings={
  audit:{headline:'先確認資料能回答問題，再判斷品質。',conclusion:'資料存在不代表足以支持結論。應先確認粒度、日期及必要欄位，再檢查缺漏、重複與契約；需要的觀測未載入時，就列明缺口。',basis:['來源目錄區分已載入觀測與只查過資料介紹的來源。','CSV 健檢在本機執行；規則檢查不能代替分析問題的適用性與因果驗證。'],gaps:['與目標問題對應的必要欄位、主鍵與新鮮度要求。','來源與轉換版本，以及不能由現有欄位推論的結論。']}
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

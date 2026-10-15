export const workflowDefs = {
  rat: { prefix: 'R-', title: '巡查與複查追蹤（本機模擬）',
    stages: ['待巡查', '已巡查', '源頭改善', '待複查', '已結案'], followupIndex: 3, days: 7,
    closeNote: '複查已確認改善', disclaimer: '狀態由操作者在本機模擬，不是官方案件進度，也不會派工。' }
};
const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  && Number.isFinite(Date.parse(value + 'T00:00:00Z')) && new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) === value;
export function caseView(moduleId, value, asOf) {
  const def = workflowDefs[moduleId];
  if (!def) throw new Error('未知追蹤流程');
  const stage = Number.isInteger(value?.stage) && value.stage >= 0 && value.stage < def.stages.length ? value.stage : 0;
  const due = validDate(value?.due) ? value.due : '';
  return { stage, label: def.stages[stage], due, overdue: stage === def.followupIndex && due && validDate(asOf) ? asOf > due : false,
    history: Array.isArray(value?.history) ? value.history.filter(v => v && Number.isInteger(v.stage) && v.stage >= 1 && v.stage <= stage && validDate(v.date)).slice(-8).map(v => ({stage:v.stage,date:v.date,verified:v.verified===true})) : [] };
}
export function advanceCase(moduleId, value, date, verified = false) {
  const def = workflowDefs[moduleId];
  if (!validDate(date)) throw new Error('請提供有效的追蹤基準日期');
  const current = caseView(moduleId, value, date);
  if (current.stage === def.stages.length - 1) throw new Error('流程已完成');
  if (current.stage === def.followupIndex && !verified) throw new Error('先選擇已確認複查／追蹤結果，才能完成流程');
  const stage = current.stage + 1;
  const due = stage === def.followupIndex ? new Date(Date.parse(date + 'T00:00:00Z') + def.days * 86400000).toISOString().slice(0, 10) : current.due;
  return { stage, due, history: [...current.history, { stage, date, verified: stage === def.stages.length - 1 && verified }].slice(-8) };
}

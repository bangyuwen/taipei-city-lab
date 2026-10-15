const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const numeric = value => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value) && Number.isFinite(Number(value));
export function normalizeContract(input) {
  if (input === undefined || input === null || input === '') return null;
  if (typeof input === 'string') {
    if (input.length > 16384) throw new Error('資料契約上限 16 KB');
    try { input = JSON.parse(input); } catch { throw new Error('資料契約必須為有效 JSON'); }
  }
  if (!plain(input)) throw new Error('資料契約必須為 JSON 物件');
  if (Object.keys(input).some(key => !['required', 'key', 'ranges', 'nullValues'].includes(key))) throw new Error('資料契約含不支援的規則名稱');
  const fields = (value, name) => {
    if (value === undefined) return [];
    if (!Array.isArray(value) || value.length > 100 || value.some(v => typeof v !== 'string' || !v.trim())) throw new Error(name + ' 必須為欄名陣列（最多 100 欄）');
    return [...new Set(value.map(v => v.trim()))];
  };
  const required = fields(input.required, 'required'), key = fields(input.key, 'key');
  const ranges = input.ranges ?? {};
  if (!plain(ranges) || Object.keys(ranges).length > 100 || Object.entries(ranges).some(([name, v]) => !name.trim()
    || !Array.isArray(v) || v.length !== 2 || !v.every(Number.isFinite) || v[0] > v[1])) throw new Error('ranges 必須為欄名對應 [最小值, 最大值]');
  const nullValues = input.nullValues === undefined ? ['', 'NULL', 'NA', 'N/A'] : input.nullValues;
  if (!Array.isArray(nullValues) || nullValues.length > 100 || nullValues.some(v => typeof v !== 'string')) throw new Error('nullValues 必須為字串陣列（最多 100 個）');
  return { required, key, ranges: Object.fromEntries(Object.entries(ranges).map(([k, v]) => [k, [...v]])), nullValues: [...new Set(['', ...nullValues.map(v => v.trim())])] };
}
export function checkContract(columns, records, input) {
  const findings = [];
  let contract;
  try { contract = normalizeContract(input); } catch (error) {
    return { contract: null, valid: false, findings: [{ severity: 'error', code: 'CONTRACT_SYNTAX', message: error.message }], violationCount: 0 };
  }
  if (!contract) return { contract: null, valid: true, findings, violationCount: 0 };
  const missing = value => contract.nullValues.includes(value.trim());
  const all = [...new Set([...contract.required, ...contract.key, ...Object.keys(contract.ranges)])];
  let violationCount = 0;
  for (const name of all) if (!columns.includes(name)) {
    findings.push({ severity: 'error', code: 'CONTRACT_COLUMN', message: `契約指定欄位不存在：${name}` }); violationCount++;
  }
  for (const name of new Set([...contract.required, ...contract.key])) if (columns.includes(name)) {
    const count = records.filter(row => missing(row[name])).length;
    if (count) { findings.push({ severity: 'error', code: 'CONTRACT_NULL', message: `必要欄位 ${name} 有 ${count} 列缺值／空值代碼` }); violationCount += count; }
  }
  if (contract.key.length && contract.key.every(name => columns.includes(name))) {
    const keys = new Set(); let duplicates = 0;
    for (const row of records) {
      if (contract.key.some(name => missing(row[name]))) continue;
      const value = JSON.stringify(contract.key.map(name => row[name].trim()));
      if (keys.has(value)) duplicates++; else keys.add(value);
    }
    if (duplicates) { findings.push({ severity: 'error', code: 'CONTRACT_KEY', message: `組合主鍵 ${contract.key.join('＋')} 有 ${duplicates} 列重複（超出第一列）` }); violationCount += duplicates; }
  }
  for (const [name, [low, high]] of Object.entries(contract.ranges)) if (columns.includes(name)) {
    const count = records.filter(row => !missing(row[name]) && (!numeric(row[name].trim()) || Number(row[name]) < low || Number(row[name]) > high)).length;
    if (count) { findings.push({ severity: 'error', code: 'CONTRACT_RANGE', message: `${name} 有 ${count} 列非數值或超出 [${low}, ${high}]` }); violationCount += count; }
  }
  findings.push({ severity: 'info', code: 'CONTRACT_SCOPE', message: '資料契約只檢查指定規則；通過不代表資料完整、真實或足以回答問題。違規次數可能包含同一列的多項規則。' });
  return { contract, valid: !findings.some(f => f.severity === 'error'), findings, violationCount };
}

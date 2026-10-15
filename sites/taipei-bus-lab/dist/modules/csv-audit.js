import {checkContract} from '../contracts.js';
const LIMITS = { bytes: 2 * 1024 * 1024, rows: 10000, columns: 100 };
const issue = (code, message, extra = {}) => ({ code, message, ...extra });
const emptyParse = (errors = []) => ({ columns: [], records: [], rowCount: 0, errors, warnings: [] });
const blank = value => value.trim() === '';

// Strict comma-separated CSV with quoted newlines, escaped quotes, and UTF-8 BOM.
// Invalid-width rows are excluded; malformed quoting and headers invalidate all rows.
export function parseCSV(text) {
  if (typeof text !== 'string') return emptyParse([issue('INPUT_TYPE', '請提供 CSV 文字。')]);
  if (new TextEncoder().encode(text).byteLength > LIMITS.bytes)
    return emptyParse([issue('SIZE_LIMIT', 'CSV 超過 2 MB，請先縮小資料範圍。')]);
  text = text.replace(/^\uFEFF/, '');
  const rows = [], errors = [], warnings = [];
  let row = [], field = '', quoted = false, closed = false, line = 1, rowLine = 1;
  const finishField = () => { row.push(field); field = ''; closed = false; };
  const finishRow = () => {
    if (row.length || closed || !blank(field)) {
      finishField(); rows.push({ cells: row, line: rowLine });
    }
    row = []; field = ''; closed = false; rowLine = line + 1;
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index++; }
      else if (char === '"') { quoted = false; closed = true; }
      else { field += char; if (char === '\n' || (char === '\r' && text[index + 1] !== '\n')) line++; }
      continue;
    }
    if (char === ',') finishField();
    else if (char === '\n' || char === '\r') {
      finishRow(); if (char === '\r' && text[index + 1] === '\n') index++; line++;
      if (rows.length > LIMITS.rows + 1) return emptyParse([issue('ROW_LIMIT', 'CSV 超過 10,000 筆資料。')]);
    } else if (char === '"' && field === '' && !closed) quoted = true;
    else if (char === '"' || closed) {
      return emptyParse([issue('QUOTE_SYNTAX', '引號位置錯誤；引號欄位結束後應接逗號或換行。', { row: line })]);
    } else field += char;
  }
  if (quoted) return emptyParse([issue('UNCLOSED_QUOTE', '引號欄位尚未結束。', { row: rowLine })]);
  finishRow();
  if (!rows.length) return emptyParse([issue('EMPTY_FILE', 'CSV 沒有標題列或資料。')]);
  if (rows.length > LIMITS.rows + 1) return emptyParse([issue('ROW_LIMIT', 'CSV 超過 10,000 筆資料。')]);
  const columns = rows.shift().cells.map(value => value.trim());
  if (columns.length > LIMITS.columns) errors.push(issue('COLUMN_LIMIT', 'CSV 超過 100 個欄位。'));
  if (columns.some(name => !name)) errors.push(issue('EMPTY_HEADER', '標題列有空白欄位名稱。'));
  if (new Set(columns).size !== columns.length) errors.push(issue('DUPLICATE_HEADER', '標題列有重複欄位名稱。'));
  if (errors.length) return { ...emptyParse(errors), columns };
  const records = [];
  for (const entry of rows) {
    if (entry.cells.length !== columns.length) {
      errors.push(issue('ROW_WIDTH', `此列有 ${entry.cells.length} 欄，標題列有 ${columns.length} 欄；已排除。`, { row: entry.line }));
    } else records.push(Object.fromEntries(columns.map((name, index) => [name, entry.cells[index]])));
  }
  if (!records.length) warnings.push(issue('NO_RECORDS', '沒有可檢查的資料列。'));
  return { columns, records, rowCount: records.length, errors, warnings };
}

function parseDate(value, timezone = 'UTC') {
  const string = value.trim();
  const match = string.match(/^(\d{2,4})[-/.](\d{1,2})[-/.](\d{1,2})(.*)$/)
    || string.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (!match) return null;
  let year = Number(match[1]);
  const month = Number(match[2]), day = Number(match[3]), suffix = match[4] || '';
  if (year === 0) return null;
  if (match[1].length < 4) year += 1911;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  if (suffix && !/^[T ]\d{2}:\d{2}/.test(suffix)) return null;
  if (suffix) {
    const isoDate = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const timestamp = Date.parse(isoDate + suffix.replace(/^ /, 'T') + (/Z$|[+-]\d{2}:?\d{2}$/.test(suffix) ? '' : timezone === 'Asia/Taipei' ? '+08:00' : 'Z'));
    return Number.isFinite(timestamp) ? timestamp : null;
  }
  return date.getTime();
}

function inferType(values) {
  if (!values.length) return 'empty';
  if (values.every(value => /^(true|false)$/i.test(value))) return 'boolean';
  if (values.every(value => /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(value) && Number.isFinite(Number(value)))) return 'number';
  if (values.every(value => parseDate(value) !== null)) return 'date';
  return 'text';
}

function profile(columns, records) {
  return columns.map(name => {
    const values = records.map(record => record[name]).filter(value => !blank(value));
    return { name, type: inferType(values), missingCount: records.length - values.length,
      missingRate: records.length ? (records.length - values.length) / records.length : 0,
      uniqueCount: new Set(values).size, examples: [...new Set(values)].slice(0, 3) };
  });
}

function geoProfile(columns, records) {
  const latitudeColumns = columns.filter(name => /^(lat|latitude)$/i.test(name) || /緯度/.test(name));
  const longitudeColumns = columns.filter(name => /^(lon|lng|long|longitude)$/i.test(name) || /經度/.test(name));
  const addressColumns = columns.filter(name => /address|地址|路段/.test(name.toLowerCase()));
  const paired = latitudeColumns.length > 0 && longitudeColumns.length > 0;
  const coordinatePairCount = paired ? records.filter(record => {
    const lat = record[latitudeColumns[0]], lon = record[longitudeColumns[0]];
    return !blank(lat) && !blank(lon) && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon))
      && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
  }).length : 0;
  return { latitudeColumns, longitudeColumns, addressColumns,
    hasCoordinates: coordinatePairCount > 0, hasAddress: addressColumns.some(name => records.some(record => !blank(record[name]))),
    coordinatePairCount, invalidCoordinateRows: paired ? records.length - coordinatePairCount : 0 };
}

function calendarDay(value, timezone) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const fields = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return Date.UTC(Number(fields.year), Number(fields.month) - 1, Number(fields.day)) / 86400000;
}

function freshnessProfile(columns, records, options, findings) {
  const timezone = ['UTC', 'Asia/Taipei'].includes(options.timezone) ? options.timezone : 'UTC';
  if (options.timezone && options.timezone !== timezone) findings.push({ severity: 'error', code: 'TIMEZONE', message: '日期比較時區僅支援 UTC 與 Asia/Taipei。' });
  const maxAgeDays = Number.isFinite(Number(options.maxAgeDays)) ? Math.max(0, Number(options.maxAgeDays)) : 30;
  const referenceDate = options.referenceDate || '2026-10-13';
  const reference = parseDate(referenceDate);
  const candidates = columns.filter(name => /date|time|updated|日期|時間|調查日|更新日/i.test(name)
    || inferType(records.map(record => record[name]).filter(value => !blank(value))) === 'date');
  const ranked = [...candidates].sort((a, b) => Number(/updated|更新/i.test(b)) - Number(/updated|更新/i.test(a)));
  const dateColumn = options.dateColumn || ranked.find(name => records.some(record => parseDate(record[name]) !== null)) || null;
  if (dateColumn && !columns.includes(dateColumn)) findings.push({ severity: 'error', code: 'DATE_COLUMN', message: '指定日期欄位不存在。' });
  if (reference === null) findings.push({ severity: 'error', code: 'REFERENCE_DATE', message: '比較日期無效，請使用 YYYY-MM-DD。' });
  const values = dateColumn && columns.includes(dateColumn) ? records.map(record => parseDate(record[dateColumn], timezone)).filter(value => value !== null) : [];
  const newestValue = values.length ? Math.max(...values) : null, oldestValue = values.length ? Math.min(...values) : null;
  const ageDays = newestValue !== null && reference !== null ? calendarDay(reference, timezone) - calendarDay(newestValue, timezone) : null;
  const status = ageDays === null ? 'unknown' : ageDays < 0 ? 'future' : ageDays > maxAgeDays ? 'stale' : 'current';
  return { dateColumn, oldest: oldestValue === null ? null : new Date(oldestValue).toISOString(),
    newest: newestValue === null ? null : new Date(newestValue).toISOString(), ageDays, maxAgeDays, status,
    referenceDate, timezone, validDateCount: values.length, invalidDateCount: dateColumn ? records.length - values.length : 0 };
}

function grainProfile(profiles, records) {
  const candidateKeys = profiles.filter(item => records.length > 1 && item.missingCount === 0 && item.uniqueCount === records.length).map(item => item.name);
  const groups = profiles.filter(item => /年度|行政區|區別|月份|year|district|month/i.test(item.name)).map(item => item.name);
  return { candidateKeys, description: groups.length
    ? `每列含 ${groups.join('、')} 分組欄位；實際觀測單位仍須由資料字典確認。`
    : '以 CSV 每列為檢查單位；欄名或唯一值不能證明它是事件、路段或個別建築。' };
}

function suitabilityFor(question, report) {
  if (!report.valid || !report.rowCount) return { status: 'unsuitable', reason: '先修正格式錯誤並提供有效資料列。' };
  if (!question.trim()) return { status: 'undetermined', reason: '請輸入要回答的問題，才能檢查所需欄位。' };
  const spatial = /熱點|地圖|哪裡|位置|地點|配置|逐棟|每棟|種樹|植樹|空間/.test(question);
  if (spatial && !report.geo.hasCoordinates && !report.geo.hasAddress)
    return { status: 'unsuitable', reason: '此問題需要位置資料；CSV 未找到有效經緯度或地址。' };
  if (/結構|危樓|倒塌|耐震|哪棟.*危險|逐棟.*安全|每棟.*安全/.test(question))
    return { status: 'partial', reason: '需工程查勘、結構與評估紀錄；CSV 品質檢查無法證實建築安全。' };
  if (/省下|造成|導致|效果|因果|減少|改善|預測|遮蔭|樹蔭/.test(question))
    return { status: 'partial', reason: '可檢查現有欄位；成效、預測或遮蔭仍需模型、驗證資料與明確假設。' };
  if (spatial && !report.geo.hasCoordinates)
    return { status: 'partial', reason: '有地址欄位，但須先地理編碼並檢查定位品質才能做空間分析。' };
  if (report.missingness.rate > 0.3 || report.duplicateCount || report.freshness.status === 'stale' || report.freshness.status === 'future')
    return { status: 'partial', reason: '先處理缺值、重複列或日期問題，再確認資料字典與問題所需欄位。' };
  return { status: 'undetermined', reason: '未發現基本格式障礙；仍需確認觀測單位、必要欄位與涵蓋範圍，不能僅靠欄名判定適用。' };
}

// Deterministic local rule-based profiling; no LLM, geocoding, or network calls.
export function inspectCSV(text, options = {}) {
  options = options && typeof options === 'object' ? options : {};
  const parsed = parseCSV(text), findings = [];
  const profiles = profile(parsed.columns, parsed.records);
  const missingCells = profiles.reduce((sum, item) => sum + item.missingCount, 0);
  const totalCells = parsed.columns.length * parsed.rowCount;
  const uniqueRows = new Set(parsed.records.map(record => JSON.stringify(parsed.columns.map(name => record[name]))));
  const report = { valid: parsed.errors.length === 0, columns: parsed.columns, rowCount: parsed.rowCount, profiles,
    missingness: { missingCells, totalCells, rate: totalCells ? missingCells / totalCells : 0 },
    duplicateCount: parsed.rowCount - uniqueRows.size, grain: grainProfile(profiles, parsed.records),
    geo: geoProfile(parsed.columns, parsed.records), freshness: freshnessProfile(parsed.columns, parsed.records, options, findings),
    findings, errors: parsed.errors, warnings: parsed.warnings };
  report.request = { question: String(options.question || ''), referenceDate: report.freshness.referenceDate, timezone: report.freshness.timezone, dateColumn: report.freshness.dateColumn, maxAgeDays: report.freshness.maxAgeDays };
  const contractCheck = checkContract(parsed.columns, parsed.records, options.contract);
  report.contract = { valid: contractCheck.valid, violationCount: contractCheck.violationCount };
  report.request.contract = contractCheck.contract;
  findings.push(...contractCheck.findings);
  report.valid = report.valid && !findings.some(item => item.severity === 'error');
  for (const entry of parsed.errors) findings.push({ ...entry, severity: 'error' });
  for (const entry of parsed.warnings) findings.push({ ...entry, severity: 'warning' });
  if (missingCells) findings.push({ severity: 'warning', code: 'MISSING_VALUES', message: `共有 ${missingCells} 個空白儲存格，空白不等於零。` });
  if (report.duplicateCount) findings.push({ severity: 'warning', code: 'DUPLICATES', message: `有 ${report.duplicateCount} 筆完全相同的重複列；是否刪除須依觀測單位判斷。` });
  if (report.geo.invalidCoordinateRows) findings.push({ severity: 'warning', code: 'INVALID_COORDINATES', message: `${report.geo.invalidCoordinateRows} 列缺少有效經緯度；未自動交換欄位或推測座標系統。` });
  if (report.freshness.status === 'stale') findings.push({ severity: 'warning', code: 'STALE_DATE', message: `日期欄最新值距比較日期 ${report.freshness.ageDays} 天，超過 ${report.freshness.maxAgeDays} 天門檻。` });
  if (report.freshness.status === 'future') findings.push({ severity: 'warning', code: 'FUTURE_DATE', message: '日期欄含晚於比較日期的值；請確認時區、格式或是否為預定日期。' });
  if (report.freshness.invalidDateCount) findings.push({ severity: 'warning', code: 'INVALID_DATES', message: `${report.freshness.invalidDateCount} 列日期空白或格式無法辨識。` });
  if (report.freshness.status === 'unknown') findings.push({ severity: 'info', code: 'FRESHNESS_UNKNOWN', message: '無法從有效日期欄確認日期範圍；最新日期也不一定是資料更新日期。' });
  findings.push({ severity: 'info', code: 'GRAIN_REVIEW', message: report.grain.description });
  report.suitability = suitabilityFor(String(options.question || ''), report);
  return report;
}

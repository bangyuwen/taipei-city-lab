const START_HOUR = 6;
const INPUT_MINUTES = 240;

function bounded(value, fallback, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
}

function params(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  return {
    shift: bounded(input.shift, 30, 0, 80),
    delay: Math.round(bounded(input.delay, 45, 0, 120)),
    capacity: bounded(input.capacity, 1500, 300, 3000),
  };
}

export function syntheticArrivals() {
  return Array.from({ length: INPUT_MINUTES }, (_, minute) => Math.round(
    10 + 28 * Math.exp(-(((minute - 100) / 30) ** 2))
      + 22 * Math.exp(-(((minute - 165) / 28) ** 2)),
  ));
}

export function shiftArrivals(arrivals, fraction, delay) {
  const share = bounded(fraction, 0, 0, 1);
  const minutes = Math.round(bounded(delay, 0, 0, 120));
  const shifted = Array(arrivals.length + minutes).fill(0);
  if (!minutes) return arrivals.map((value) => Math.max(0, Number.isFinite(value) ? value : 0));
  arrivals.forEach((value, minute) => {
    const count = Math.max(0, Number.isFinite(value) ? value : 0);
    shifted[minute] += count * (1 - share);
    shifted[minute + minutes] += count * share;
  });
  return shifted;
}

// Discrete fluid queue: arrivals join at minute start; departures occur within
// that minute. End-of-minute queue area measures complete minutes of waiting.
export function simulateQueue(input, capacityPerMinute) {
  const capacity = bounded(capacityPerMinute, 1, 0.1, 100000);
  const arrivals = input.map((value) => Math.max(0, Number.isFinite(value) ? value : 0));
  const result = { arrivals: [], served: [], queue: [], total: 0, waitingArea: 0 };
  let waiting = 0;
  let minute = 0;
  while (minute < arrivals.length || waiting > 1e-9) {
    const incoming = arrivals[minute] || 0;
    waiting += incoming;
    const served = Math.min(waiting, capacity);
    waiting = Math.max(0, waiting - served);
    result.arrivals.push(incoming);
    result.served.push(served);
    result.queue.push(waiting);
    result.total += incoming;
    result.waitingArea += waiting;
    minute += 1;
  }
  result.peakQueue = result.queue.reduce((max, value) => Math.max(max, value), 0);
  result.meanWait = result.total ? result.waitingArea / result.total : 0;
  return result;
}

function clock(minute) {
  const time = START_HOUR * 60 + minute;
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
}

function hourly(profile, hours) {
  return Array.from({ length: hours }, (_, hour) => {
    const start = hour * 60;
    const sum = (key) => profile[key].slice(start, start + 60).reduce((a, b) => a + b, 0);
    return {
      arrivals: sum('arrivals'),
      served: sum('served'),
      peak: profile.queue.slice(start, start + 60).reduce((a, b) => Math.max(a, b), 0),
      end: profile.queue[Math.min(start + 59, profile.queue.length - 1)] || 0,
    };
  });
}

export const traffic = {
  id: 'traffic', number: 4,
  title: '內湖錯峰通勤',
  subtitle: '在固定瓶頸，重算錯峰後每分鐘的排隊與通過量',
  defaults: { shift: 30, delay: 45, capacity: 1500 },
  controls: [
    { key: 'shift', label: '延後出發比例', type: 'range', min: 0, max: 80, step: 5, unit: '%' },
    { key: 'delay', label: '延後時間', type: 'range', min: 0, max: 120, step: 5, unit: '分鐘' },
    { key: 'capacity', label: '瓶頸通過上限', type: 'range', min: 300, max: 3000, step: 100, unit: '輛／小時' },
  ],
  evaluate(input = {}, data = {}) {
    const settings = params(input);
    const original = syntheticArrivals();
    const baseline = simulateQueue(original, settings.capacity / 60);
    const shifted = shiftArrivals(original, settings.shift / 100, settings.delay);
    const scenario = simulateQueue(shifted, settings.capacity / 60);
    const hours = Math.ceil(Math.max(baseline.queue.length, scenario.queue.length) / 60);
    const current = hourly(scenario, hours);
    const comparison = hourly(baseline, hours);
    const labels = Array.from({ length: hours }, (_, hour) => `${clock(hour * 60)}–${clock((hour + 1) * 60)}`);
    const difference = scenario.meanWait - baseline.meanWait;
    return {
      metrics: [
        { label: '合成到達總量', value: scenario.total, unit: '輛', detail: '兩個方案的總到達量相同' },
        { label: '情境尖峰排隊', value: scenario.peakQueue, unit: '輛', detail: `未錯峰基準 ${baseline.peakQueue.toFixed(1)} 輛` },
        { label: '情境平均等待', value: scenario.meanWait, unit: '分鐘', detail: `未錯峰基準 ${baseline.meanWait.toFixed(2)} 分鐘` },
        { label: '等待變化（相對未錯峰）', value: difference, unit: '分鐘', detail: '負值代表情境中的平均等待較短' },
        { label: '情境總延滯', value: scenario.waitingArea / 60, unit: '車輛小時', detail: `未錯峰 ${ (baseline.waitingArea / 60).toFixed(2)} 車輛小時；未含基礎行車時間` },
        { label: '情境排隊持續時間', value: scenario.queue.filter(n => n > 1e-9).length, unit: '分鐘', detail: `未錯峰 ${baseline.queue.filter(n => n > 1e-9).length} 分鐘；分鐘末有排隊的分鐘數` },
      ],
      chart: {
        labels, unit: '輛',
        series: [
          { label: '未錯峰到達量', color: '#94a3b8', values: comparison.map((row) => row.arrivals) },
          { label: '情境到達量', color: '#3b82f6', values: current.map((row) => row.arrivals) },
          { label: '情境通過量', color: '#14b8a6', values: current.map((row) => row.served) },
        ],
        caption: '每小時合成到達／模型通過量；計算延伸到兩方案排隊都清空。通過量與到達需求分開計算。',
      },
      secondaryChart: {
        title: '排隊隨時間變化', unit: '輛',
        labels: Array.from({ length: Math.ceil(Math.max(baseline.queue.length, scenario.queue.length) / 15) }, (_, i) => clock(i * 15 + 14)),
        series: [
          { label: '未錯峰分鐘末排隊', color: '#94a3b8', values: Array.from({ length: Math.ceil(Math.max(baseline.queue.length, scenario.queue.length) / 15) }, (_, i) => baseline.queue[i * 15 + 14] || 0) },
          { label: '情境分鐘末排隊', color: '#14b8a6', values: Array.from({ length: Math.ceil(Math.max(baseline.queue.length, scenario.queue.length) / 15) }, (_, i) => scenario.queue[i * 15 + 14] || 0) },
        ], caption: '每 15 分鐘取一個分鐘末排隊點，不是區間平均；兩情境共用時間軸與尺度。完整逐分鐘序列用於計算延滯。',
      },
      model: { baselineWaitingArea: baseline.waitingArea, scenarioWaitingArea: scenario.waitingArea },
      table: {
        columns: [
          { key: 'period', label: '時段' }, { key: 'incoming', label: '情境到達（輛）' },
          { key: 'passed', label: '情境通過（輛）' }, { key: 'peak', label: '情境尖峰排隊（輛）' },
          { key: 'end', label: '期末排隊（輛）' }, { key: 'baselinePeak', label: '未錯峰尖峰（輛）' },
        ],
        rows: current.map((row, index) => ({
          period: labels[index], incoming: row.arrivals, passed: row.served,
          peak: row.peak, end: row.end, baselinePeak: comparison[index].peak,
        })),
      },
      explanation: `固定合成通勤到達序列中，${settings.shift}% 的車流延後 ${settings.delay} 分鐘，再以每小時 ${settings.capacity} 輛的瓶頸上限逐分鐘重算。平均等待${difference < -1e-9 ? '下降' : difference > 1e-9 ? '增加' : '不變'} ${Math.abs(difference).toFixed(2)} 分鐘。這是指定假設下的試辦情境，不是內湖實際效果預測。`,
      assumptions: [
        '未載入 VD 觀測時間序列、通勤 OD 或企業出勤資料。到達量是 06:00–10:00 的固定合成曲線，沒有實測車流。',
        '一個瓶頸、一條 FIFO 流體佇列；每分鐘到達先入列、再依容量通過。平均等待採分鐘離散的排隊面積／總到達量，未計入基礎行車時間。',
        '延後比例均勻套用在各分鐘，車輛不換路線且不消失；等待變化包含最後排隊清空的尾段。未納入下游路口、事故、公車或其他道路回堵。',
        'VD 的觀測通過量不等於通勤到達需求；捷運進出量也不能直接代表道路 OD。來源提供接軌方向，未投入本情境數值計算。',
      ],
      sources: ['vd', 'metro', 'puma'],
    };
  },
};

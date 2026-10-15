const DURATION = 120;
const ROUND_TRIP = 30;
const SEATS = 30;

function bounded(value, fallback, min, max) {
  const number = Number(value);
  return Math.min(max, Math.max(min, Number.isFinite(number) ? number : fallback));
}

function settings(input = {}) {
  input = input && typeof input === 'object' ? input : {};
  return {
    fleet: Math.round(bounded(input.fleet, 4, 1, 12)),
    headway: Math.round(bounded(input.headway, 10, 3, 30)),
    breakMinutes: Math.round(bounded(input.breakMinutes, 10, 5, 30)),
    demand: Math.round(bounded(input.demand, 180, 0, 1500)),
  };
}

function clock(minute) {
  const time = 8 * 60 + minute;
  return `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
}

export function planShuttle(input = {}) {
  const config = settings(input);
  const cycle = ROUND_TRIP + config.breakMinutes;
  const requiredFleet = Math.ceil(cycle / config.headway);
  const interval = Math.max(config.headway, Math.ceil(cycle / config.fleet));
  const schedule = [];
  const ready = Array(config.fleet).fill(0);
  for (let minute = 0; minute < DURATION; minute += interval) {
    const vehicle = schedule.length % config.fleet;
    if (minute < ready[vehicle]) throw new Error('接駁排程違反休息約束');
    ready[vehicle] = minute + cycle;
    schedule.push({ minute, vehicle: vehicle + 1, returned: minute + ROUND_TRIP, ready: ready[vehicle] });
  }
  return { config, cycle, requiredFleet, interval, feasible: requiredFleet <= config.fleet, schedule };
}

function takePassengers(batches, capacity, minute) {
  let boarded = 0;
  let weightedWait = 0;
  while (batches.length && boarded < capacity) {
    const first = batches[0];
    const taken = Math.min(first.count, capacity - boarded);
    boarded += taken;
    weightedWait += taken * (minute - first.minute);
    first.count -= taken;
    if (!first.count) batches.shift();
  }
  return { boarded, weightedWait };
}

// Single synthetic OD (station -> campus), with deterministic five-minute
// passenger batches. All boarded passengers follow FIFO; left-behind counts
// remain visible at the end of the 08:00–10:00 service window.
export function simulateShuttle(input = {}) {
  const plan = planShuttle(input);
  const departures = new Map(plan.schedule.map((trip) => [trip.minute, trip]));
  const batches = [];
  const arrivals = [];
  const served = [];
  const queue = [];
  let waiting = 0;
  let total = 0;
  let weightedWait = 0;
  for (let minute = 0; minute < DURATION; minute += 1) {
    const batch = Math.floor(minute / 5);
    const incoming = minute % 5 ? 0 : Math.floor((batch + 1) * plan.config.demand / 12)
      - Math.floor(batch * plan.config.demand / 12);
    if (incoming) batches.push({ minute, count: incoming });
    waiting += incoming;
    total += incoming;
    const trip = departures.get(minute);
    const result = trip ? takePassengers(batches, SEATS, minute) : { boarded: 0, weightedWait: 0 };
    waiting -= result.boarded;
    weightedWait += result.weightedWait;
    if (trip) Object.assign(trip, { boarded: result.boarded, waiting });
    arrivals.push(incoming);
    served.push(result.boarded);
    queue.push(waiting);
  }
  const boarded = served.reduce((sum, count) => sum + count, 0);
  return {
    ...plan, arrivals, served, queue, total, boarded, remaining: waiting,
    offeredCapacity: plan.schedule.length * SEATS,
    meanBoardedWait: boarded ? weightedWait / boarded : 0,
    waitingArea: queue.reduce((sum, count) => sum + count, 0),
    peakQueue: queue.reduce((max, count) => Math.max(max, count), 0),
  };
}

function hourSum(values, hour) {
  return values.slice(hour * 60, (hour + 1) * 60).reduce((sum, count) => sum + count, 0);
}

export const bus = {
  id: 'bus', number: 5,
  title: '一站公車接駁',
  subtitle: '將車數、班距與每圈休息納入同一份接駁排程',
  defaults: { fleet: 4, headway: 10, breakMinutes: 10, demand: 180 },
  controls: [
    { key: 'fleet', label: '車輛／駕駛組數', type: 'range', min: 1, max: 12, step: 1, unit: '組' },
    { key: 'headway', label: '要求班距', type: 'range', min: 3, max: 30, step: 1, unit: '分鐘' },
    { key: 'breakMinutes', label: '每圈後休息', type: 'range', min: 5, max: 30, step: 1, unit: '分鐘' },
    { key: 'demand', label: '合成往園區需求', type: 'range', min: 0, max: 1500, step: 30, unit: '人／小時' },
  ],
  evaluate(input = {}, data = {}) {
    const result = simulateShuttle(input);
    const { config } = result;
    const baseline = simulateShuttle({ ...config, fleet: 4, headway: 10 });
    const feasibility = result.feasible
      ? `要求的 ${config.headway} 分鐘班距可排出；實際使用 ${result.interval} 分鐘班距。`
      : `要求的 ${config.headway} 分鐘班距不可行：含休息至少需要 ${result.requiredFleet} 組車輛／駕駛，目前只有 ${config.fleet} 組。展示排程已改用 ${result.interval} 分鐘班距以保留休息。`;
    return {
      metrics: [
        { label: '保留休息的實際班距', value: result.interval, unit: '分鐘', detail: result.feasible ? '要求班距可行' : `要求 ${config.headway} 分鐘班距不可行` },
        { label: '要求班距所需車輛／駕駛', value: result.requiredFleet, unit: '組', detail: `現有 ${config.fleet} 組，每圈 ${ROUND_TRIP} 分鐘＋休息 ${config.breakMinutes} 分鐘` },
        { label: '兩小時可提供座位', value: result.offeredCapacity, unit: '人次', detail: `${result.schedule.length} 班 × 每班 ${SEATS} 人；不等於實際搭載` },
        { label: '兩小時實際搭載（模型）', value: result.boarded, unit: '人', detail: `合成到達 ${result.total} 人；10:00 留站 ${result.remaining} 人` },
        { label: '已搭載旅客平均等待', value: result.meanBoardedWait, unit: '分鐘', detail: '僅計入本時窗上車者，留站旅客另列' },
        { label: '10:00 留站（相對固定基準）', value: result.remaining, unit: '人', detail: `同需求、同休息，4 組／要求 10 分鐘班距：${baseline.remaining} 人留站` },
        { label: '時窗內全體累積候車', value: result.waitingArea / 60, unit: '人時', detail: `含留站者已等待部分；固定基準 ${(baseline.waitingArea / 60).toFixed(2)} 人時，未含 10:00 後等待` },
        { label: '最高分鐘末留站', value: result.peakQueue, unit: '人', detail: '逐分鐘重新計算到達、上車及剩餘佇列' },
      ],
      chart: {
        labels: ['08:00–09:00', '09:00–10:00'], unit: '人',
        series: [
          { label: '合成到達', color: '#3b82f6', values: [0, 1].map((hour) => hourSum(result.arrivals, hour)) },
          { label: '實際搭載（模型）', color: '#14b8a6', values: [0, 1].map((hour) => hourSum(result.served, hour)) },
        ],
        caption: '單一路線：接駁站 → 園區 → 接駁站（示意，非實際站址）。只模擬往園區方向，末班後到達者保留於佇列。',
      },
      comparison: { demand: result.total, baselineDemand: baseline.total, baselineRemaining: baseline.remaining, remaining: result.remaining, baselineWaitingArea: baseline.waitingArea, waitingArea: result.waitingArea },
      secondaryChart: { title: '同需求下的搭載與留站比較', type: 'bar', labels: ['固定基準', '調整情境'], unit: '人',
        series: [{ label: '時窗內搭載', color: '#14b8a6', values: [baseline.boarded, result.boarded] }, { label: '10:00 留站', color: '#c69c52', values: [baseline.remaining, result.remaining] }],
        caption: '基準固定 4 組、要求 10 分鐘班距；兩者使用相同需求及休息長度，都先修正為可行班距。搭載＋留站＝同一批總到達人數。',
      },
      table: {
        columns: [
          { key: 'departure', label: '接駁站發車' }, { key: 'vehicle', label: '車輛／駕駛組' },
          { key: 'returned', label: '回到接駁站' }, { key: 'ready', label: '休息後最早可發車' },
          { key: 'boarded', label: '往園區搭載（人）' }, { key: 'waiting', label: '發車後留站（人）' },
        ],
        rows: result.schedule.map((trip) => ({
          departure: clock(trip.minute), vehicle: `第 ${trip.vehicle} 組`,
          returned: clock(trip.returned), ready: clock(trip.ready),
          boarded: trip.boarded, waiting: trip.waiting,
        })),
      },
      explanation: `${feasibility} 08:00–10:00 合成到達 ${result.total} 人，模型搭載 ${result.boarded} 人，10:00 留站 ${result.remaining} 人。留站者仍須等後續班次，不能把已搭載者的平均等待視為所有旅客的服務品質。`,
      assumptions: [
        '未載入站點上下車、班表或通勤 OD。單一接駁站到單一園區為合成 OD，每 5 分鐘固定批次到達；人數由需求控制項產生。',
        `固定往返 ${ROUND_TRIP} 分鐘、每班 ${SEATS} 人，車輛與駕駛一對一，無替班。每一圈回站後完整休息再接下一圈。`,
        '每圈休息是情境參數，不代表符合特定勞動或營運法規。未納入塞車、坡度、充電、長班工時、回程需求或路線間共用車隊。',
        '時窗為 08:00（含）至 10:00（不含）；先到達再搭車，FIFO 排隊、不放棄等候。10:00 留站人數仍在需求中，沒有被刪除。',
        '全市年度客運統計與捷運進出量不提供本路線的逐站 OD；引用來源用於說明補資料方向，未用來聲稱實際需求或成效。',
      ],
      sources: ['bus', 'metro', 'puma'],
    };
  },
};

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

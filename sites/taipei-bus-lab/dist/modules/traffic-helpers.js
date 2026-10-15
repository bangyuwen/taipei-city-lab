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

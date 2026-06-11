const millisecondsPerDay = 24 * 60 * 60 * 1000;

export function nowIso(date = new Date()) {
  return date.toISOString();
}

export function addDaysIso(days: number, from = new Date()) {
  return new Date(from.getTime() + days * millisecondsPerDay).toISOString();
}

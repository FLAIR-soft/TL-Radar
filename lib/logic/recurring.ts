// Chistaya kalendarnaya arifmetika dlya povtoryayushchikhsya pravil (Etap 8).
// Rabotayem s Y-M-D klyuchami kak s "grazhdanskimi" datami (UTC-polnoch' kak
// nyeytral'nyy yakor', bez privyazki k Berlin-instant'am) — sama data
// vypolneniya uzhe interpretiruyetsya Edge Function-ey v mestnom vremeni.
// Uchityvayem tol'ko rabochiye dni (pn-pt) — reshemo soglasovano s
// zakazchikom pered realizatsiyey.

export type RecurringFrequency = 'daily' | 'weekly' | 'monthly';

function isoWeekday(d: Date): number {
  const day = d.getUTCDay();
  return day === 0 ? 7 : day;
}

function addDaysUTC(d: Date, days: number): Date {
  const copy = new Date(d);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function monthCandidate(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))));
}

function nextWorkday(fromKey: string): string {
  let d = addDaysUTC(new Date(fromKey + 'T00:00:00Z'), 1);
  while (isoWeekday(d) > 5) d = addDaysUTC(d, 1);
  return toDateKey(d);
}

function nextWeekday(fromKey: string, weekday: number): string {
  let d = addDaysUTC(new Date(fromKey + 'T00:00:00Z'), 1);
  while (isoWeekday(d) !== weekday) d = addDaysUTC(d, 1);
  return toDateKey(d);
}

function nextMonthDay(fromKey: string, dayOfMonth: number): string {
  const from = new Date(fromKey + 'T00:00:00Z');
  const year = from.getUTCFullYear();
  const month = from.getUTCMonth();
  let candidate = monthCandidate(year, month, dayOfMonth);
  if (candidate <= from) {
    candidate = monthCandidate(year, month + 1, dayOfMonth);
  }
  while (isoWeekday(candidate) > 5) candidate = addDaysUTC(candidate, 1);
  return toDateKey(candidate);
}

// Sleduyushchaya data (strogo posle fromKey), kogda pravilo dolzhno sozdat'
// zadachu. dlya 'weekly' weekday obyazatelen (1=Pn..5=Pt), dlya 'monthly'
// obyazatelen dayOfMonth (1-31, s clamp do poslednego dnya mesyatsa).
export function computeNextRunAt(
  frequency: RecurringFrequency,
  weekday: number | null,
  dayOfMonth: number | null,
  fromKey: string
): string {
  if (frequency === 'daily') return nextWorkday(fromKey);
  if (frequency === 'weekly') return nextWeekday(fromKey, weekday!);
  return nextMonthDay(fromKey, dayOfMonth!);
}

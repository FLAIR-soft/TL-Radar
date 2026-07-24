// Obshchiye utility dlya raboty s vremenem po Europe/Berlin (s uchyotom letnego
// vremeni). Ispol'zuyetsya i v tasks.ts (otsechka rabochikh chasov zadachi),
// i v analytics.ts (dostupnoye rabocheye vremya za period).

export interface TimeInterval {
  start: number;
  end: number;
}

export function berlinCalendarDate(instant: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// Smeshcheniye Berlina ot UTC (v ms) na konkretnyy moment — s uchyotom letnego vremeni.
export function berlinOffsetMs(instant: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    timeZoneName: 'longOffset',
  }).formatToParts(instant);
  const offsetStr = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+1';
  const match = offsetStr.match(/GMT([+-])(\d+)(?::(\d+))?/);
  if (!match) return 60 * 60000;
  const sign = match[1] === '-' ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = match[3] ? Number(match[3]) : 0;
  return sign * (hours * 60 + minutes) * 60000;
}

// Rabocheye okno (07:30-16:00 po Myunhenu) dlya konkretnoy Berlin-daty, kak
// absolyutnyy interval UTC-instantov.
export function workWindowForBerlinDay(year: number, month: number, day: number): TimeInterval {
  const noonGuessUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
  const offsetMs = berlinOffsetMs(new Date(noonGuessUtc));
  const start = Date.UTC(year, month - 1, day, 7, 30, 0) - offsetMs;
  const end = Date.UTC(year, month - 1, day, 16, 0, 0) - offsetMs;
  return { start, end };
}

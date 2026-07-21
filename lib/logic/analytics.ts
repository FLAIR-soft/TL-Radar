import type { Task, TaskPause, TaskAssignee } from '@/lib/supabase/types';
import { inProgressIntervals, type TimeInterval } from './tasks';

function intersect(a: TimeInterval, b: TimeInterval): TimeInterval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
}

const WORK_START_HOUR = 7.5; // 07:30
const WORK_END_HOUR = 16; // 16:00

// Smeshcheniye Berlina ot UTC (v ms) na konkretnyy moment — s uchyotom letnego vremeni.
function berlinOffsetMs(instant: Date): number {
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

function berlinCalendarDate(instant: Date): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
  return { year: get('year'), month: get('month'), day: get('day') };
}

// Rabocheye okno (07:30-16:00 po Myunhenu) dlya konkretnoy Berlin-daty, kak
// absolyutnyy interval UTC-instantov.
function workWindowForBerlinDate(year: number, month: number, day: number): TimeInterval {
  const noonGuessUtc = Date.UTC(year, month - 1, day, 12, 0, 0);
  const offsetMs = berlinOffsetMs(new Date(noonGuessUtc));
  const start = Date.UTC(year, month - 1, day, Math.floor(WORK_START_HOUR), (WORK_START_HOUR % 1) * 60, 0) - offsetMs;
  const end = Date.UTC(year, month - 1, day, WORK_END_HOUR, 0, 0) - offsetMs;
  return { start, end };
}

// Summarnoye dostupnoye rabocheye vremya (07:30-16:00 po Myunhenu kazhdyy den')
// v diapazone [rangeStart, rangeEnd]. Ispol'zuetsya kak edinyy benchmark dlya
// sravneniya s otrabotannym vremenem kazhdogo cheloveka (Etap 6).
export function availableWorkingMs(rangeStart: Date, rangeEnd: Date): number {
  const range: TimeInterval = { start: rangeStart.getTime(), end: rangeEnd.getTime() };
  if (range.end <= range.start) return 0;

  let total = 0;
  const seen = new Set<string>();
  let cursorMs = range.start - 24 * 3600 * 1000; // zapas na granitsy dnya/DST

  while (cursorMs <= range.end) {
    const { year, month, day } = berlinCalendarDate(new Date(cursorMs));
    const key = `${year}-${month}-${day}`;
    if (!seen.has(key)) {
      seen.add(key);
      const window = workWindowForBerlinDate(year, month, day);
      const overlap = intersect(window, range);
      if (overlap) total += overlap.end - overlap.start;
    }
    cursorMs += 24 * 3600 * 1000;
  }

  return total;
}

export interface PersonStat {
  id: string;
  name: string;
  workedMs: number;
}

// Vremya "na zadachakh" kazhdogo cheloveka v diapazone [rangeStart, rangeEnd]:
// dlya kazhdoy stroki task_assignees peresekaem intervaly in_progress zadachi
// s oknom [added_at, removed_at ?? rangeEnd] etogo naznacheniya — vremya
// zaschityvaetsya tol'ko s momenta fakticheskogo dobavleniya, ne zadnim chislom
// (pravilo iz Etapa 4). Uchityvayutsya i uzhe snyatyye (removed_at) naznacheniya —
// chelovek dolzhen poluchit' kredit za vremya do snyatiya.
export function computePersonStats(params: {
  profiles: { id: string; name: string }[];
  tasks: Task[];
  pauses: TaskPause[];
  assignees: TaskAssignee[];
  rangeStart: Date;
  rangeEnd: Date;
}): PersonStat[] {
  const { profiles, tasks, pauses, assignees, rangeStart, rangeEnd } = params;
  const range: TimeInterval = { start: rangeStart.getTime(), end: rangeEnd.getTime() };

  const pausesByTask = new Map<string, TaskPause[]>();
  for (const p of pauses) {
    const list = pausesByTask.get(p.task_id) ?? [];
    list.push(p);
    pausesByTask.set(p.task_id, list);
  }
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const intervalsByTask = new Map<string, TimeInterval[]>();

  const workedByPerson = new Map<string, number>();

  for (const a of assignees) {
    const task = tasksById.get(a.task_id);
    if (!task) continue;

    let intervals = intervalsByTask.get(task.id);
    if (!intervals) {
      intervals = inProgressIntervals(task, pausesByTask.get(task.id) ?? [], rangeEnd);
      intervalsByTask.set(task.id, intervals);
    }

    const addedAt = new Date(a.added_at).getTime();
    const removedAt = a.removed_at ? new Date(a.removed_at).getTime() : range.end;
    const window: TimeInterval = { start: Math.max(addedAt, range.start), end: Math.min(removedAt, range.end) };
    if (window.end <= window.start) continue;

    let ms = 0;
    for (const iv of intervals) {
      const overlap = intersect(iv, window);
      if (overlap) ms += overlap.end - overlap.start;
    }
    if (ms > 0) {
      workedByPerson.set(a.assignee_id, (workedByPerson.get(a.assignee_id) ?? 0) + ms);
    }
  }

  return profiles.map((p) => ({
    id: p.id,
    name: p.name,
    workedMs: workedByPerson.get(p.id) ?? 0,
  }));
}

import type { Task, TaskPause, TaskAssignee } from '@/lib/supabase/types';
import { inProgressIntervals } from './tasks';
import { berlinCalendarDate, workWindowForBerlinDay, type TimeInterval } from './berlin-time';

function intersect(a: TimeInterval, b: TimeInterval): TimeInterval | null {
  const start = Math.max(a.start, b.start);
  const end = Math.min(a.end, b.end);
  return end > start ? { start, end } : null;
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
      const window = workWindowForBerlinDay(year, month, day);
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

// Доля отработанного от доступного рабочего времени. Прямая шкала: 90 % —
// это «отработано 90 % доступного времени» (откат K3, редизайн v2, этап 9).
// Раньше та же величина показывалась инвертированной, как «% свободной
// ёмкости». Может превысить 100 % при переработке — это намеренно, величина
// переработки должна быть видна, а не упираться в потолок.
export function workedPercent(workedMs: number, availableMs: number): number {
  if (availableMs <= 0) return 0;
  return (workedMs / availableMs) * 100;
}

import type { Task, ActivityLog, TaskStatus } from '@/lib/supabase/types';
import { berlinCalendarDate } from './berlin-time';

export interface DailyStatusCounts {
  date: string;
  waiting: number;
  in_progress: number;
  paused: number;
  done: number;
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// Yezhednevnyy snepshot kolichestva zadach v kazhdom statuse (ne "klassicheskiy"
// CFD s kumulyativnymi pribytiyami v kazhdyy etap, a bolee prostoy i ponyatnyy
// srez "kto gde seychas" na kazhdyy den' — dostatochno, chtoby uvidet' rost
// ochered i WIP so vremenem). Istochnik istiny o momentakh perekhoda —
// activity_log.event_type = 'status_changed' (detail.to); nachal'nyy status
// lyuboy zadachi vsegda 'waiting' s momenta created_at.
export function computeCumulativeFlow(params: {
  tasks: Task[];
  statusChanges: ActivityLog[];
  rangeStart: Date;
  rangeEnd: Date;
}): DailyStatusCounts[] {
  const { tasks, statusChanges, rangeStart, rangeEnd } = params;

  const transitionsByTask = new Map<string, { at: number; status: TaskStatus }[]>();
  for (const log of statusChanges) {
    if (log.event_type !== 'status_changed') continue;
    const to = (log.detail as { to?: TaskStatus } | null)?.to;
    if (!to) continue;
    const list = transitionsByTask.get(log.entity_id) ?? [];
    list.push({ at: new Date(log.created_at).getTime(), status: to });
    transitionsByTask.set(log.entity_id, list);
  }
  for (const list of transitionsByTask.values()) {
    list.sort((a, b) => a.at - b.at);
  }

  function statusAt(task: Task, atMs: number): TaskStatus | null {
    const createdMs = new Date(task.created_at).getTime();
    if (atMs < createdMs) return null;
    let current: TaskStatus = 'waiting';
    for (const t of transitionsByTask.get(task.id) ?? []) {
      if (t.at <= atMs) current = t.status;
      else break;
    }
    return current;
  }

  const results: DailyStatusCounts[] = [];
  const dayMs = 24 * 3600 * 1000;
  for (let cursor = rangeStart.getTime(); cursor <= rangeEnd.getTime(); cursor += dayMs) {
    const { year, month, day } = berlinCalendarDate(new Date(cursor));
    const counts: DailyStatusCounts = { date: dateKey(year, month, day), waiting: 0, in_progress: 0, paused: 0, done: 0 };
    for (const task of tasks) {
      const status = statusAt(task, cursor);
      if (status) counts[status] += 1;
    }
    results.push(counts);
  }
  return results;
}

import type { TaskStatus, Task, TaskPause } from '@/lib/supabase/types';

export const STATUS_COLOR: Record<TaskStatus, string> = {
  waiting: 'var(--waiting)',
  in_progress: 'var(--progress)',
  paused: 'var(--paused)',
  done: 'var(--done)',
};

export function fmtDateTime(iso: string | null, intlLocale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(intlLocale, {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(iso: string | null, intlLocale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(intlLocale, {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function fmtDuration(ms: number, units: { hourShort: string; minuteShort: string }): string {
  if (ms < 0) ms = 0;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return (h > 0 ? h + units.hourShort + ' ' : '') + m + units.minuteShort;
}

// Chistoye vremya vypolneniya: (completed_at - started_at) minus summa pauz.
export function netDuration(task: Task, pauses: TaskPause[]): number | null {
  if (!task.started_at || !task.completed_at) return null;
  let total = new Date(task.completed_at).getTime() - new Date(task.started_at).getTime();
  for (const p of pauses) {
    if (p.paused_at && p.resumed_at) {
      total -= new Date(p.resumed_at).getTime() - new Date(p.paused_at).getTime();
    }
  }
  return total;
}

// Dedlayn — eto data bez vremeni: zadacha schitaetsya prosrochennoy tol'ko posle
// 16:00 po Myunhenu toy zhe daty (tot zhe cutoff, chto i u avtopauzy), a ne s polunochi UTC.
const OVERDUE_CUTOFF_HOUR = 16;

function berlinDateParts(date: Date): { year: number; month: number; day: number; hour: number } {
  const berlin = new Date(date.toLocaleString('en-US', { timeZone: 'Europe/Berlin' }));
  return {
    year: berlin.getFullYear(),
    month: berlin.getMonth() + 1,
    day: berlin.getDate(),
    hour: berlin.getHours(),
  };
}

export function isOverdue(task: Task): boolean {
  if (!task.deadline || task.status === 'done') return false;

  const [deadlineYear, deadlineMonth, deadlineDay] = task.deadline.split('-').map(Number);
  const now = berlinDateParts(new Date());

  const deadlineKey = deadlineYear * 10000 + deadlineMonth * 100 + deadlineDay;
  const todayKey = now.year * 10000 + now.month * 100 + now.day;

  if (todayKey > deadlineKey) return true;
  if (todayKey < deadlineKey) return false;
  return now.hour >= OVERDUE_CUTOFF_HOUR;
}

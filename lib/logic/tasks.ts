import type { TaskStatus, Task, TaskPause } from '@/lib/supabase/types';

export const STATUS: Record<TaskStatus, { label: string; color: string }> = {
  waiting: { label: 'Ожидание', color: 'var(--waiting)' },
  in_progress: { label: 'В процессе', color: 'var(--progress)' },
  paused: { label: 'Пауза', color: 'var(--paused)' },
  done: { label: 'Сделано', color: 'var(--done)' },
};

export function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ru-RU', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ru-RU', {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

export function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return (h > 0 ? h + 'ч ' : '') + m + 'м';
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

export function isOverdue(task: Task): boolean {
  if (!task.deadline) return false;
  return new Date(task.deadline) < new Date() && task.status !== 'done';
}

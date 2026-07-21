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
const CUTOFF_HOUR = 16;

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
  return now.hour >= CUTOFF_HOUR;
}

// Rabochiye chasy: 07:30–16:00 po Myunhenu. Vne etogo okna (16:00 do 7:30
// sleduyushchego dnya) taymery ne dolzhny tikat', a smena statusa zadachi zapreshchena.
const WORK_START_SEC = 7 * 3600 + 30 * 60; // 07:30
const WORK_END_SEC = CUTOFF_HOUR * 3600; // 16:00
const SECONDS_PER_DAY = 24 * 3600;

function berlinSecondsOfDay(date: Date): { secondsOfDay: number; ms: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const hour = get('hour') % 24;
  const minute = get('minute');
  const second = get('second');
  return { secondsOfDay: hour * 3600 + minute * 60 + second, ms: date.getMilliseconds() };
}

export function isWithinWorkHours(date: Date = new Date()): boolean {
  const { secondsOfDay } = berlinSecondsOfDay(date);
  return secondsOfDay >= WORK_START_SEC && secondsOfDay < WORK_END_SEC;
}

// Taymery na aktivnyh zadachah ne dolzhny "tikat'" s 16:00 do 7:30 sleduyushchego
// dnya po Myunhenu — tot zhe cutoff, chto u avtopauzy. Vne rabochih chasov
// "effektivnoye seychas" zamorazhivaetsya rovno na momente poslednego 16:00
// (segodnyashnego ili vcherashnego, v zavisimosti ot togo, uzhe li proshli 7:30);
// vnutri rabochih chasov — eto prosto real'noye vremya.
export function effectiveNow(): Date {
  const now = new Date();
  const { secondsOfDay, ms } = berlinSecondsOfDay(now);

  if (secondsOfDay >= WORK_START_SEC && secondsOfDay < WORK_END_SEC) return now;

  const secondsSinceLastCutoff =
    secondsOfDay >= WORK_END_SEC
      ? secondsOfDay - WORK_END_SEC
      : SECONDS_PER_DAY - WORK_END_SEC + secondsOfDay;

  const msSinceLastCutoff = secondsSinceLastCutoff * 1000 + ms;
  return new Date(now.getTime() - msSinceLastCutoff);
}

export interface TimeInterval {
  start: number;
  end: number;
}

// Intervaly vremeni v statuse in_progress za vsyu istoriyu zadachi, do momenta `end`
// (zakrytye pauzy vyrezayutsya iz obshchego promezhutka started_at..end/completed_at;
// otkrytaya pauza ne vyrezaetsya — eto sushchestvuyushcheye povedeniye,
// accumulatedInProgressDuration nizhe prosto summiruet eti intervaly).
// Ispol'zuetsya i dlya kartochki zadachi, i dlya analitiki (Etap 6) — pri peresechenii
// s oknom [added_at, removed_at] konkretnogo ispolnitelya.
export function inProgressIntervals(task: Task, pauses: TaskPause[], end: Date): TimeInterval[] {
  if (!task.started_at) return [];
  const endMs = task.completed_at ? new Date(task.completed_at).getTime() : end.getTime();
  const startMs = new Date(task.started_at).getTime();
  if (endMs <= startMs) return [];

  let intervals: TimeInterval[] = [{ start: startMs, end: endMs }];

  for (const p of pauses) {
    if (!p.paused_at || !p.resumed_at) continue;
    const pausedAt = new Date(p.paused_at).getTime();
    const resumedAt = Math.min(new Date(p.resumed_at).getTime(), end.getTime());
    if (resumedAt <= pausedAt) continue;

    const next: TimeInterval[] = [];
    for (const iv of intervals) {
      if (resumedAt <= iv.start || pausedAt >= iv.end) {
        next.push(iv);
        continue;
      }
      if (pausedAt > iv.start) next.push({ start: iv.start, end: Math.min(pausedAt, iv.end) });
      if (resumedAt < iv.end) next.push({ start: Math.max(resumedAt, iv.start), end: iv.end });
    }
    intervals = next;
  }

  return intervals.filter((iv) => iv.end > iv.start);
}

// Summarnoye vremya v statuse in_progress za vsyu istoriyu zadachi, do momenta `end`.
export function accumulatedInProgressDuration(task: Task, pauses: TaskPause[], end: Date): number | null {
  if (!task.started_at) return null;
  const total = inProgressIntervals(task, pauses, end).reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.max(0, total);
}

// Vremya s poslednego perekhoda v in_progress (posle resume ili s samogo nachala).
export function currentSessionDuration(task: Task, pauses: TaskPause[], end: Date): number | null {
  if (task.status !== 'in_progress' || !task.started_at) return null;
  const resumes = pauses
    .filter((p) => p.resumed_at)
    .map((p) => new Date(p.resumed_at!).getTime())
    .sort((a, b) => b - a);
  const sessionStart = resumes.length ? resumes[0] : new Date(task.started_at).getTime();
  return Math.max(0, end.getTime() - sessionStart);
}

// Vremya v tekushchey (otkrytoy) pauze.
export function currentPauseDuration(task: Task, pauses: TaskPause[], end: Date): number | null {
  if (task.status !== 'paused') return null;
  const openPause = pauses.find((p) => !p.resumed_at);
  if (!openPause) return null;
  return Math.max(0, end.getTime() - new Date(openPause.paused_at).getTime());
}

// Vremya s momenta sozdaniya, poka zadacha eshcho ne nachata.
export function waitingDuration(task: Task, end: Date): number | null {
  if (task.status !== 'waiting') return null;
  return Math.max(0, end.getTime() - new Date(task.created_at).getTime());
}

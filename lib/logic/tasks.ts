import type { TaskStatus, Task, TaskPause } from '@/lib/supabase/types';
import { berlinCalendarDate, workWindowForBerlinDay, type TimeInterval } from './berlin-time';

export type { TimeInterval };

export const STATUS_COLOR: Record<TaskStatus, string> = {
  waiting: 'var(--waiting)',
  in_progress: 'var(--progress)',
  paused: 'var(--paused)',
  done: 'var(--done)',
};

// Kakiye perekhody mezhdu VIDIMYMI kolonkami kanbana dopustimy dlya drag-and-drop.
// Namerenno uzhe, chem knopki na karto4ke (TaskCard.nextActions): tam yest'
// pryamoy perekhod v 'done', no v kanbane net kolonki "sdelano", kuda mozhno
// bylo by pere tashchit' — zavershyonnyye zadachi uezzhayut srazu v arkhiv.
export const VALID_KANBAN_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  waiting: ['in_progress'],
  in_progress: ['paused'],
  paused: ['in_progress'],
  done: [],
};

export function isValidKanbanTransition(from: TaskStatus, to: TaskStatus): boolean {
  return VALID_KANBAN_TRANSITIONS[from].includes(to);
}

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

// Короткая дата для компактной карточки (скрин 03: «04.08.») — без года,
// формат задаёт локаль, поэтому отдельных строк в словарях не нужно.
export function fmtDateShort(iso: string | null, intlLocale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(intlLocale, {
    timeZone: 'Europe/Berlin',
    day: '2-digit',
    month: '2-digit',
  });
}

// Только время, без даты: колонки «Gestartet» и «Abgeschlossen» архива —
// день там и так виден в «Erfasst» (скрин 08).
export function fmtTime(iso: string | null, intlLocale: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString(intlLocale, {
    timeZone: 'Europe/Berlin',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// «24.07. 07:48» — колонка «Erfasst» архива: короткая дата и время, без года.
export function fmtDateTimeCompact(iso: string | null, intlLocale: string): string {
  if (!iso) return '—';
  return `${fmtDateShort(iso, intlLocale)} ${fmtTime(iso, intlLocale)}`;
}

export function fmtDuration(ms: number, units: { hourShort: string; minuteShort: string }): string {
  if (ms < 0) ms = 0;
  const totalMin = Math.round(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return (h > 0 ? h + units.hourShort + ' ' : '') + m + units.minuteShort;
}

// Живой таймер на карточке и в панели задачи (редизайн v2, этап 2):
// «Ч:ММ:СС» пока задача в работе и «Ч:ММ» в ожидании/на паузе — эталоны
// screens/03 (1:24:08) и screens/05 (215:46). Часы не ограничены двумя
// знаками: 215:46 — это 215 часов. Секунды и минуты усекаются, а не
// округляются, иначе бегущий таймер прыгал бы на минуту вперёд.
//
// fmtDuration выше — отдельная функция и остаётся словесной: на ней держатся
// архив, оценки и экспорт в CSV/XLSX. Подменять её здесь нельзя.
export function fmtTimer(ms: number, withSeconds: boolean): string {
  if (ms < 0) ms = 0;
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const mm = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0');
  if (!withSeconds) return `${h}:${mm}`;
  return `${h}:${mm}:${String(totalSec % 60).padStart(2, '0')}`;
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

// Час отсечки рабочего дня как подпись: дедлайн истекает в 16:00 по Мюнхену,
// и на карточке он показывается вместе с этим часом («Heute, 16:00», скрин 03).
export const DEADLINE_HOUR_LABEL = `${CUTOFF_HOUR}:00`;

// 0 — дедлайн сегодня, 1 — завтра, иначе null: только для этих двух дней
// карточка показывает относительную подпись вместо даты.
export function deadlineDayOffset(deadline: string): 0 | 1 | null {
  const [year, month, day] = deadline.split('-').map(Number);
  const now = berlinDateParts(new Date());
  const diff = Math.round(
    (Date.UTC(year, month - 1, day) - Date.UTC(now.year, now.month - 1, now.day)) / 86400000
  );
  return diff === 0 ? 0 : diff === 1 ? 1 : null;
}

// Сколько полных суток прошло с дедлайна — для плашки «Überfällig seit N Tagen»
// на карточке (редизайн v2, этап 4). Считается по календарным датам Мюнхена,
// тем же ключом год*10000+месяц*100+день, что и isOverdue, поэтому переход
// через 16:00 в день дедлайна даёт 0 дней, а не «полдня».
export function overdueDays(task: Task): number | null {
  if (!isOverdue(task) || !task.deadline) return null;

  const [year, month, day] = task.deadline.split('-').map(Number);
  const now = berlinDateParts(new Date());

  const deadlineUtc = Date.UTC(year, month - 1, day);
  const todayUtc = Date.UTC(now.year, now.month - 1, now.day);
  return Math.max(0, Math.round((todayUtc - deadlineUtc) / 86400000));
}

// Deadline "istekaet" v 16:00 po Myunhenu v svoyu datu (tot zhe cutoff, chto i u
// isOverdue vyshe) — ispol'zuyem workWindowForBerlinDay, chtoby ne dublirovat'
// letneye/zimneye smeshcheniye vruchnuyu.
function deadlineCutoffMs(deadline: string): number {
  const [year, month, day] = deadline.split('-').map(Number);
  return workWindowForBerlinDay(year, month, day).end;
}

// Naskol'ko pozzhe deadline'a zavershena zadacha (ms), ili null, yesli deadline'a
// net, zadacha yeshcho ne zavershena, ili ukladyvayetsya v srok.
export function completedLateBy(task: Task): number | null {
  if (!task.deadline || !task.completed_at) return null;
  const lateMs = new Date(task.completed_at).getTime() - deadlineCutoffMs(task.deadline);
  return lateMs > 0 ? lateMs : null;
}

// Sortirovka dlya kolonok kanbana: prosrochennyye pervymi, zatem po blizosti
// dedlayna (ISO yyyy-mm-dd sravnivayetsya leksikograficheski = khronologicheski),
// zadachi bez dedlayna — v kontse. Vnutri gruppy poryadok stabilen (Array.sort
// stable), t.e. sokhranyayet iskhodnuyu sortirovku po created_at.
export function compareByDeadlineUrgency(a: Task, b: Task): number {
  const aOverdue = isOverdue(a);
  const bOverdue = isOverdue(b);
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
  if (!a.deadline && !b.deadline) return 0;
  if (!a.deadline) return 1;
  if (!b.deadline) return -1;
  return a.deadline.localeCompare(b.deadline);
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

// Obrezayet [start, end) do peresecheniya s rabochimi oknami 07:30–16:00 po
// Myunhenu na kazhdyy zadetyy den' — vremya vne etikh chasov ne dolzhno
// schitat'sya otrabotannym, dazhe yesli avtopauza yeschyo ne uspela sozdat'
// zapis' o pauze (naprimer, zadacha ostavlena in_progress na noch').
function clipToWorkHours(start: number, end: number): TimeInterval[] {
  if (end <= start) return [];
  const result: TimeInterval[] = [];
  let cursor = berlinCalendarDate(new Date(start));
  for (let i = 0; i < 3660; i++) {
    const win = workWindowForBerlinDay(cursor.year, cursor.month, cursor.day);
    if (win.start >= end) break;
    const segStart = Math.max(start, win.start);
    const segEnd = Math.min(end, win.end);
    if (segEnd > segStart) result.push({ start: segStart, end: segEnd });
    // Sleduyushchiy kalendarnyy den' po Berlinu — cherez polden' UTC togo zhe
    // dnya, chtoby ne popast' na granitsu letnego vremeni okolo polunochi.
    const noonUtc = Date.UTC(cursor.year, cursor.month - 1, cursor.day, 12, 0, 0);
    cursor = berlinCalendarDate(new Date(noonUtc + 24 * 3600 * 1000));
  }
  return result;
}

function workHoursDurationBetween(start: number, end: number): number {
  return clipToWorkHours(start, end).reduce((sum, iv) => sum + (iv.end - iv.start), 0);
}

// Intervaly vremeni v statuse in_progress za vsyu istoriyu zadachi, do momenta `end`
// (zakrytye i otkrytye pauzy odinakovo vyrezayutsya iz obshchego promezhutka
// started_at..end/completed_at — otkrytaya pauza vyrezaetsya vplot' do `end`,
// chtoby "vsyo v rabote" ne prodolzhalo rasti, poka zadacha stoit na pauze).
// Kazhdyy poluchivshiysya interval dopolnitel'no obrezaetsya do rabochikh chasov
// (07:30–16:00 po Myunhenu), chtoby noch' ne schitalas' otrabotannoy, dazhe
// yesli avtopauza yeschyo ne srabotala.
// Ispol'zuetsya i dlya kartochki zadachi, i dlya analitiki (Etap 6) — pri peresechenii
// s oknom [added_at, removed_at] konkretnogo ispolnitelya.
export function inProgressIntervals(task: Task, pauses: TaskPause[], end: Date): TimeInterval[] {
  if (!task.started_at) return [];
  const endMs = task.completed_at ? new Date(task.completed_at).getTime() : end.getTime();
  const startMs = new Date(task.started_at).getTime();
  if (endMs <= startMs) return [];

  let intervals: TimeInterval[] = [{ start: startMs, end: endMs }];

  for (const p of pauses) {
    if (!p.paused_at) continue;
    const pausedAt = new Date(p.paused_at).getTime();
    // Otkrytaya pauza (yeschyo ne resumed) vsyo ravno dolzhna vyrezat'sya
    // vplot' do `end` — inache "vsyo v rabote" prodolzhayet rasti, poka
    // zadacha stoit na pauze (byl bag: schyotchik tikal vo vremya pauzy).
    const resumedAt = p.resumed_at ? Math.min(new Date(p.resumed_at).getTime(), end.getTime()) : end.getTime();
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

  const workClipped: TimeInterval[] = [];
  for (const iv of intervals) {
    if (iv.end > iv.start) workClipped.push(...clipToWorkHours(iv.start, iv.end));
  }
  return workClipped;
}

// Summarnoye vremya v statuse in_progress za vsyu istoriyu zadachi, do momenta `end`.
export function accumulatedInProgressDuration(task: Task, pauses: TaskPause[], end: Date): number | null {
  if (!task.started_at) return null;
  const total = inProgressIntervals(task, pauses, end).reduce((sum, iv) => sum + (iv.end - iv.start), 0);
  return Math.max(0, total);
}

// Chistoye vremya vypolneniya zadachi celikom (dlya arkhiva): to zhe, chto
// accumulatedInProgressDuration, no do momenta zaversheniya zadachi.
export function netDuration(task: Task, pauses: TaskPause[]): number | null {
  if (!task.started_at || !task.completed_at) return null;
  return accumulatedInProgressDuration(task, pauses, new Date(task.completed_at));
}

// Vremya s poslednego perekhoda v in_progress (posle resume ili s samogo nachala),
// obrezannoye do rabochikh chasov — tak zhe, kak i accumulatedInProgressDuration.
export function currentSessionDuration(task: Task, pauses: TaskPause[], end: Date): number | null {
  if (task.status !== 'in_progress' || !task.started_at) return null;
  const resumes = pauses
    .filter((p) => p.resumed_at)
    .map((p) => new Date(p.resumed_at!).getTime())
    .sort((a, b) => b - a);
  const sessionStart = resumes.length ? resumes[0] : new Date(task.started_at).getTime();
  if (end.getTime() <= sessionStart) return 0;
  return workHoursDurationBetween(sessionStart, end.getTime());
}

// Vremya v tekushchey (otkrytoy) pauze.
export function currentPauseDuration(task: Task, pauses: TaskPause[], end: Date): number | null {
  if (task.status !== 'paused') return null;
  const openPause = pauses.find((p) => !p.resumed_at);
  if (!openPause) return null;
  return Math.max(0, end.getTime() - new Date(openPause.paused_at).getTime());
}

// Summarnoye vremya na pauze za vsyu istoriyu zadachi (tol'ko ruchnyye pauzy,
// auto=false — nochnaya avtopauza eto sistemnyy mekhanizm, a ne prostoy chelovekom,
// summirovat' yeyo v "obshcheye vremya na pauze" bylo by vvodyashche v zabluzhdeniye).
export function totalPausedDuration(pauses: TaskPause[], end: Date): number {
  let total = 0;
  for (const p of pauses) {
    if (p.auto) continue;
    const start = new Date(p.paused_at).getTime();
    const stop = p.resumed_at ? new Date(p.resumed_at).getTime() : end.getTime();
    if (stop > start) total += stop - start;
  }
  return total;
}

// Kto poslednim (po vremeni) vruchnuyu postavil zadachu na pauzu — id profilya
// ili null, yesli ruchnykh pauz yeschyo ne bylo (tol'ko avtopauzy/nikakikh).
export function lastPausedBy(pauses: TaskPause[]): string | null {
  const manual = pauses
    .filter((p) => !p.auto && p.created_by)
    .sort((a, b) => new Date(b.paused_at).getTime() - new Date(a.paused_at).getTime());
  return manual.length ? manual[0].created_by : null;
}

// Vremya s momenta sozdaniya, poka zadacha eshcho ne nachata.
export function waitingDuration(task: Task, end: Date): number | null {
  if (task.status !== 'waiting') return null;
  return Math.max(0, end.getTime() - new Date(task.created_at).getTime());
}

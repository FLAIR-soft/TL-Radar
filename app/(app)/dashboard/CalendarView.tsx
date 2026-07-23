'use client';

import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { PRIORITY_COLOR } from '@/lib/logic/priority';
import { TaskDetailPanel } from './TaskDetailPanel';
import type { Task, Label } from '@/lib/supabase/types';

function parseMonth(month?: string): { year: number; month: number } {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split('-').map(Number);
    return { year: y, month: m };
  }
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function shiftMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

// Zadachi bez dedlayna ne popadayut v setku — kalendar' pokazyvayet tol'ko
// srochnost' po datam, ostal'noye po-prezhnemu vidno v kanbane/tablitse.
export function CalendarView({
  tasks,
  assigneeNamesByTask,
  projectNames,
  profileNames,
  labelsByTask,
  month,
}: {
  tasks: Task[];
  assigneeNamesByTask: Map<string, string[]>;
  projectNames: Map<string, string>;
  profileNames: Map<string, string>;
  labelsByTask?: Map<string, Label[]>;
  month?: string;
}) {
  const dict = useDictionary();
  const { year, month: m } = parseMonth(month);
  const prev = shiftMonth(year, m, -1);
  const next = shiftMonth(year, m, 1);

  const byDate = new Map<string, Task[]>();
  for (const t of tasks) {
    if (!t.deadline) continue;
    const list = byDate.get(t.deadline) ?? [];
    list.push(t);
    byDate.set(t.deadline, list);
  }

  const firstOfMonth = new Date(year, m - 1, 1);
  const daysInMonth = new Date(year, m, 0).getDate();
  const firstWeekday = (firstOfMonth.getDay() + 6) % 7; // 0 = Monday

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayKey = new Date().toISOString().slice(0, 10);
  const monthLabel = firstOfMonth.toLocaleDateString(dict.intlLocale, { month: 'long', year: 'numeric' });
  const weekdayLabels = Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, i + 1).toLocaleDateString(dict.intlLocale, { weekday: 'short' })
  );

  return (
    <div className="calendar-view">
      <div className="calendar-nav">
        <Link
          href={`/dashboard?view=calendar&month=${prev.year}-${pad2(prev.month)}`}
          className="icon-btn"
          data-testid="calendar-prev"
        >
          <ChevronLeft size={16} strokeWidth={1.75} />
        </Link>
        <span className="calendar-month-label">{monthLabel}</span>
        <Link
          href={`/dashboard?view=calendar&month=${next.year}-${pad2(next.month)}`}
          className="icon-btn"
          data-testid="calendar-next"
        >
          <ChevronRight size={16} strokeWidth={1.75} />
        </Link>
      </div>
      <div className="calendar-grid">
        {weekdayLabels.map((w) => (
          <div className="calendar-weekday" key={w}>
            {w}
          </div>
        ))}
        {cells.map((d, i) => {
          if (d === null) return <div className="calendar-cell calendar-cell-empty" key={i} />;
          const key = `${year}-${pad2(m)}-${pad2(d)}`;
          const dayTasks = byDate.get(key) ?? [];
          return (
            <div className={`calendar-cell ${key === todayKey ? 'calendar-cell-today' : ''}`} key={i} data-testid="calendar-cell">
              <div className="calendar-cell-day">{d}</div>
              <div className="calendar-cell-tasks">
                {dayTasks.map((t) => (
                  <div
                    className="calendar-task-chip"
                    key={t.id}
                    style={{ borderLeftColor: t.priority ? PRIORITY_COLOR[t.priority] : 'var(--border)' }}
                    data-testid="calendar-task"
                  >
                    <span className="calendar-task-title">{t.title}</span>
                    <TaskDetailPanel
                      task={t}
                      assigneeNames={assigneeNamesByTask.get(t.id) ?? []}
                      projectName={t.project_id ? projectNames.get(t.project_id) ?? null : null}
                      profileNames={profileNames}
                    />
                    {(labelsByTask?.get(t.id) ?? []).map((l) => (
                      <span key={l.id} className="calendar-label-dot" style={{ background: l.color }} title={l.name} />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

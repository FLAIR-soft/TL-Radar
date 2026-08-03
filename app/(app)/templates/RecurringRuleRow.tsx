'use client';

import { useRef, useState, useTransition } from 'react';
import { Trash2, Repeat } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { toggleRecurringRule, deleteRecurringRule } from './rules-actions';
import type { RecurringRule } from '@/lib/supabase/types';

// Matches the .project-row max-height/opacity/padding transition duration
// in globals.css — the row stays on screen this long after delete so the
// collapse animation can play, instead of just popping out of the list the
// instant revalidatePath() refreshes it.
const EXIT_MS = 240;

export function RecurringRuleRow({
  rule,
  templateTitle,
  style,
}: {
  rule: RecurringRule;
  templateTitle: string;
  style?: React.CSSProperties;
}) {
  const dict = useDictionary();
  const [isPending, startTransition] = useTransition();
  const [removing, setRemoving] = useState(false);
  const rowRef = useRef<HTMLDivElement>(null);

  function handleToggle() {
    startTransition(() => {
      toggleRecurringRule(rule.id, !rule.active);
    });
  }

  function handleDelete() {
    if (!confirm(dict.recurring.deleteConfirm)) return;
    const rowEl = rowRef.current;
    if (rowEl) {
      rowEl.style.maxHeight = `${rowEl.scrollHeight}px`;
      void rowEl.offsetHeight; // force reflow so the browser has a starting height to transition from
      requestAnimationFrame(() => {
        rowEl.style.maxHeight = '0px';
      });
    }
    setRemoving(true);
    startTransition(() => {
      setTimeout(() => {
        deleteRecurringRule(rule.id);
      }, EXIT_MS);
    });
  }

  let frequencyText = dict.recurring.daily;
  if (rule.frequency === 'weekly' && rule.weekday) {
    frequencyText = `${dict.recurring.weekly}: ${dict.recurring.weekdays[rule.weekday as 1 | 2 | 3 | 4 | 5]}`;
  } else if (rule.frequency === 'monthly' && rule.day_of_month) {
    frequencyText = `${dict.recurring.monthly}: ${dict.recurring.dayOfMonthTemplate.replace('{n}', String(rule.day_of_month))}`;
  }

  return (
    <div
      ref={rowRef}
      className={`project-row rule-row ${rule.active ? '' : 'rule-row-inactive'} ${isPending ? 'task-card-pending' : ''} ${removing ? 'is-removing' : ''}`}
      style={style}
    >
      <div className="project-row-main">
        <div className="project-row-head">
          <span className="project-row-name">
            <Repeat size={16} strokeWidth={1.75} className="t-title-icon" />
            {templateTitle}
          </span>
          <div className="project-row-actions">
            <button
              type="button"
              className="icon-btn"
              title={dict.templates.deleteTitle}
              disabled={isPending || removing}
              onClick={handleDelete}
              data-testid="delete-rule"
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="t-meta">
          <span className="rule-frequency">{frequencyText}</span>
          <span>
            {dict.recurring.nextRunLabel}: <span className="mono">{rule.next_run_at}</span>
          </span>
          <label className="switch-label">
            <input
              type="checkbox"
              className="switch-input"
              checked={rule.active}
              disabled={isPending}
              onChange={handleToggle}
              data-testid="rule-active-toggle"
            />
            <span className="switch-track">
              <span className="switch-thumb" />
            </span>
            {dict.recurring.activeLabel}
          </label>
        </div>
      </div>
    </div>
  );
}

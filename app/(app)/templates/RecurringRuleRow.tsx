'use client';

import { useTransition } from 'react';
import { Trash2, Repeat } from 'lucide-react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { toggleRecurringRule, deleteRecurringRule } from './rules-actions';
import type { RecurringRule } from '@/lib/supabase/types';

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

  function handleToggle() {
    startTransition(() => {
      toggleRecurringRule(rule.id, !rule.active);
    });
  }

  function handleDelete() {
    if (!confirm(dict.recurring.deleteConfirm)) return;
    startTransition(() => {
      deleteRecurringRule(rule.id);
    });
  }

  let frequencyText = dict.recurring.daily;
  if (rule.frequency === 'weekly' && rule.weekday) {
    frequencyText = `${dict.recurring.weekly}: ${dict.recurring.weekdays[rule.weekday as 1 | 2 | 3 | 4 | 5]}`;
  } else if (rule.frequency === 'monthly' && rule.day_of_month) {
    frequencyText = `${dict.recurring.monthly}: ${dict.recurring.dayOfMonthTemplate.replace('{n}', String(rule.day_of_month))}`;
  }

  return (
    <div className={`project-row rule-row ${isPending ? 'task-card-pending' : ''}`} style={style}>
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
              disabled={isPending}
              onClick={handleDelete}
              data-testid="delete-rule"
            >
              <Trash2 size={16} strokeWidth={1.75} />
            </button>
          </div>
        </div>
        <div className="t-meta">
          <span>{frequencyText}</span>
          <span>
            {dict.recurring.nextRunLabel}: {rule.next_run_at}
          </span>
          <label className="checklist-checkbox-label">
            <input
              type="checkbox"
              checked={rule.active}
              disabled={isPending}
              onChange={handleToggle}
              data-testid="rule-active-toggle"
            />
            {dict.recurring.activeLabel}
          </label>
        </div>
      </div>
    </div>
  );
}

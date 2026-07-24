'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import type { RecurringRuleFormState } from './rules-actions';

const initialState: RecurringRuleFormState = { error: null };

const WEEKDAYS = [1, 2, 3, 4, 5] as const;

export function RecurringRuleForm({
  action,
  templates,
  onSaved,
}: {
  action: (prevState: RecurringRuleFormState, formData: FormData) => Promise<RecurringRuleFormState>;
  templates: { id: string; title: string }[];
  onSaved?: () => void;
}) {
  const dict = useDictionary();
  const [state, formAction, pending] = useActionState(action, initialState);
  const [frequency, setFrequency] = useState('daily');
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending && !state.error) {
      formRef.current?.reset();
      setFrequency('daily');
      onSaved?.();
    }
    wasPending.current = pending;
  }, [pending, state.error, onSaved]);

  return (
    <form ref={formRef} className="form-card" action={formAction}>
      {state.error && <div className="error-note">{state.error}</div>}
      <div className="field">
        <label>{dict.recurring.templateLabel}</label>
        <select name="templateId" required defaultValue="">
          <option value="" disabled>
            {dict.recurring.templatePlaceholder}
          </option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title}
            </option>
          ))}
        </select>
      </div>
      <div className="row2">
        <div className="field">
          <label>{dict.recurring.frequencyLabel}</label>
          <select name="frequency" value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="daily">{dict.recurring.daily}</option>
            <option value="weekly">{dict.recurring.weekly}</option>
            <option value="monthly">{dict.recurring.monthly}</option>
          </select>
        </div>
        {frequency === 'weekly' && (
          <div className="field">
            <label>{dict.recurring.weekdayLabel}</label>
            <select name="weekday" defaultValue="1">
              {WEEKDAYS.map((w) => (
                <option key={w} value={w}>
                  {dict.recurring.weekdays[w]}
                </option>
              ))}
            </select>
          </div>
        )}
        {frequency === 'monthly' && (
          <div className="field">
            <label>{dict.recurring.dayOfMonthLabel}</label>
            <input type="number" name="dayOfMonth" min={1} max={31} defaultValue={1} />
          </div>
        )}
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={pending} type="submit">
          {pending && <span className="btn-spinner" />}
          {dict.recurring.addButton}
        </button>
      </div>
    </form>
  );
}

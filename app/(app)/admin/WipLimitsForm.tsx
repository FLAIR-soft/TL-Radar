'use client';

import { useState, useTransition } from 'react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from '@/components/ToastProvider';
import { updateWipLimit } from '@/app/(app)/dashboard/wip-actions';
import { STATUS_COLOR } from '@/lib/logic/tasks';
import type { WipLimit, WipStatus } from '@/lib/supabase/types';

// Порядок колонок канбана плюс «Erledigt». Реально показываются только те
// статусы, под которые в wip_limits есть строка: до применения миграции
// 0033 её нет у 'done', и четвёртое поле просто не появляется — вместо
// того чтобы падать на CHECK-констрейнте при сохранении.
const STATUS_ORDER: WipStatus[] = ['waiting', 'in_progress', 'paused', 'done'];

export function WipLimitsForm({ limits }: { limits: WipLimit[] }) {
  const dict = useDictionary();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const byStatus = new Map(limits.map((l) => [l.status, l.limit_count]));
  const statuses = STATUS_ORDER.filter((s) => byStatus.has(s));
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(statuses.map((s) => [s, byStatus.get(s)?.toString() ?? '']))
  );

  // Одна кнопка на весь ряд (скрин 06): сохраняем все статусы разом, каждый
  // своим вызовом того же серверного экшена — сам экшен не менялся.
  function handleSaveAll() {
    startTransition(() => {
      Promise.all(
        statuses.map((status) => {
          const raw = (values[status] ?? '').trim();
          return updateWipLimit(status, raw ? Number(raw) : null);
        })
      ).then((results) => {
        const failed = results.find((r) => r?.error);
        if (failed?.error) toast.error(failed.error);
        else toast.success(dict.wipLimits.saved);
      });
    });
  }

  return (
    <div className="wip-limits-form">
      {statuses.map((status) => (
        <div className="wip-limit-field" key={status}>
          <span className="wip-limit-label">
            <span className="status-dot" style={{ background: STATUS_COLOR[status] }} />
            {dict.status[status]}
          </span>
          <input
            type="number"
            min={1}
            step={1}
            value={values[status] ?? ''}
            onChange={(e) => setValues((prev) => ({ ...prev, [status]: e.target.value }))}
            placeholder={dict.wipLimits.noLimit}
            data-testid={`wip-limit-input-${status}`}
          />
        </div>
      ))}
      <button
        type="button"
        className="btn btn-dark wip-limits-save"
        disabled={isPending}
        onClick={handleSaveAll}
        data-testid="wip-limit-save"
      >
        {dict.wipLimits.save}
      </button>
    </div>
  );
}

'use client';

import { useState, useTransition } from 'react';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { useToast } from '@/components/ToastProvider';
import { updateWipLimit } from '@/app/(app)/dashboard/wip-actions';
import type { WipLimit, WipStatus } from '@/lib/supabase/types';

const STATUSES: WipStatus[] = ['waiting', 'in_progress', 'paused'];

export function WipLimitsForm({ limits }: { limits: WipLimit[] }) {
  const dict = useDictionary();
  const toast = useToast();
  const [isPending, startTransition] = useTransition();
  const byStatus = new Map(limits.map((l) => [l.status, l.limit_count]));
  const [values, setValues] = useState<Record<WipStatus, string>>({
    waiting: byStatus.get('waiting')?.toString() ?? '',
    in_progress: byStatus.get('in_progress')?.toString() ?? '',
    paused: byStatus.get('paused')?.toString() ?? '',
  });

  function handleSave(status: WipStatus) {
    const raw = values[status].trim();
    const limit = raw ? Number(raw) : null;
    startTransition(() => {
      updateWipLimit(status, limit).then((result) => {
        if (result?.error) toast.error(result.error);
        else toast.success(dict.wipLimits.saved);
      });
    });
  }

  return (
    <div className="wip-limits-form">
      {STATUSES.map((status) => (
        <div className="wip-limit-row" key={status}>
          <span className="wip-limit-label">{dict.status[status]}</span>
          <input
            type="number"
            min={1}
            step={1}
            value={values[status]}
            onChange={(e) => setValues((prev) => ({ ...prev, [status]: e.target.value }))}
            placeholder={dict.wipLimits.noLimit}
            data-testid={`wip-limit-input-${status}`}
          />
          <button
            type="button"
            className="btn btn-ghost"
            disabled={isPending}
            onClick={() => handleSave(status)}
            data-testid={`wip-limit-save-${status}`}
          >
            {dict.wipLimits.save}
          </button>
        </div>
      ))}
    </div>
  );
}

'use client';

import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDuration } from '@/lib/logic/tasks';
import type { PersonStat } from '@/lib/logic/analytics';

export function AnalyticsStats({
  stats,
  availableMs,
}: {
  stats: PersonStat[];
  availableMs: number;
}) {
  const dict = useDictionary();

  return (
    <div>
      <div className="stat-rows-caption">
        {dict.analytics.availableLabel}: <span className="mono">{fmtDuration(availableMs, dict.duration)}</span>
      </div>
      <div className="stat-rows">
        {stats.map((s) => {
          const pct = availableMs > 0 ? (s.workedMs / availableMs) * 100 : 0;
          const over = pct > 100;
          return (
            <div className="stat-row" key={s.id}>
              <div className="stat-row-head">
                <span className="stat-row-name">{s.name}</span>
                <span className="stat-row-value mono">{fmtDuration(s.workedMs, dict.duration)}</span>
              </div>
              <div className="stat-bar-track">
                <div
                  className={`stat-bar-fill ${over ? 'stat-bar-over' : ''}`}
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className="stat-row-foot mono">
                {Math.round(pct)}
                {dict.analytics.colPercent}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

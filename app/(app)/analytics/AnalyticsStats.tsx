'use client';

import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDuration } from '@/lib/logic/tasks';
import { remainingCapacityPercent, type PersonStat } from '@/lib/logic/analytics';

export function AnalyticsStats({
  stats,
  availableMs,
}: {
  stats: PersonStat[];
  availableMs: number;
}) {
  const dict = useDictionary();

  return (
    <div className="stat-card">
      <div className="stat-rows-caption">
        {dict.analytics.availableLabel}: <span className="mono">{fmtDuration(availableMs, dict.duration)}</span>
      </div>
      <div className="stat-rows">
        {stats.map((s) => {
          const pct = remainingCapacityPercent(s.workedMs, availableMs);
          const over = pct < 0;
          const zero = s.workedMs === 0;
          return (
            <div className={`stat-row ${zero ? 'stat-row-zero' : ''}`} key={s.id}>
              <div className="stat-row-head">
                <span className="stat-row-name">{s.name}</span>
                <span className="stat-row-value mono">{fmtDuration(s.workedMs, dict.duration)}</span>
              </div>
              <div className="stat-bar-track">
                <div
                  className={`stat-bar-fill ${over ? 'stat-bar-over' : ''}`}
                  // Negative remaining capacity has no natural bar width of
                  // its own — clamping to 0 would render an empty track with
                  // no visible warning color at all. Filling it completely
                  // instead reads as "capacity used up, and then some",
                  // which the row's own (possibly negative) percentage text
                  // still spells out precisely.
                  style={{ width: `${over ? 100 : Math.min(100, pct)}%` }}
                />
              </div>
              <div className={`stat-row-foot mono ${over ? 'stat-row-foot-over' : ''}`}>
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

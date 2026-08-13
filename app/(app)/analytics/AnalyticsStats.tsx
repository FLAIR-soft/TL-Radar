'use client';

import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDuration } from '@/lib/logic/tasks';
import { workedPercent, type PersonStat } from '@/lib/logic/analytics';

export function AnalyticsStats({ stats, availableMs }: { stats: PersonStat[]; availableMs: number }) {
  const dict = useDictionary();

  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div className="stat-rows-caption">
          {dict.analytics.availableInRange}: <span className="mono">{fmtDuration(availableMs, dict.duration)}</span>
        </div>
        <div className="stat-card-eyebrow mono">{dict.analytics.workedEyebrow}</div>
      </div>
      <div className="stat-rows">
        {stats.map((s) => {
          // Прямая шкала: процент отработанного, а не свободной ёмкости
          // (откат K3). Больше 100 % — переработка, полоса и подпись краснеют.
          const pct = workedPercent(s.workedMs, availableMs);
          const over = pct > 100;
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
                  style={{ width: `${Math.min(100, pct)}%` }}
                />
              </div>
              <div className={`stat-row-foot mono ${over ? 'stat-row-foot-over' : ''}`}>
                {Math.round(pct)} {dict.analytics.colPercent}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

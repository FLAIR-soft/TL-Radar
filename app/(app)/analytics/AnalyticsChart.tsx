'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from 'recharts';
import { useDictionary } from '@/lib/i18n/LocaleContext';
import { fmtDuration } from '@/lib/logic/tasks';
import type { PersonStat } from '@/lib/logic/analytics';

export function AnalyticsChart({
  stats,
  availableMs,
}: {
  stats: PersonStat[];
  availableMs: number;
}) {
  const dict = useDictionary();
  const availableHours = availableMs / 3600000;

  const data = stats.map((s) => ({
    name: s.name,
    hours: Math.round((s.workedMs / 3600000) * 10) / 10,
    workedMs: s.workedMs,
  }));

  return (
    <div>
      <div className="analytics-chart">
        <ResponsiveContainer width="100%" height={Math.max(220, data.length * 44)}>
          <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 12 }} />
            <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12.5 }} />
            <Tooltip
              formatter={(_value, _name, item) => [
                fmtDuration(item.payload.workedMs, dict.duration),
                dict.analytics.workedLabel,
              ]}
            />
            <ReferenceLine
              x={availableHours}
              stroke="var(--brand)"
              strokeDasharray="4 4"
              label={{ value: dict.analytics.availableLabel, position: 'insideTopRight', fill: 'var(--brand-dark)', fontSize: 11 }}
            />
            <Bar dataKey="hours" fill="var(--progress)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="analytics-table-wrap">
        <table className="archive-table">
          <thead>
            <tr>
              <th>{dict.analytics.colPerson}</th>
              <th>{dict.analytics.colWorked}</th>
              <th>{dict.analytics.colPercent}</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <tr key={s.id} className="archive-row">
                <td>{s.name}</td>
                <td className="mono">{fmtDuration(s.workedMs, dict.duration)}</td>
                <td className="mono">
                  {availableMs > 0 ? `${Math.round((s.workedMs / availableMs) * 100)}%` : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

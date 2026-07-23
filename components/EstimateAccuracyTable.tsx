import type { EstimateAccuracyStat } from '@/lib/logic/estimate-accuracy';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

export function EstimateAccuracyTable({ stats, dict }: { stats: EstimateAccuracyStat[]; dict: Dictionary }) {
  if (stats.length === 0) {
    return <div className="empty-note">{dict.analytics.estimateAccuracyEmpty}</div>;
  }

  return (
    <div className="archive-scroll">
      <table className="archive-table">
        <thead>
          <tr>
            <th>{dict.analytics.colPerson}</th>
            <th>{dict.analytics.estimateAccuracyColCount}</th>
            <th>{dict.analytics.estimateAccuracyColRatio}</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((s) => {
            const pct = Math.round(s.avgRatio * 100);
            const over = pct > 115;
            const under = pct < 85;
            const color = over ? 'var(--priority-urgent)' : under ? 'var(--done)' : 'var(--waiting)';
            return (
              <tr className="archive-row" key={s.id}>
                <td>{s.name}</td>
                <td>{s.taskCount}</td>
                <td>
                  <span className="pill" style={{ ['--pill-color' as string]: color }}>
                    {pct}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

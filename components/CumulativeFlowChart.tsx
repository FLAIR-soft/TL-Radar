import { STATUS_COLOR, fmtDateShort } from '@/lib/logic/tasks';
import type { DailyStatusCounts } from '@/lib/logic/cumulative-flow';
import type { TaskStatus } from '@/lib/supabase/types';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

// Снизу вверх, как на скрине 01: Erledigt, Pausiert, In Bearbeitung, Wartend.
const STACK_ORDER: TaskStatus[] = ['done', 'paused', 'in_progress', 'waiting'];

// Столбчатая диаграмма с накоплением на div'ах (редизайн v2, этап 9): по
// колонке на день, сегменты снизу вверх, у верхнего скруглён верх. Раньше
// это был SVG с областями. Данные берутся из computeCumulativeFlow как есть.
export function CumulativeFlowChart({
  data,
  dict,
  title,
  subtitle,
}: {
  data: DailyStatusCounts[];
  dict: Dictionary;
  title: string;
  subtitle: string;
}) {
  if (data.length === 0) return null;

  const maxTotal = Math.max(1, ...data.map((d) => d.waiting + d.in_progress + d.paused + d.done));

  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <h3 className="stat-card-title">{title}</h3>
          <p className="stat-card-sub">{subtitle}</p>
        </div>
        <div className="cfd-legend">
          {[...STACK_ORDER].reverse().map((status) => (
            <span key={status} className="cfd-legend-item">
              <span className="cfd-legend-swatch" style={{ background: STATUS_COLOR[status] }} />
              {dict.status[status]}
            </span>
          ))}
        </div>
      </div>
      <div className="cfd-columns" role="img" aria-label={title}>
        {data.map((d) => {
          const segments = STACK_ORDER.map((status) => ({ status, value: d[status] })).filter((s) => s.value > 0);
          return (
            <div className="cfd-column" key={d.date}>
              <div className="cfd-stack">
                {segments.map(({ status, value }, i) => (
                  <span
                    key={status}
                    className={`cfd-segment ${i === segments.length - 1 ? 'cfd-segment-top' : ''}`}
                    style={{ height: `${(value / maxTotal) * 100}%`, background: STATUS_COLOR[status] }}
                    title={`${dict.status[status]}: ${value}`}
                  />
                ))}
              </div>
              {/* d.date — ISO «2026-08-07»; под графиком нужна короткая
                  локальная дата, как на скрине 01. */}
              <span className="cfd-date mono">{fmtDateShort(d.date, dict.intlLocale)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

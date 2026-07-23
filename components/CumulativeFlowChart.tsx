import { STATUS_COLOR } from '@/lib/logic/tasks';
import type { DailyStatusCounts } from '@/lib/logic/cumulative-flow';
import type { TaskStatus } from '@/lib/supabase/types';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

const STACK_ORDER: TaskStatus[] = ['done', 'paused', 'in_progress', 'waiting'];

const WIDTH = 720;
const HEIGHT = 220;
const PADDING = { top: 10, right: 10, bottom: 22, left: 10 };
const INNER_W = WIDTH - PADDING.left - PADDING.right;
const INNER_H = HEIGHT - PADDING.top - PADDING.bottom;

export function CumulativeFlowChart({ data, dict }: { data: DailyStatusCounts[]; dict: Dictionary }) {
  if (data.length === 0) return null;

  const maxTotal = Math.max(1, ...data.map((d) => d.waiting + d.in_progress + d.paused + d.done));
  const stepX = data.length > 1 ? INNER_W / (data.length - 1) : 0;

  function yFor(value: number): number {
    return PADDING.top + INNER_H - (value / maxTotal) * INNER_H;
  }

  const stackedPoints = data.map((d, i) => {
    let cum = 0;
    const layers = STACK_ORDER.map((status) => {
      const base = cum;
      cum += d[status];
      return { status, base, top: cum };
    });
    return { x: PADDING.left + i * stepX, layers };
  });

  function areaPath(bandIndex: number): string {
    const top = stackedPoints.map((p) => `${p.x},${yFor(p.layers[bandIndex].top)}`);
    const base = [...stackedPoints].reverse().map((p) => `${p.x},${yFor(p.layers[bandIndex].base)}`);
    return `M ${top.join(' L ')} L ${base.join(' L ')} Z`;
  }

  return (
    <div className="cfd-wrap">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="cfd-svg" role="img" aria-label={dict.analytics.cumulativeFlowTitle}>
        {STACK_ORDER.map((status, i) => (
          <path key={status} d={areaPath(i)} fill={STATUS_COLOR[status]} opacity={0.85} />
        ))}
      </svg>
      <div className="cfd-axis">
        <span>{data[0].date}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
      <div className="cfd-legend">
        {STACK_ORDER.map((status) => (
          <span key={status} className="cfd-legend-item">
            <span className="cfd-legend-swatch" style={{ background: STATUS_COLOR[status] }} />
            {dict.status[status]}
          </span>
        ))}
      </div>
    </div>
  );
}

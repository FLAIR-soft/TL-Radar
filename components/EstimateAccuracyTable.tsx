import type { EstimateAccuracyStat } from '@/lib/logic/estimate-accuracy';
import type { Dictionary } from '@/lib/i18n/get-dictionary';

// Насколько сильное отклонение считаем «попал в оценку»: внутри ±15 %
// дорожка зелёная, дальше — красная при перерасходе и синяя при недооценке
// (скрин 01). Сам расчёт (computeEstimateAccuracy) не трогаем.
const NEAR = 0.15;
// До какого отклонения дорожка заполняется целиком: 2× в любую сторону.
const FULL_DEVIATION = 1;

export function EstimateAccuracyTable({
  stats,
  dict,
  title,
  subtitle,
}: {
  stats: EstimateAccuracyStat[];
  dict: Dictionary;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="stat-card">
      <div className="stat-card-head">
        <div>
          <h3 className="stat-card-title">{title}</h3>
          <p className="stat-card-sub">{subtitle}</p>
        </div>
      </div>
      {stats.length === 0 ? (
        <div className="empty-note">{dict.analytics.estimateAccuracyEmpty}</div>
      ) : (
        <div className="ea-table">
          <div className="ea-head">
            <span>{dict.analytics.colPerson}</span>
            <span className="ta-right">{dict.analytics.estimateAccuracyColCount}</span>
            <span>{dict.analytics.estimateAccuracyColDistribution}</span>
            <span className="ta-right">{dict.analytics.estimateAccuracyColRatio}</span>
          </div>
          {stats.map((s) => {
            const deviation = s.avgRatio - 1;
            const over = deviation > NEAR;
            const under = deviation < -NEAR;
            const tone = over ? 'is-over' : under ? 'is-under' : 'is-near';
            // Половина дорожки на сторону: центр = оценка 1,0×.
            const width = Math.min(50, (Math.abs(deviation) / FULL_DEVIATION) * 50);
            return (
              <div className="ea-row" key={s.id}>
                <span className="ea-name">{s.name}</span>
                <span className="mono ta-right">{s.taskCount}</span>
                <span className="ea-track">
                  <span className="ea-axis" />
                  <span className="ea-tick" />
                  <span
                    className={`ea-bar ${tone}`}
                    style={
                      deviation >= 0
                        ? { left: '50%', width: `${width}%` }
                        : { right: '50%', width: `${width}%` }
                    }
                  />
                </span>
                <span className={`mono ea-value ${tone}`}>
                  {s.avgRatio.toLocaleString(dict.intlLocale, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{' '}
                  ×
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

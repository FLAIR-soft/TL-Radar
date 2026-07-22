export default function AnalyticsLoading() {
  return (
    <div className="page-fade">
      <div className="skeleton skeleton-title-bar" />
      <div className="skeleton skeleton-sub-bar" />
      <div className="period-switcher">
        {[0, 1, 2].map((tab) => (
          <div className="skeleton" key={tab} style={{ width: 64, height: 32, borderRadius: 8 }} />
        ))}
      </div>
      <div className="skeleton skeleton-line" style={{ width: 140, height: 12, margin: '14px 0' }} />
      <div className="stat-rows">
        {[0, 1, 2].map((row) => (
          <div className="stat-row" key={row}>
            <div className="stat-row-head">
              <div className="skeleton skeleton-line" style={{ width: 120, height: 13, marginBottom: 0 }} />
              <div className="skeleton skeleton-line" style={{ width: 40, height: 13, marginBottom: 0 }} />
            </div>
            <div className="skeleton" style={{ height: 6, borderRadius: 999 }} />
            <div className="skeleton skeleton-line" style={{ width: 70, height: 11, marginTop: 6, marginBottom: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function DashboardLoading() {
  return (
    <div className="page-fade">
      <div className="skeleton skeleton-title-bar" />
      <div className="skeleton skeleton-sub-bar" />
      <div className="kanban">
        {[0, 1, 2].map((col) => (
          <div className="kanban-col" key={col}>
            <div className="col-head">
              <span className="skeleton" style={{ width: 9, height: 9, borderRadius: '50%' }} />
              <span className="skeleton" style={{ width: 80, height: 12 }} />
            </div>
            <div className="card-stack">
              {[0, 1].map((card) => (
                <div className="skeleton-card" key={card}>
                  <div className="skeleton skeleton-line" style={{ width: '40%' }} />
                  <div className="skeleton skeleton-line" style={{ width: '75%', height: 14 }} />
                  <div className="skeleton skeleton-line" style={{ width: '55%' }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

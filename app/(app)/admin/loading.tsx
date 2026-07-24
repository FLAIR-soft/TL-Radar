export default function AdminLoading() {
  return (
    <div className="page-fade">
      <div className="skeleton skeleton-title-bar" />
      <div className="skeleton skeleton-sub-bar" />
      <div className="admin-list">
        {[0, 1, 2].map((row) => (
          <div className="admin-row" key={row}>
            <div className="admin-row-info">
              <div className="skeleton skeleton-line" style={{ width: 130, height: 14, marginBottom: 0 }} />
              <div className="skeleton" style={{ width: 60, height: 20, borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div className="skeleton" style={{ width: 160, height: 36 }} />
              <div className="skeleton" style={{ width: 140, height: 36 }} />
              <div className="skeleton" style={{ width: 30, height: 30 }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

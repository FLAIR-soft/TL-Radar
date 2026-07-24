export default function TemplatesLoading() {
  return (
    <div className="page-fade">
      <div className="skeleton skeleton-title-bar" />
      <div className="skeleton skeleton-sub-bar" />
      <div className="project-list">
        {[0, 1].map((row) => (
          <div className="skeleton-card" key={row}>
            <div className="skeleton skeleton-line" style={{ width: '30%', height: 14 }} />
            <div className="skeleton skeleton-line" style={{ width: '60%' }} />
            <div className="skeleton skeleton-line" style={{ width: '35%', marginBottom: 0 }} />
          </div>
        ))}
      </div>
      <div className="page-header">
        <div className="skeleton skeleton-title-bar" style={{ width: 140 }} />
      </div>
      <div className="project-list">
        {[0, 1].map((row) => (
          <div className="skeleton-card" key={row}>
            <div className="skeleton skeleton-line" style={{ width: '40%', height: 14 }} />
            <div className="skeleton skeleton-line" style={{ width: '50%', marginBottom: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

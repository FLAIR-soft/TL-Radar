export default function ProjectsLoading() {
  return (
    <div className="page-fade">
      <div className="page-header">
        <div>
          <div className="skeleton skeleton-title-bar" />
          <div className="skeleton skeleton-sub-bar" />
        </div>
        <div className="skeleton" style={{ height: 40, width: 160, flexShrink: 0 }} />
      </div>
      <div className="project-list">
        {[0, 1].map((row) => (
          <div className="skeleton-card" key={row}>
            <div className="skeleton skeleton-line" style={{ width: '30%', height: 14 }} />
            <div className="skeleton skeleton-line" style={{ width: '60%' }} />
            <div className="skeleton skeleton-line" style={{ width: '35%', marginBottom: 0 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

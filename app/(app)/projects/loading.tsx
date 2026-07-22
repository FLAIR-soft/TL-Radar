export default function ProjectsLoading() {
  return (
    <div className="page-fade">
      <div className="skeleton skeleton-title-bar" />
      <div className="skeleton skeleton-sub-bar" />
      <div className="form-card project-form">
        <div className="field">
          <div className="skeleton skeleton-line" style={{ width: 100, height: 12 }} />
          <div className="skeleton" style={{ height: 38 }} />
        </div>
        <div className="row2">
          <div className="field">
            <div className="skeleton skeleton-line" style={{ width: 60, height: 12 }} />
            <div className="skeleton" style={{ height: 38 }} />
          </div>
          <div className="field">
            <div className="skeleton skeleton-line" style={{ width: 90, height: 12 }} />
            <div className="skeleton" style={{ height: 38 }} />
          </div>
        </div>
        <div className="field">
          <div className="skeleton skeleton-line" style={{ width: 80, height: 12 }} />
          <div className="skeleton" style={{ height: 60 }} />
        </div>
        <div className="skeleton" style={{ height: 40, width: 160 }} />
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

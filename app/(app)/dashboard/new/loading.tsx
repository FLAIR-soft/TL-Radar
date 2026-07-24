export default function NewTaskLoading() {
  return (
    <div className="page-fade">
      <div className="skeleton skeleton-title-bar" />
      <div className="skeleton skeleton-sub-bar" />
      <div className="form-card">
        <div className="row2">
          <div className="field">
            <div className="skeleton skeleton-line" style={{ width: 60, height: 12 }} />
            <div className="skeleton" style={{ height: 38 }} />
          </div>
          <div className="field">
            <div className="skeleton skeleton-line" style={{ width: 60, height: 12 }} />
            <div className="skeleton" style={{ height: 38 }} />
          </div>
        </div>
        <div className="field">
          <div className="skeleton skeleton-line" style={{ width: 120, height: 12 }} />
          <div className="skeleton" style={{ height: 38 }} />
        </div>
        <div className="field">
          <div className="skeleton skeleton-line" style={{ width: 90, height: 12 }} />
          <div className="skeleton" style={{ height: 70 }} />
        </div>
        <div className="field">
          <div className="skeleton skeleton-line" style={{ width: 140, height: 12 }} />
          <div className="skeleton" style={{ height: 38 }} />
        </div>
        <div className="skeleton" style={{ height: 40, width: 160 }} />
      </div>
    </div>
  );
}

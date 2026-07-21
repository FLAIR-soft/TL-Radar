export default function ArchiveLoading() {
  return (
    <div className="page-fade">
      <div className="skeleton skeleton-title-bar" />
      <div className="skeleton skeleton-sub-bar" />
      <div className="archive-scroll">
        <div className="archive-table" style={{ overflow: 'hidden' }}>
          {[0, 1, 2, 3].map((row) => (
            <div className="skeleton-table-row" key={row}>
              <div className="skeleton skeleton-line" style={{ margin: 0, width: '80%' }} />
              <div className="skeleton skeleton-line" style={{ margin: 0, width: '60%' }} />
              <div className="skeleton skeleton-line" style={{ margin: 0, width: '70%' }} />
              <div className="skeleton skeleton-line" style={{ margin: 0, width: '70%' }} />
              <div className="skeleton skeleton-line" style={{ margin: 0, width: '70%' }} />
              <div className="skeleton skeleton-line" style={{ margin: 0, width: '85%' }} />
              <div className="skeleton skeleton-line" style={{ margin: 0, width: '50%' }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

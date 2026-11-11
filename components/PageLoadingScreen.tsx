export function PageLoadingScreen() {
  return (
    <main className="loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-panel">
        <div className="loading-mark" aria-hidden="true">
          <span className="loading-mark__letters">RF</span>
          <span className="loading-mark__ring" />
        </div>
        <p className="loading-title">ReviewFlow</p>
        <p className="loading-caption">Preparing your page</p>
        <span className="loading-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";

export function PageLoadingScreen() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const estimate = Math.min(96, Math.round(96 * (1 - Math.exp(-elapsed / 2800))));
      setProgress((current) => Math.max(current, estimate));
      if (estimate === 96) window.clearInterval(timer);
    }, 120);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="loading-screen" role="status" aria-live="polite" aria-busy="true">
      <div className="loading-panel">
        <div className="loading-mark" aria-hidden="true">
          <span className="loading-mark__logo" />
          <span className="loading-mark__ring" />
        </div>
        <p className="loading-title">ReviewFlow</p>
        <p className="loading-caption">Loading your experience</p>
        <div className="loading-progress-meta">
          <span>Preparing your page</span>
          <span className="loading-percent" aria-hidden="true">{progress}%</span>
        </div>
        <div
          className="loading-progress"
          role="progressbar"
          aria-label="Loading your experience"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <span style={{ width: `${progress}%` }} />
        </div>
        <div className="loading-dots" aria-hidden="true"><span /><span /><span /></div>
      </div>
    </main>
  );
}

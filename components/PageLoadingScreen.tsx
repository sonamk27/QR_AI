"use client";

import { useEffect, useState } from "react";

type PageLoadingScreenProps = {
  restaurantName?: string;
  brandColor?: string;
  accentColor?: string;
  softColor?: string;
};

export function PageLoadingScreen({
  restaurantName,
  brandColor = "#B58A4B",
  accentColor = "#9E7438",
  softColor = "#FAF5ED",
}: PageLoadingScreenProps = {}) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const startedAt = Date.now();
    const timer = window.setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const estimate = Math.min(96, Math.round(96 * (1 - Math.exp(-elapsed / 2600))));
      setProgress((current) => Math.max(current, estimate));
      if (estimate === 96) window.clearInterval(timer);
    }, 120);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <main className="loading-screen" role="status" aria-live="polite" aria-busy="true" style={{ background: `radial-gradient(circle at 50% 42%, #FFFFFF 0%, ${softColor} 70%)` }}>
      <div className="loading-panel">
        <div className="loading-mark" aria-hidden="true">
          <span className="loading-mark__logo" />
          <span className="loading-mark__ring" style={{ borderTopColor: brandColor }} />
        </div>
        <p className="loading-title">{restaurantName ? `Welcome to ${restaurantName}` : "ReviewFlow"}</p>
        <p className="loading-caption">Preparing your experience</p>
        <div className="loading-progress-meta">
          <span>Loading your page</span>
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
          <span style={{ width: `${progress}%`, background: `linear-gradient(90deg, ${brandColor}, ${accentColor})` }} />
        </div>
        <div className="loading-dots" aria-hidden="true"><span /><span /><span /></div>
      </div>
    </main>
  );
}

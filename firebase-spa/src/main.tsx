import React from "react";
import { createRoot } from "react-dom/client";
import "./fonts.css";
import "../../app/globals.css";
import App from "./App";

const preloadErrorRecoveryKey = "vite:preload-error-recovery";

window.addEventListener("vite:preloadError", (event) => {
  if (sessionStorage.getItem(preloadErrorRecoveryKey)) return;
  event.preventDefault();
  sessionStorage.setItem(preloadErrorRecoveryKey, "reloading");
  window.setTimeout(() => sessionStorage.removeItem(preloadErrorRecoveryKey), 30_000);
  window.location.reload();
});

const root = document.getElementById("root");
if (!root) throw new Error("Missing app root element.");

createRoot(root).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

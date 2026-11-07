import { existsSync } from "node:fs";

// Firebase's local admin scripts run through tsx rather than Next/Vite, so load
// their local environment files explicitly. Keep shell-provided values intact.
for (const path of [".env.local", ".env"]) {
  if (existsSync(path)) process.loadEnvFile(path);
}

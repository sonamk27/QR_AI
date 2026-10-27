import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const standaloneDir = resolve(".next/standalone");
const standaloneNextDir = resolve(standaloneDir, ".next");
const staticDir = resolve(".next/static");
const publicDir = resolve("public");

if (!existsSync(resolve(standaloneDir, "server.js"))) {
  throw new Error("Next.js standalone server was not generated.");
}

mkdirSync(standaloneNextDir, { recursive: true });

if (existsSync(staticDir)) {
  const target = resolve(standaloneNextDir, "static");
  mkdirSync(dirname(target), { recursive: true });
  cpSync(staticDir, target, { recursive: true, force: true });
}

if (existsSync(publicDir)) {
  const target = resolve(standaloneDir, "public");
  cpSync(publicDir, target, { recursive: true, force: true });
}

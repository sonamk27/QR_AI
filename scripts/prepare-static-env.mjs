import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const rootEnvPath = fileURLToPath(new URL("../.env", import.meta.url));
const outputPath = fileURLToPath(new URL("../static-client/.env.local", import.meta.url));
const publicKeys = [
  "NEXT_PUBLIC_FIREBASE_API_KEY",
  "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  "NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  "NEXT_PUBLIC_FIREBASE_APP_ID",
];

let rootEnv = "";
try { rootEnv = await readFile(rootEnvPath, "utf8"); } catch { /* CI can provide the values directly. */ }
const fromRoot = new Map(rootEnv.split(/\r?\n/).map((line) => {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
  if (!match) return ["", ""];
  return [match[1], match[2].replace(/^(['"])(.*)\1$/, "$2")];
}));

const values = publicKeys.map((key) => [key, process.env[key] || fromRoot.get(key) || ""]);
const missing = values.filter(([, value]) => !value).map(([key]) => key);
if (missing.length) throw new Error(`Missing Firebase web app settings: ${missing.join(", ")}`);

await writeFile(outputPath, `${values.map(([key, value]) => `${key}=${value}`).join("\n")}\n`, "utf8");
console.log("Prepared only public Firebase web settings for the static client build.");

import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = fileURLToPath(new URL("./firebase-spa/", import.meta.url));
const projectRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "");
  const secretLikePublicKeys = Object.keys(env).filter(
    (key) =>
      (key.startsWith("VITE_") || key.startsWith("NEXT_PUBLIC_"))
      && /(SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CREDENTIAL|DATABASE_URL)/i.test(key),
  );
  if (secretLikePublicKeys.length) {
    throw new Error(`Do not expose secret-like settings through Vite's public environment prefixes: ${secretLikePublicKeys.join(", ")}`);
  }
  const siteUrl = env.VITE_SITE_URL?.trim()
    || (env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      ? `https://${env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}.web.app`
      : "https://reviewflow-2005.web.app");
  const parsedSiteUrl = siteUrl ? new URL(siteUrl) : null;
  if (parsedSiteUrl && parsedSiteUrl.protocol !== "https:" && parsedSiteUrl.hostname !== "localhost" && parsedSiteUrl.hostname !== "127.0.0.1") {
    throw new Error("VITE_SITE_URL must use HTTPS outside local development.");
  }
  const normalizedSiteUrl = parsedSiteUrl?.origin ?? "";

  return {
    root: appRoot,
    envDir: projectRoot,
    publicDir: fileURLToPath(new URL("./public/", import.meta.url)),
    envPrefix: ["VITE_", "NEXT_PUBLIC_"],
    plugins: [
      react(),
      {
        name: "reviewflow-seo-files",
        transformIndexHtml(html) {
          return html.replaceAll("__SITE_ORIGIN__", normalizedSiteUrl);
        },
        apply: "build",
        generateBundle() {
          const disallowedPaths = ["/dashboard", "/super-admin", "/admin"];
          const robots = [
            "User-agent: *",
            "Allow: /",
            ...disallowedPaths.map((path) => `Disallow: ${path}`),
            ...(normalizedSiteUrl ? [`Sitemap: ${normalizedSiteUrl}/sitemap.xml`] : []),
            "",
          ].join("\n");
          this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });

          if (normalizedSiteUrl) {
            const sitemap = [
              '<?xml version="1.0" encoding="UTF-8"?>',
              '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
                `  <url><loc>${normalizedSiteUrl}/</loc></url>`,
              `  <url><loc>${normalizedSiteUrl}/privacy</loc></url>`,
              `  <url><loc>${normalizedSiteUrl}/terms</loc></url>`,
              "</urlset>",
              "",
            ].join("\n");
            this.emitFile({ type: "asset", fileName: "sitemap.xml", source: sitemap });
          }
        },
      },
    ],
    resolve: {
      alias: {
        "@": projectRoot,
        "next/link": fileURLToPath(new URL("./firebase-spa/src/next-link.tsx", import.meta.url)),
        "next/image": fileURLToPath(new URL("./firebase-spa/src/next-image.tsx", import.meta.url)),
        "next/navigation": fileURLToPath(new URL("./firebase-spa/src/next-navigation.ts", import.meta.url)),
      },
    },
    server: { fs: { allow: [projectRoot] } },
    build: { outDir: "dist", emptyOutDir: true, sourcemap: false },
  };
});

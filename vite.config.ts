import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = fileURLToPath(new URL("./firebase-spa/", import.meta.url));
const projectRoot = fileURLToPath(new URL("./", import.meta.url));

export default defineConfig({
  root: appRoot,
  envDir: projectRoot,
  publicDir: fileURLToPath(new URL("./public/", import.meta.url)),
  envPrefix: ["VITE_", "NEXT_PUBLIC_"],
  plugins: [react()],
  resolve: {
    alias: {
      "@": projectRoot,
      "next/link": fileURLToPath(new URL("./firebase-spa/src/next-link.tsx", import.meta.url)),
      "next/image": fileURLToPath(new URL("./firebase-spa/src/next-image.tsx", import.meta.url)),
      "next/navigation": fileURLToPath(new URL("./firebase-spa/src/next-navigation.ts", import.meta.url)),
    },
  },
  server: { fs: { allow: [projectRoot] } },
  build: { outDir: "dist", emptyOutDir: true },
});

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import sharp from "sharp";

const publicDirectory = fileURLToPath(new URL("../public/", import.meta.url));
const logoPath = path.join(publicDirectory, "logo.png");
const logoSvg = await readFile(path.join(publicDirectory, "logo.svg"));
const logoPng = await sharp(logoSvg, { density: 192 })
  .resize(256, 256, { fit: "contain" })
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();
await writeFile(logoPath, logoPng);

const socialImageSvg = await readFile(path.join(publicDirectory, "social-share.svg"));
const socialImagePng = await sharp(socialImageSvg, { density: 144 })
  .resize(1200, 630, { fit: "cover" })
  .png({ compressionLevel: 9, effort: 10 })
  .toBuffer();
const socialImagePath = path.join(publicDirectory, "social-share.png");
await writeFile(socialImagePath, socialImagePng);

console.log(`Generated ReviewFlow logo: ${logoPng.length} bytes; social preview: ${socialImagePng.length} bytes.`);

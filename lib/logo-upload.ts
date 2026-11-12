import { isSupportedLogoDataUrl } from "./logo-url";

export async function prepareLogoUpload(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
    throw new Error("Choose a PNG, JPG, or WebP image.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Logo image must be 5 MB or smaller.");
  }

  const image = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / Math.max(image.width, image.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Could not prepare this image. Try another file.");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    for (const quality of [0.82, 0.68, 0.52]) {
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", quality));
      if (!blob) throw new Error("Could not prepare this image. Try another file.");
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Could not read the logo image."));
        reader.onerror = () => reject(new Error("Could not read the logo image."));
        reader.readAsDataURL(blob);
      });
      if (isSupportedLogoDataUrl(dataUrl)) return dataUrl;
    }
  } finally {
    image.close();
  }
  throw new Error("This logo is too detailed to save. Try a smaller or simpler image.");
}

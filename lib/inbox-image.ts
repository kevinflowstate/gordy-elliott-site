const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_OUTPUT_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2048;

export interface PreparedInboxImage {
  file: File;
  width: number;
  height: number;
  previewUrl: string;
}

function loadHtmlImage(url: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("This photo format could not be opened. Choose a JPEG or PNG photo."));
    image.src = url;
  });
}

export async function prepareInboxImage(source: File): Promise<PreparedInboxImage> {
  if (!source.type.startsWith("image/")) throw new Error("Choose a photo to send.");
  if (source.size < 1 || source.size > MAX_SOURCE_BYTES) throw new Error("Photos must be under 20MB.");

  const sourceUrl = URL.createObjectURL(source);
  try {
    const image = await loadHtmlImage(sourceUrl);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This photo could not be prepared.");
    context.fillStyle = "#000";
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.84));
    if (!blob || blob.size < 1) throw new Error("This photo could not be prepared.");
    if (blob.size > MAX_OUTPUT_BYTES) throw new Error("This photo is still too large after resizing. Choose a smaller photo.");

    const file = new File([blob], "dm-photo.jpg", { type: "image/jpeg", lastModified: Date.now() });
    return { file, width, height, previewUrl: URL.createObjectURL(blob) };
  } finally {
    URL.revokeObjectURL(sourceUrl);
  }
}

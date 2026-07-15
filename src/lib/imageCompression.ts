const MAX_WIDTH = 1600;
const MAX_HEIGHT = 900;
const INITIAL_QUALITY = 0.7;
const MIN_QUALITY = 0.35;
const TARGET_MAX_BYTES = 350 * 1024; // aim for ≤350KB per image
const QUALITY_STEP = 0.1;

export interface CompressedImage {
  file: File;
  preview: string;
}

const loadImage = (file: File): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image"));
    img.src = URL.createObjectURL(file);
  });

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Failed to compress image"))),
      "image/jpeg",
      quality
    );
  });

export const compressImage = async (
  file: File,
  maxWidth = MAX_WIDTH,
  maxHeight = MAX_HEIGHT,
  quality = INITIAL_QUALITY
): Promise<CompressedImage> => {
  const img = await loadImage(file);
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get canvas context");

  let { width, height } = img;
  if (width > maxWidth || height > maxHeight) {
    const ratio = Math.min(maxWidth / width, maxHeight / height);
    width = Math.round(width * ratio);
    height = Math.round(height * ratio);
  }
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  URL.revokeObjectURL(img.src);

  // Iteratively drop quality until under target size
  let currentQuality = quality;
  let blob = await canvasToBlob(canvas, currentQuality);

  while (blob.size > TARGET_MAX_BYTES && currentQuality > MIN_QUALITY) {
    currentQuality = Math.max(MIN_QUALITY, currentQuality - QUALITY_STEP);
    blob = await canvasToBlob(canvas, currentQuality);
  }

  // Still too big at min quality? Shrink dimensions further and retry once.
  if (blob.size > TARGET_MAX_BYTES) {
    const shrink = 0.8;
    canvas.width = Math.round(width * shrink);
    canvas.height = Math.round(height * shrink);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    blob = await canvasToBlob(canvas, MIN_QUALITY);
    currentQuality = MIN_QUALITY;
  }

  const compressedFile = new File(
    [blob],
    file.name.replace(/\.[^.]+$/, "") + ".jpg",
    { type: "image/jpeg", lastModified: Date.now() }
  );

  return {
    file: compressedFile,
    preview: canvas.toDataURL("image/jpeg", currentQuality),
  };
};

export const compressImages = async (files: File[]): Promise<CompressedImage[]> => {
  return Promise.all(files.map((file) => compressImage(file)));
};
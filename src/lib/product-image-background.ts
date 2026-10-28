const MAX_PROCESSING_EDGE = 1400;
const BACKGROUND_DISTANCE_SQUARED = 3 * 68 * 68;

function parseHexColor(value: string): [number, number, number] {
  const clean = value.replace("#", "");
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function backgroundColorFromBorder(pixels: Uint8ClampedArray, width: number, height: number): [number, number, number] {
  const bins = new Map<number, { count: number; r: number; g: number; b: number }>();
  const step = Math.max(1, Math.floor(Math.min(width, height) / 300));
  const add = (x: number, y: number) => {
    const offset = (y * width + x) * 4;
    const r = pixels[offset], g = pixels[offset + 1], b = pixels[offset + 2];
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bin = bins.get(key) || { count: 0, r: 0, g: 0, b: 0 };
    bin.count += 1; bin.r += r; bin.g += g; bin.b += b;
    bins.set(key, bin);
  };
  for (let x = 0; x < width; x += step) { add(x, 0); add(x, height - 1); }
  for (let y = step; y < height - 1; y += step) { add(0, y); add(width - 1, y); }
  let dominant = { count: 0, r: 255, g: 255, b: 255 };
  for (const bin of bins.values()) if (bin.count > dominant.count) dominant = bin;
  return [dominant.r / dominant.count, dominant.g / dominant.count, dominant.b / dominant.count];
}

/**
 * Replaces a plain, edge-connected photo background with a chosen solid color.
 * It deliberately limits changes to pixels close to the most common border color,
 * so product pixels away from the image edge are preserved.
 */
export async function replaceProductPhotoBackground(file: File, fillColor: string): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_PROCESSING_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) { bitmap.close(); throw new Error("Could not prepare the product photo."); }

  const [fillR, fillG, fillB] = parseHexColor(fillColor);
  context.fillStyle = fillColor;
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = context.getImageData(0, 0, width, height);
  const pixels = imageData.data;
  const [backgroundR, backgroundG, backgroundB] = backgroundColorFromBorder(pixels, width, height);
  const pixelCount = width * height;
  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  let head = 0, tail = 0;

  const enqueueIfBackground = (pixelIndex: number) => {
    if (visited[pixelIndex]) return;
    visited[pixelIndex] = 1;
    const offset = pixelIndex * 4;
    const dr = pixels[offset] - backgroundR;
    const dg = pixels[offset + 1] - backgroundG;
    const db = pixels[offset + 2] - backgroundB;
    if (dr * dr + dg * dg + db * db <= BACKGROUND_DISTANCE_SQUARED) queue[tail++] = pixelIndex;
  };

  for (let x = 0; x < width; x += 1) {
    enqueueIfBackground(x);
    enqueueIfBackground((height - 1) * width + x);
  }
  for (let y = 1; y < height - 1; y += 1) {
    enqueueIfBackground(y * width);
    enqueueIfBackground(y * width + width - 1);
  }

  while (head < tail) {
    const pixelIndex = queue[head++];
    const offset = pixelIndex * 4;
    pixels[offset] = fillR; pixels[offset + 1] = fillG; pixels[offset + 2] = fillB; pixels[offset + 3] = 255;
    const x = pixelIndex % width;
    if (x > 0) enqueueIfBackground(pixelIndex - 1);
    if (x + 1 < width) enqueueIfBackground(pixelIndex + 1);
    if (pixelIndex >= width) enqueueIfBackground(pixelIndex - width);
    if (pixelIndex + width < pixelCount) enqueueIfBackground(pixelIndex + width);
  }

  context.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((result) => result ? resolve(result) : reject(new Error("Could not create the color-backed product photo.")), "image/webp", 0.92);
  });
  const baseName = file.name.replace(/\.[^.]+$/, "") || "product-photo";
  return new File([blob], baseName + "-background.webp", { type: "image/webp", lastModified: Date.now() });
}

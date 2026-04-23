
export function getCanvasFromImage(
  image: CanvasImageSource,
  width?: number,
  height?: number
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");

  const img = image as HTMLImageElement;

  const w =
    width ||
    img.naturalWidth ||
    (image as HTMLVideoElement).videoWidth ||
    img.width;

  const h =
    height ||
    img.naturalHeight ||
    (image as HTMLVideoElement).videoHeight ||
    img.height;

  if (!w || !h) {
    throw new Error("Invalid image dimensions.");
  }

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(image, 0, 0, w, h);

  return canvas;
}

export async function dataUrlToImage(src: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = src;
  await img.decode();
  return img;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = "image/jpeg", quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Could not convert canvas to blob."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}


export function rgbToGray(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b;
}
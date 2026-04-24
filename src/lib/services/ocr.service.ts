import Tesseract from "tesseract.js";

export async function runOCR(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number) => void
) {
  return Tesseract.recognize(canvas, "eng", {
    logger: (info: any) => {
      if (info.status === "recognizing text" && onProgress) {
        onProgress(Math.round((info.progress || 0) * 100));
      }
    },
    config: {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6",
    },
  } as any);
}

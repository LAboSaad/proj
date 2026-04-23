import Tesseract from "tesseract.js";
import { dataUrlToImage } from "../../utils/image";
import { cropMRZRegion, extractMRZLines, normalizeMRZText, preprocessMRZCanvas } from "../ocr";


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
    // ⚠️ MUST be inside config
    config: {
      tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<",
      tessedit_pageseg_mode: "6",
    },
  } as any);
}

export async function runMRZOCR(
  documentImage: string,
  setProgress: (p: number) => void
) {
  const img = await dataUrlToImage(documentImage);

  const mrzCanvas = cropMRZRegion(img);
  const processedCanvas = await preprocessMRZCanvas(mrzCanvas);

  const [raw, processed] = await Promise.all([
    runOCR(mrzCanvas, setProgress),
    runOCR(processedCanvas, setProgress),
  ]);

  const rawText = raw.data.text || "";
  const processedText = processed.data.text || "";

  const score = (t: string) =>
    t.replace(/[^A-Z0-9<]/g, "").length;

  const bestText =
    score(processedText) > score(rawText)
      ? processedText
      : rawText;

  const cleaned = normalizeMRZText(bestText);
  const lines = extractMRZLines(cleaned);

  return { cleaned, lines };
}
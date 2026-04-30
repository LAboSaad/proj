import { formatDate } from "../lib/utils";
import type { SubmissionPayload } from "../types/kyc";

export function getCanvasFromImage(
  image: CanvasImageSource,
  width?: number,
  height?: number,
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

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type = "image/jpeg",
  quality = 0.92,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Could not convert canvas to blob."));
          return;
        }
        resolve(blob);
      },
      type,
      quality,
    );
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

function truncate(value: unknown, maxLength = 50): unknown {
  if (typeof value !== "string") return value;

  return value.length > maxLength ? value.slice(0, maxLength) + "..." : value;
}
export function truncateDeep(obj: any, maxLength = 50): any {
  if (typeof obj === "string") {
    return truncate(obj, maxLength);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => truncateDeep(item, maxLength));
  }

  if (typeof obj === "object" && obj !== null) {
    const result: any = {};
    for (const key in obj) {
      result[key] = truncateDeep(obj[key], maxLength);
    }
    return result;
  }

  return obj;
}

export function transformToBackendPayload(
  payload: SubmissionPayload,
  msisdn: string,
) {
  // Read language from i18next localStorage key, fallback to "EN"
  const rawLang = localStorage.getItem("i18nextLng") ?? "EN";
  // i18next sometimes stores "en-US" — normalize to just the 2-letter code uppercased
  const language = rawLang.split("-")[0].toUpperCase();

  return {
    FirstName: payload.ocr.FirstName || "",
    MiddleName: payload.ocr.MiddleName || "",
    Email: payload.ocr.Email || "",
    LastName: payload.ocr.LastName || "",

    Gender: payload.ocr.Gender?.toLowerCase() === "male" ? "Male" : "Female",

    BirthDate: formatDate(payload.ocr.BirthDate),

    Address: payload.ocr.Address || "",
    Language: language, // ← from i18next

    Nationality: payload.ocr.Nationality || "",

    FaceFrontPhoto_b64: payload.images.selfie || "",
    FaceSidePhoto_b64: payload.images.FaceSidePhoto_b64 || "",

    IdDocType: "National ID",

    IdDocSerialNumber: payload.ocr.IdDocSerialNumber || "",
    NationalIdNumber: payload.ocr.IdDocSerialNumber || "",

    SIMType: "Standard",
    ICC: "",
    IMSI: "",

    MSISDNType: "Standard",
    MSISDN: msisdn,

    MobileMoney_Registration: false,
    IdDocFontPhoto_b64: payload.images.IdDocFontPhoto_b64 || "",
    IdDocRearPhoto_b64: payload.images.IdDocRearPhoto_b64 || "",
  };
}

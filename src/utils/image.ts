// src/utils/image.ts

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
  if (typeof obj === "string") return truncate(obj, maxLength);

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

// ── Gender helper ─────────────────────────────────────────────────────────────
// Returns "Male" | "Female" | "" — never defaults to Female when value is absent.
function resolveGender(raw: string | undefined | null): string {
  if (!raw) return "";
  const normalized = raw.trim().toLowerCase();
  if (normalized === "m" || normalized === "male") return "Male";
  if (normalized === "f" || normalized === "female") return "Female";
  return "";
}

const DOC_TYPE_LABELS: Record<string, string> = {
  national_id: "National ID",
  passport: "Passport",
  drivers_license: "Driver's License",
};

export function transformToBackendPayload(
  payload: SubmissionPayload,
  msisdn: string,
  docType: string,
) {
  // Read language from i18next localStorage key, fallback to "EN"
  const rawLang = localStorage.getItem("i18nextLng") ?? "EN";
  const language = rawLang.split("-")[0].toUpperCase();
console.log("payload", payload)
  return {
    FirstName: payload.ocr.FirstName || "",
    MiddleName: payload.ocr.MiddleName || "",
    Email: payload.ocr.Email || "",
    LastName: payload.ocr.LastName || "",

    // ── Fixed: no longer defaults to "Female" when gender is empty ──────────
    Gender: resolveGender(payload.ocr.Gender),

    // ── Fixed: BirthDate is already formatted by useOCR — pass it as-is ─────
    // Calling formatDate() here a second time was corrupting the value.
    BirthDate: payload.ocr.BirthDate || "",

    Address: payload.ocr.Address || "",
    Language: language,
    Nationality: payload.ocr.Nationality || "",

    FaceFrontPhoto_b64: payload.images.selfie || "",
    FaceSidePhoto_b64: payload.images.FaceSidePhoto_b64 || "",

    IdDocType: DOC_TYPE_LABELS[docType] ?? "National ID",

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
    SignaturePhoto_b64: payload.signatureImage || "",
  };
}

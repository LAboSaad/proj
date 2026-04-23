import { dataUrlToImage, getCanvasFromImage } from "../../utils/image";

export async function detectPossibleSpoof(imageDataUrl: string): Promise<boolean> {
  return new Promise(async (resolve) => {
    const img = await dataUrlToImage(imageDataUrl);
    console.log("natural in App:", img.naturalWidth, img.naturalHeight);
console.log("display in App:", img.width, img.height);
    const canvas = getCanvasFromImage(img);
    const ctx = canvas.getContext("2d");
    if (!ctx) return resolve(false);

    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);

    let variance = 0;
    let mean = 0;
    const values: number[] = [];

    for (let i = 0; i < data.length; i += 4) {
      const gray = (data[i] + data[i + 1] + data[i + 2]) / 3;
      values.push(gray);
      mean += gray;
    }

    mean /= values.length;

    for (const v of values) {
      variance += (v - mean) ** 2;
    }

    variance /= values.length;

    // 🔥 LOW variance = likely screen / printed spoof
    resolve(variance < 300);
  });
}
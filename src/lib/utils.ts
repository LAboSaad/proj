import type { ExtractedFields } from "../types/kyc";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function mean(values: number[]): number {
  return values.reduce((acc, value) => acc + value, 0) / Math.max(1, values.length);
}
export function variance(values: number[]): number {
  const avg = mean(values);
  return mean(values.map((value) => (value - avg) ** 2));
}


export function similarityFromDistance(distance: number): number {
  const similarity = Math.max(0, Math.min(1, 1 - distance / 0.9));
  return Number((similarity * 100).toFixed(2));
}

export function mapFieldKey(label: string): keyof ExtractedFields {
  switch (label) {
    case "First name":
      return "firstName";
    case "Last name":
      return "lastName";
    case "Document number":
      return "documentNumber";
    case "Nationality":
      return "nationality";
    case "Birth date":
      return "birthDate";
    case "Expiry date":
      return "expiryDate";
    case "Sex":
      return "sex";
    default:
      return "firstName";
  }
}

export function formatDateYYMMDD(input: string): string {
  if (!input || input.length !== 6) return input;
  const yy = Number(input.slice(0, 2));
  const mm = input.slice(2, 4);
  const dd = input.slice(4, 6);
  const year = yy > 40 ? 1900 + yy : 2000 + yy;
  return `${year}-${mm}-${dd}`;
}

export const toBase64 = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
  });

//  export const extractFieldsWithAI = async (image: Blob) => {
//   try {
//     const base64 = await toBase64(image);

//     const res = await fetch("https://api.openai.com/v1/responses", {
//       method: "POST",
//       headers: {
//         Authorization: `Bearer ${OPENAI_API_KEY}`,
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify({
//         model: "o4-mini",
//         input: [
//           {
//             role: "user",
//             content: [
//               {
//                 type: "input_text",
//                 text: `
// Extract the following fields from this identity document.

// Return ONLY valid JSON in this format:
// {
//   "firstName": "",
//   "lastName": "",
//   "documentNumber": "",
//   "nationality": "",
//   "dateOfBirth": "",
//   "expiryDate": "",
//   "gender": ""
// }

// If a field is missing, return empty string.
//                 `,
//               },
//               {
//                 type: "input_image",
//                 image_url: base64,
//               },
//             ],
//           },
//         ],
//       }),
//     });

//     const data = await res.json();

//     const text = data.output?.[0]?.content?.[0]?.text || "{}";

//     return JSON.parse(text);
//   } catch (err) {
//     console.error("AI extraction failed", err);
//     return null;
//   }
// };
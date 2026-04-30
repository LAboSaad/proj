import type { ExtractedFields } from "../types/kyc";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function mean(values: number[]): number {
  return (
    values.reduce((acc, value) => acc + value, 0) / Math.max(1, values.length)
  );
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
      return "FirstName";
    case "Middle name":
      return "MiddleName";
    case "Last name":
      return "LastName";
    case "Email":
      return "Email";
    case "Address":
      return "Address";
    case "Document number":
      return "IdDocSerialNumber";
    case "Nationality":
      return "Nationality";
    case "Birth date":
      return "BirthDate";
    case "Expiry date":
      return "ExpiryDate";
    case "Sex":
      return "Gender";
    default:
      return "FirstName";
  }
}

export function formatDate(date: string) {
  if (!date) return "";

  // 🧠 Handle MRZ format (YYMMDD)
  if (/^\d{6}$/.test(date)) {
    const yy = parseInt(date.slice(0, 2), 10);
    const mm = date.slice(2, 4);
    const dd = date.slice(4, 6);

    // MRZ rule: 00–49 → 2000s, 50–99 → 1900s
    const fullYear = yy < 50 ? 2000 + yy : 1900 + yy;

    return `${dd}-${mm}-${fullYear}`;
  }

  // 🧠 Handle normal ISO dates (fallback)
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";

  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();

  return `${day}-${month}-${year}`;
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

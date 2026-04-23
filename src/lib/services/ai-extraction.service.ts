export async function extractFieldsWithAI(
  imageBlob: Blob,
  apiKey: string
) {
  const toBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(blob);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
    });

  const safeParse = (text: string) => {
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  };

  try {
    const base64 = await toBase64(imageBlob);

    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `Extract MRZ + fields. Return ONLY JSON:
{
  "mrzLines": ["", ""],
  "firstName": "",
  "lastName": "",
  "documentNumber": "",
  "nationality": "",
  "birthDate": "",
  "expiryDate": "",
  "sex": ""
}`,
              },
              {
                type: "input_image",
                image_url: base64,
              },
            ],
          },
        ],
      }),
    });

    const data = await res.json();

    const message = data.output?.find(
      (o: any) => o.type === "message"
    );

    const texts =
      message?.content
        ?.filter((c: any) => c.type === "output_text")
        ?.map((c: any) => c.text) || [];

    const combined = texts.join("\n") || "{}";

    const jsonMatch = combined.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return {};

    return safeParse(jsonMatch[0]);
  } catch {
    return {};
  }
}
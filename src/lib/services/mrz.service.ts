import { parse as parseMRZ } from "mrz";


export function parseMRZFromSource(lines: string[]) {
  try {
    const parsed = parseMRZ(lines);
console.log("checking parsed within parseMRZFROMSOURCE",parsed)
    return {
      parsed,
      valid: parsed.valid,
      fields: parsed.fields,
    };
  } catch {
    return {
      parsed: null,
      valid: false,
      fields: null,
    };
  }
}

export function normalizeMRZLines(lines: string[]) {
  return lines.map((l) =>
    l.replace(/[^A-Z0-9<]/g, "")
      .padEnd(44, "<")
      .slice(0, 44)
  );
}

export function isStructurallyValidMRZ(lines: string[]) {
  return (
    lines.length === 2 &&
    lines.every((l) => l.length === 44)
  );
}
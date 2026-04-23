import { formatDateYYMMDD } from "../utils";

export function mapMRZFields(parsed: any) {
  if (!parsed?.valid || !parsed?.fields) return null;

  const d = parsed.fields;

  return {
    firstName: d.firstName?.replace(/</g, " ").trim(),
    lastName: d.lastName?.replace(/</g, " ").trim(),
    documentNumber: d.documentNumber?.replace(/</g, "").trim(),
    nationality: d.nationality,
    birthDate: d.birthDate ? formatDateYYMMDD(d.birthDate) : "",
    expiryDate: d.expirationDate
      ? formatDateYYMMDD(d.expirationDate)
      : "",
    sex: d.sex?.toUpperCase(),
  };
}
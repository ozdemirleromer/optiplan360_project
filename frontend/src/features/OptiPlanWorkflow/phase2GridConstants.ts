import type { BooleanField, ConfidenceField, NumericField } from "./phase2GridTypes";

export const NUMERIC_FIELDS: NumericField[] = ["boy", "en", "adet"];
export const BOOLEAN_FIELDS: BooleanField[] = ["u1", "u2", "k1", "k2"];
export const CONFIDENCE_FIELDS: ConfidenceField[] = ["boy", "en", "adet", "u1", "u2", "k1", "k2"];
export const EMPTY_APPROVED_FIELDS: ReadonlySet<ConfidenceField> = new Set<ConfidenceField>();

export const FIELD_LABEL: Record<ConfidenceField, string> = {
  boy: "Boy",
  en: "En",
  adet: "Adet",
  u1: "U1",
  u2: "U2",
  k1: "K1",
  k2: "K2",
};

export const CRITICAL_FIELD_TEXT = "BOY, EN, ADET, U1, U2, K1, K2";

export function isNumericField(field: ConfidenceField): field is NumericField {
  return NUMERIC_FIELDS.includes(field as NumericField);
}

export function isBooleanField(field: ConfidenceField): field is BooleanField {
  return BOOLEAN_FIELDS.includes(field as BooleanField);
}

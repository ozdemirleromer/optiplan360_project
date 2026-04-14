export type NumericField = "boy" | "en" | "adet";
export type BooleanField = "u1" | "u2" | "k1" | "k2";
export type ConfidenceField = NumericField | BooleanField;

export type RowEditState = {
  boy?: number | null;
  en?: number | null;
  adet?: number | null;
  u1?: boolean;
  u2?: boolean;
  k1?: boolean;
  k2?: boolean;
};

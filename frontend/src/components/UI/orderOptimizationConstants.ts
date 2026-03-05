// Malzeme Spesifikasyonları - Tüm Malzemeler (13 adet)
export const MATERIAL_SPECIFICATIONS = [
  { thickness: "3MM", dimensions: "170*210" },
  { thickness: "4MM", dimensions: "210*280" },
  { thickness: "5MM", dimensions: "210*280" },
  { thickness: "6MM", dimensions: "210*280" },
  { thickness: "8MM", dimensions: "210*280" },
  { thickness: "10MM", dimensions: "210*280" },
  { thickness: "12MM", dimensions: "210*280" },
  { thickness: "16MM", dimensions: "210*280" },
  { thickness: "18MM", dimensions: "210*280" },
  { thickness: "18MM", dimensions: "183*366" },
  { thickness: "22MM", dimensions: "210*280" },
  { thickness: "25MM", dimensions: "210*280" },
  { thickness: "30MM", dimensions: "210*280" },
] as const;

// Varsayılan malzeme
export const DEFAULT_MATERIAL = "18MM 210*280";

// Standart Ölçüler (Boy x En) - Tüm Ölçüler
export const STANDARD_MEASUREMENTS = [
  { boy: "210", en: "280", label: "210x280" },
  { boy: "170", en: "210", label: "170x210" },
  { boy: "183", en: "366", label: "183x366" },
  { boy: "150", en: "200", label: "150x200" },
  { boy: "200", en: "300", label: "200x300" },
  { boy: "250", en: "350", label: "250x350" },
  { boy: "300", en: "400", label: "300x400" },
  { boy: "220", en: "330", label: "220x330" },
  { boy: "240", en: "320", label: "240x320" },
  { boy: "160", en: "240", label: "160x240" },
  { boy: "180", en: "260", label: "180x260" },
  { boy: "195", en: "290", label: "195x290" },
  { boy: "225", en: "315", label: "225x315" },
] as const;

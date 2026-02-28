export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 0) {
    return "";
  }

  if (digits.startsWith("90") && digits.length >= 12) {
    return `+${digits}`;
  }

  if (digits.startsWith("0") && digits.length >= 11) {
    return `+9${digits}`;
  }

  if (digits.length === 10) {
    return `+90${digits}`;
  }

  return `+${digits}`;
}

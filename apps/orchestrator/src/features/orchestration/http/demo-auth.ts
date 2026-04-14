export function isDemoLoginEnabled(): boolean {
  return process.env.NODE_ENV !== "production";
}

export function getDemoLoginNotice(): string {
  return isDemoLoginEnabled()
    ? "Demo giriş: admin / admin"
    : "Demo giriş üretim ortamında kapalıdır.";
}
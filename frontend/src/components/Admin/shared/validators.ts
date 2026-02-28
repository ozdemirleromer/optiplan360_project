/**
 * Form validation functions for Admin components
 */

export const validators = {
  required: (value: string) => (value.trim() ? "" : "Bu alan gereklidir"),
  
  email: (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? "" : "Geçerli bir e-posta adresi girin",
  
  minLength: (min: number) => (value: string) =>
    value.length >= min ? "" : `En az ${min} karakter olmalıdır`,
  
  port: (value: string) => {
    const num = parseInt(value, 10);
    return num > 0 && num <= 65535 ? "" : "Geçerli bir port numarası girin (1-65535)";
  },
};

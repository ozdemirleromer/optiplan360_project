/**
 * Form Validation Utilities
 * Real-time form validation kuralları ve hata yönetimi
 */

import React from 'react';

export type ValidationRule = {
  type: 'required' | 'email' | 'phone' | 'minLength' | 'maxLength' | 'number' | 'custom' | 'match';
  message: string;
  value?: number | string; // minLength, maxLength sayı değeri
  validator?: (value: unknown) => boolean; // custom rule
};

export type FieldValidation = {
  rules: ValidationRule[];
};

export type FormSchema = {
  [fieldName: string]: ValidationRule[];
};

/**
 * Tek bir değeri valide et
 */
export const validateField = (value: unknown, rules: ValidationRule[]): string | null => {
  for (const rule of rules) {
    switch (rule.type) {
      case 'required':
        if (!value || (typeof value === 'string' && !value.trim())) {
          return rule.message;
        }
        break;

      case 'email':
        if (typeof value === 'string' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          return rule.message;
        }
        break;

      case 'phone':
        // TR: 10 haneli (5xxxxxxxxx formatında)
        if (typeof value === 'string' && !/^5\d{9}$/.test(value.replace(/\D/g, ''))) {
          return rule.message;
        }
        break;

      case 'minLength':
        if (typeof value === 'string' && typeof rule.value === 'number' && value.length < rule.value) {
          return rule.message;
        }
        break;

      case 'maxLength':
        if (typeof value === 'string' && typeof rule.value === 'number' && value.length > rule.value) {
          return rule.message;
        }
        break;

      case 'number':
        if (value && isNaN(Number(value))) {
          return rule.message;
        }
        break;

      case 'custom':
        if (rule.validator && !rule.validator(value)) {
          return rule.message;
        }
        break;

      case 'match':
        // Custom eş değer kontrolü (e.g. password confirmation)
        if (rule.validator && !rule.validator(value)) {
          return rule.message;
        }
        break;

      default:
        break;
    }
  }

  return null; // No error
};

/**
 * Tüm formu valide et
 */
export const validateForm = (
  formData: Record<string, unknown>,
  schema: FormSchema,
): Record<string, string | null> => {
  const errors: Record<string, string | null> = {};

  for (const fieldName in schema) {
    const value = formData[fieldName];
    const rules = schema[fieldName];
    errors[fieldName] = validateField(value, rules);
  }

  return errors;
};

/**
 * Form valid mi?
 */
export const isFormValid = (errors: Record<string, string | null>): boolean => {
  return Object.values(errors).every((error) => error === null);
};

// Predefined schemas
export const commonSchemas = {
  email: [
    {
      type: 'required' as const,
      message: 'E-posta adresi gereklidir',
    },
    {
      type: 'email' as const,
      message: 'Geçerli bir e-posta adresi girin (örn: user@example.com)',
    },
  ],

  phone: [
    {
      type: 'required' as const,
      message: 'Telefon numarası gereklidir',
    },
    {
      type: 'phone' as const,
      message: 'Geçerli bir telefon numarası girin (5xxxxxxxxx formatında)',
    },
  ],

  password: [
    {
      type: 'required' as const,
      message: 'Şifre gereklidir',
    },
    {
      type: 'minLength' as const,
      value: 8,
      message: 'Şifre en az 8 karakter olmalıdır',
    },
  ],

  name: [
    {
      type: 'required' as const,
      message: 'Ad/Soyad gereklidir',
    },
    {
      type: 'minLength' as const,
      value: 2,
      message: 'Ad/Soyad en az 2 karakter olmalıdır',
    },
    {
      type: 'maxLength' as const,
      value: 100,
      message: 'Ad/Soyad en fazla 100 karakter olmalıdır',
    },
  ],

  number: [
    {
      type: 'required' as const,
      message: 'Bu alan gereklidir',
    },
    {
      type: 'number' as const,
      message: 'Sadece rakam girin',
    },
  ],
};

/**
 * Hook: useFormValidation
 * React component'lerde kullanım
 */
export const useFormValidation = <T extends Record<string, unknown>>(
  initialData: T,
  schema: FormSchema,
) => {
  const [formData, setFormData] = React.useState(initialData);
  const [errors, setErrors] = React.useState<Record<string, string | null>>({});
  const [touched, setTouched] = React.useState<Record<string, boolean>>({});

  const handleChange = (fieldName: string, value: T[keyof T]) => {
    setFormData((prev) => ({ ...prev, [fieldName]: value }));

    // Real-time validation eğer touched ise
    if (touched[fieldName]) {
      const rules = schema[fieldName];
      if (rules) {
        const error = validateField(value, rules);
        setErrors((prev) => ({ ...prev, [fieldName]: error }));
      }
    }
  };

  const handleBlur = (fieldName: string) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    const rules = schema[fieldName];
    if (rules) {
      const error = validateField(formData[fieldName], rules);
      setErrors((prev) => ({ ...prev, [fieldName]: error }));
    }
  };

  const handleSubmit = (onValid: (data: T) => void) => {
    return (e: React.FormEvent) => {
      e.preventDefault();

      const newErrors = validateForm(formData, schema);
      setErrors(newErrors);
      setTouched(
        Object.keys(schema).reduce((acc, key) => ({ ...acc, [key]: true }), {}),
      );

      if (isFormValid(newErrors)) {
        onValid(formData);
      }
    };
  };

  const reset = () => {
    setFormData(initialData);
    setErrors({});
    setTouched({});
  };

  return {
    formData,
    errors,
    touched,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    isValid: isFormValid(errors),
    setFormData,
  };
};

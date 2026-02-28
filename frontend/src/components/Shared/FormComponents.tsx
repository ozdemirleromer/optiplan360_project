/**
 * OPTIPLAN360 - İYİLEŞTİRİLMİŞ INPUT & FORM COMPONENTS
 * 
 * Phase 1: Foundation - Shared UI Components
 * 
 * Bu dosya, mevcut inline input'ları replace etmek için gereken
 * standalone component'leri içerir.
 */

import { CSSProperties, useState, useRef } from "react";
import { Eye, EyeOff, X, Check } from "lucide-react";
import { COLORS, RADIUS, TYPOGRAPHY, SHADOWS, TRANSITIONS } from "./constants";

// ============================================
// 1. BASE INPUT COMPONENT
// ============================================

interface InputProps {
  type?: "text" | "email" | "tel" | "number" | "password" | "url" | "search" | "date" | "datetime-local";
  id?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: (e: React.FocusEvent<HTMLInputElement>) => void;
  onFocus?: (e: React.FocusEvent<HTMLInputElement>) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "md" | "lg";
  variant?: "outline" | "filled" | "expanded";
  icon?: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  maxLength?: number;
  minLength?: number;
  min?: string | number;
  max?: string | number;
  step?: number;
  pattern?: string;
  autoComplete?: string;
  inputMode?: "text" | "decimal" | "numeric" | "tel" | "search" | "email" | "url";
  ariaLabel?: string;
  ariaDescribedBy?: string;
  containerStyle?: CSSProperties;
  style?: CSSProperties;
}

export const Input = ({
  type = "text",
  id,
  value,
  onChange,
  onBlur,
  onFocus,
  label,
  placeholder,
  error,
  helperText,
  disabled = false,
  required = false,
  size = "md",
  variant = "outline",
  icon,
  clearable = false,
  onClear,
  maxLength,
  minLength,
  min,
  max,
  step,
  pattern,
  autoComplete,
  inputMode,
  ariaLabel,
  ariaDescribedBy,
  containerStyle = {},
  style = {},
}: InputProps) => {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const sizeStyles: Record<string, { padding: string; fontSize: number; minHeight: number }> = {
    sm: { padding: "8px 10px", fontSize: 12, minHeight: 44 },
    md: { padding: "10px 12px", fontSize: 14, minHeight: 44 },
    lg: { padding: "12px 16px", fontSize: 16, minHeight: 48 },
  };

  const variantStyles: Record<string, CSSProperties> = {
    outline: {
      border: `1px solid ${error ? COLORS.error.DEFAULT : focused ? COLORS.primary[500] : COLORS.border}`,
      background: COLORS.panel,
      color: COLORS.text,
      transition: `all ${TRANSITIONS.fast}`,
    },
    filled: {
      border: "none",
      borderBottom: `2px solid ${error ? COLORS.error.DEFAULT : focused ? COLORS.primary[500] : "rgba(255,255,255,.1)"}`,
      background: "rgba(255,255,255,.04)",
      color: COLORS.text,
    },
    expanded: {
      border: `2px solid ${error ? COLORS.error.DEFAULT : focused ? COLORS.primary[500] : "transparent"}`,
      borderRadius: RADIUS.lg,
      background: focused ? "rgba(255,255,255,.08)" : "rgba(255,255,255,.04)",
      color: COLORS.text,
    },
  };

  const actualType = type === "password" && showPassword ? "text" : type;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...containerStyle }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: 13,
            fontWeight: TYPOGRAPHY.fontWeight.semibold,
            color: COLORS.text,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          {label}
          {required && <span style={{ color: COLORS.error.DEFAULT, fontSize: 16 }}>*</span>}
        </label>
      )}

      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 8,
          ...sizeStyles[size],
          ...variantStyles[variant],
          borderRadius: variant === "filled" ? 0 : RADIUS.md,
          paddingRight: (clearable && value) || type === "password" ? 8 : sizeStyles[size].padding.split(" ")[1],
        }}
      >
        {icon && <span style={{ color: COLORS.muted, display: "flex", alignItems: "center" }}>{icon}</span>}

        <input
          ref={inputRef}
          id={id}
          type={actualType}
          value={value}
          onChange={onChange}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          placeholder={placeholder}
          disabled={disabled}
          maxLength={maxLength}
          minLength={minLength}
          min={min}
          max={max}
          step={step}
          pattern={pattern}
          inputMode={inputMode}
          autoComplete={autoComplete}
          aria-label={ariaLabel || label}
          aria-invalid={!!error}
          aria-describedby={error ? `${ariaDescribedBy || ""}-error` : ariaDescribedBy}
          style={{
            flex: 1,
            outline: "none",
            background: "transparent",
            border: "none",
            color: "inherit",
            fontSize: "inherit",
            fontFamily: TYPOGRAPHY.fontFamily.base,
            cursor: disabled ? "not-allowed" : "text",
            opacity: disabled ? 0.5 : 1,
            ...style,
          }}
        />

        {type === "password" && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            aria-label={showPassword ? "Şifreyi gizle" : "Şifreyi göster"}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              minWidth: "44px",
              minHeight: "44px",
              color: COLORS.muted,
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {showPassword ? <Eye size={18} aria-hidden="true" /> : <EyeOff size={18} aria-hidden="true" />}
          </button>
        )}

        {clearable && value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Alanı temizle"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              minWidth: "44px",
              minHeight: "44px",
              color: COLORS.muted,
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <span
          id={`${ariaDescribedBy || ""}-error`}
          role="alert"
          style={{
            fontSize: 12,
            color: COLORS.error.DEFAULT,
            fontWeight: TYPOGRAPHY.fontWeight.medium,
          }}
        >
          {error}
        </span>
      )}

      {helperText && !error && (
        <span
          style={{
            fontSize: 12,
            color: COLORS.muted,
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span>{helperText}</span>
          {maxLength && <span>{String(value).length}/{maxLength}</span>}
        </span>
      )}
    </div>
  );
};

// ============================================
// 2. PHONE INPUT COMPONENT (Tel formatting)
// ============================================

interface PhoneInputProps extends Omit<InputProps, "type" | "inputMode"> {
  format?: "90xx-xxx-xxxx" | "raw";
  countryCode?: string;
}

export const PhoneInput = ({ value, onChange, format = "90xx-xxx-xxxx", ...props }: PhoneInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let formatted = e.target.value.replace(/\D/g, "");

    if (format === "90xx-xxx-xxxx" && formatted.length > 0) {
      if (!formatted.startsWith("90")) {
        formatted = "90" + formatted;
      }
      formatted = formatted.substring(0, 12);
      
      if (formatted.length >= 4) {
        formatted = formatted.substring(0, 4) + "-" + formatted.substring(4);
      }
      if (formatted.length >= 8) {
        formatted = formatted.substring(0, 8) + "-" + formatted.substring(8);
      }
    }

    e.target.value = formatted;
    onChange(e);
  };

  return (
    <Input
      type="tel"
      value={value}
      onChange={handleChange}
      placeholder="90xxx-xxx-xxxx"
      autoComplete="tel"
      {...props}
    />
  );
};

// ============================================
// 3. NUMBER INPUT COMPONENT
// ============================================

interface NumberInputProps extends Omit<InputProps, "type"> {
  min?: number;
  max?: number;
  step?: number;
  decimals?: number;
}

export const NumberInput = ({
  value,
  onChange,
  min,
  max,
  step = 1,
  decimals = 0,
  ...props
}: NumberInputProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let num = parseFloat(e.target.value);

    if (!isNaN(num)) {
      if (min !== undefined) num = Math.max(min, num);
      if (max !== undefined) num = Math.min(max, num);
      
      const precision = Math.pow(10, decimals);
      num = Math.round(num * precision) / precision;
    }

    e.target.value = isNaN(num) ? "" : num.toString();
    onChange(e);
  };

  return (
    <Input
      type="number"
      value={value}
      onChange={handleChange}
      step={step}
      inputMode="decimal"
      pattern={decimals > 0 ? "^[0-9]+(\\.[0-9]{1," + decimals + "})?$" : undefined}
      {...props}
    />
  );
};

// ============================================
// 4. SELECT COMPONENT
// ============================================

interface SelectOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  id?: string;
  value: string | number;
  onChange: (value: string | number) => void;
  options: SelectOption[];
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  disabled?: boolean;
  required?: boolean;
  size?: "sm" | "md" | "lg";
  clearable?: boolean;
  searchable?: boolean;
  ariaLabel?: string;
  ariaDescribedBy?: string;
  containerStyle?: CSSProperties;
}

export const Select = ({
  id,
  value,
  onChange,
  options,
  label,
  placeholder,
  error,
  helperText,
  disabled = false,
  required = false,
  size = "md",
  clearable = false,
  searchable = false,
  ariaLabel,
  ariaDescribedBy,
  containerStyle = {},
}: SelectProps) => {
  const [focused, setFocused] = useState(false);
  const [searchText, setSearchText] = useState("");

  const sizeStyles: Record<string, { padding: string; fontSize: number; minHeight: number }> = {
    sm: { padding: "8px 10px", fontSize: 12, minHeight: 44 },
    md: { padding: "10px 12px", fontSize: 14, minHeight: 44 },
    lg: { padding: "12px 16px", fontSize: 16, minHeight: 48 },
  };

  const filteredOptions = searchable
    ? options.filter((opt) => opt.label.toLowerCase().includes(searchText.toLowerCase()))
    : options;

  const selectedLabel = options.find((opt) => opt.value === value)?.label || placeholder;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...containerStyle }}>
      {label && (
        <label
          htmlFor={id}
          style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}
        >
          {label}
          {required && <span style={{ color: COLORS.error.DEFAULT }}>*</span>}
        </label>
      )}

      <div style={{ position: "relative" }}>
        <button
          id={id}
          type="button"
          onClick={() => setFocused(!focused)}
          aria-label={ariaLabel || label}
          aria-haspopup="listbox"
          aria-expanded={focused}
          aria-describedby={error ? `${ariaDescribedBy || ""}-error` : ariaDescribedBy}
          style={{
            width: "100%",
            ...sizeStyles[size],
            border: `1px solid ${error ? COLORS.error.DEFAULT : focused ? COLORS.primary[500] : COLORS.border}`,
            background: COLORS.panel,
            color: COLORS.text,
            borderRadius: RADIUS.md,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.5 : 1,
            fontSize: 14,
            fontFamily: TYPOGRAPHY.fontFamily.base,
          }}
        >
          <span>{selectedLabel}</span>
          <span style={{ transform: focused ? "rotate(180deg)" : "rotate(0)", transition: `transform ${TRANSITIONS.fast}` }}>
            ▼
          </span>
        </button>

        {focused && (
          <div
            role="listbox"
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              right: 0,
              background: COLORS.panel,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md,
              boxShadow: SHADOWS.md,
              zIndex: 1000,
              maxHeight: 200,
              overflowY: "auto",
            }}
          >
            {searchable && (
              <input
                type="text"
                placeholder="Ara..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: `1px solid ${COLORS.border}`,
                  background: "transparent",
                  color: COLORS.text,
                  fontSize: 13,
                  borderRadius: RADIUS.md,
                  outline: "none",
                  marginBottom: 4,
                }}
              />
            )}

            {filteredOptions.map((opt) => (
              <button
                key={opt.value}
                role="option"
                aria-selected={value === opt.value}
                onClick={() => {
                  onChange(opt.value);
                  setFocused(false);
                  setSearchText("");
                }}
                disabled={opt.disabled}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  border: "none",
                  background: value === opt.value ? `${COLORS.primary[500]}20` : "transparent",
                  color: value === opt.value ? COLORS.primary[500] : COLORS.text,
                  textAlign: "left",
                  cursor: opt.disabled ? "not-allowed" : "pointer",
                  opacity: opt.disabled ? 0.5 : 1,
                  fontSize: 14,
                  fontWeight: value === opt.value ? TYPOGRAPHY.fontWeight.semibold : TYPOGRAPHY.fontWeight.normal,
                  transition: `background ${TRANSITIONS.fast}`,
                }}
                onMouseEnter={(e) => {
                  if (!opt.disabled) {
                    e.currentTarget.style.background = `rgba(255,255,255,.05)`;
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = value === opt.value ? `${COLORS.primary[500]}20` : "transparent";
                }}
              >
                {opt.label}
              </button>
            ))}

            {filteredOptions.length === 0 && (
              <div style={{ padding: "10px 12px", color: COLORS.muted, fontSize: 13, textAlign: "center" }}>
                Sonuç bulunamadı
              </div>
            )}
          </div>
        )}

        {!focused && clearable && value && (
          <button
            type="button"
            onClick={() => onChange("")}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              background: "none",
              border: "none",
              cursor: "pointer",
              color: COLORS.muted,
              fontSize: 16,
            }}
          >
            <X size={12} />
          </button>
        )}
      </div>

      {error && (
        <span role="alert" style={{ fontSize: 12, color: COLORS.error.DEFAULT }}>
          {error}
        </span>
      )}

      {helperText && !error && <span style={{ fontSize: 12, color: COLORS.muted }}>{helperText}</span>}
    </div>
  );
};

// ============================================
// 5. FORM FIELD WRAPPER COMPONENT
// ============================================

interface FormFieldProps {
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: React.ReactNode;
  tooltip?: string;
  containerStyle?: CSSProperties;
}

export const FormField = ({
  label,
  required,
  error,
  helperText,
  children,
  tooltip,
  containerStyle = {},
}: FormFieldProps) => {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...containerStyle }}>
      {label && (
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <label style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
            {label}
            {required && <span style={{ color: COLORS.error.DEFAULT }}>*</span>}
          </label>
          {tooltip && (
            <span
              title={tooltip}
              style={{
                fontSize: 16,
                cursor: "help",
                opacity: 0.7,
              }}
            >
              ⓘ
            </span>
          )}
        </div>
      )}

      {children}

      {error && (
        <span role="alert" style={{ fontSize: 12, color: COLORS.error.DEFAULT }}>
          {error}
        </span>
      )}

      {helperText && !error && <span style={{ fontSize: 12, color: COLORS.muted }}>{helperText}</span>}
    </div>
  );
};

// ============================================
// 6. CHECKBOX COMPONENT
// ============================================

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
  id?: string;
  disabled?: boolean;
  error?: string;
  ariaLabel?: string;
  containerStyle?: CSSProperties;
}

export const Checkbox = ({
  checked,
  onChange,
  label,
  id,
  disabled = false,
  error,
  ariaLabel,
  containerStyle = {},
}: CheckboxProps) => {
  const [focused, setFocused] = useState(false);

  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, ...containerStyle, minHeight: "44px" }}>
      <label
        htmlFor={id}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          userSelect: "none",
          padding: "8px 8px",
          minWidth: "44px",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 20,
            height: 20,
            border: `2px solid ${error ? COLORS.error.DEFAULT : focused ? COLORS.primary[500] : COLORS.border}`,
            borderRadius: RADIUS.md,
            background: checked ? COLORS.primary[500] : "transparent",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: `all ${TRANSITIONS.fast}`,
            color: "white",
            fontSize: 12,
            fontWeight: TYPOGRAPHY.fontWeight.bold,
            flexShrink: 0,
          }}
        >
          {checked && <Check size={12} />}
        </div>

        <input
          id={id}
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={disabled}
          aria-label={ariaLabel || label}
          aria-invalid={!!error}
          style={{ display: "none" }}
        />

        {label && <span style={{ fontSize: 14, color: COLORS.text }}>{label}</span>}
      </label>

      {error && <span style={{ fontSize: 12, color: COLORS.error.DEFAULT }}>{error}</span>}
    </div>
  );
};

// ============================================
// 7. RADIO BUTTON COMPONENT
// ============================================

interface RadioOption {
  value: string | number;
  label: string;
  disabled?: boolean;
}

interface RadioGroupProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: RadioOption[];
  label?: string;
  required?: boolean;
  error?: string;
  direction?: "row" | "column";
  containerStyle?: CSSProperties;
}

export const RadioGroup = ({
  value,
  onChange,
  options,
  label,
  required,
  error,
  direction = "column",
  containerStyle = {},
}: RadioGroupProps) => {
  const [focused, setFocused] = useState<string | number | null>(null);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...containerStyle }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
          {label}
          {required && <span style={{ color: COLORS.error.DEFAULT }}>*</span>}
        </label>
      )}

      <div style={{ display: "flex", flexDirection: direction, gap: 12 }}>
        {options.map((opt, idx) => (
          <label
            key={opt.value}
            htmlFor={`radio-${opt.value}-${idx}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              cursor: opt.disabled ? "not-allowed" : "pointer",
              opacity: opt.disabled ? 0.5 : 1,
              userSelect: "none",
              padding: "8px",
              minHeight: "44px",
              minWidth: "auto",
            }}
          >
            <div
              style={{
                width: 20,
                height: 20,
                borderRadius: "50%",
                border: `2px solid ${error ? COLORS.error.DEFAULT : focused === opt.value ? COLORS.primary[500] : COLORS.border}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: `all ${TRANSITIONS.fast}`,
                flexShrink: 0,
              }}
            >
              {value === opt.value && (
                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: COLORS.primary[500],
                  }}
                />
              )}
            </div>

            <input
              id={`radio-${opt.value}-${idx}`}
              type="radio"
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              onFocus={() => setFocused(opt.value)}
              onBlur={() => setFocused(null)}
              disabled={opt.disabled}
              style={{ display: "none" }}
            />

            <span style={{ fontSize: 14, color: COLORS.text }}>{opt.label}</span>
          </label>
        ))}
      </div>

      {error && <span style={{ fontSize: 12, color: COLORS.error.DEFAULT }}>{error}</span>}
    </div>
  );
};

// ============================================
// 8. DATE INPUT COMPONENT
// ============================================

interface DateInputProps {
  value: Date | string;
  onChange: (date: Date) => void;
  label?: string;
  placeholder?: string;
  error?: string;
  helperText?: string;
  min?: Date;
  max?: Date;
  disabled?: boolean;
  required?: boolean;
  containerStyle?: CSSProperties;
}

export const DateInput = ({
  value,
  onChange,
  label,
  placeholder = "GG.AA.YYYY",
  error,
  helperText,
  min,
  max,
  disabled = false,
  required = false,
  containerStyle = {},
}: DateInputProps) => {
  const formatDateForInput = (date: Date | string) => {
    if (!date) return "";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.value) {
      onChange(new Date(e.target.value));
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...containerStyle }}>
      {label && (
        <label style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
          {label}
          {required && <span style={{ color: COLORS.error.DEFAULT }}>*</span>}
        </label>
      )}

      <input
        type="date"
        value={formatDateForInput(value)}
        onChange={handleChange}
        placeholder={placeholder}
        min={min?.toISOString().split("T")[0]}
        max={max?.toISOString().split("T")[0]}
        disabled={disabled}
        style={{
          padding: "9px 12px",
          border: `1px solid ${error ? COLORS.error.DEFAULT : COLORS.border}`,
          borderRadius: RADIUS.md,
          background: COLORS.panel,
          color: COLORS.text,
          fontSize: 14,
          fontFamily: TYPOGRAPHY.fontFamily.base,
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
        }}
      />

      {error && <span style={{ fontSize: 12, color: COLORS.error.DEFAULT }}>{error}</span>}
      {helperText && !error && <span style={{ fontSize: 12, color: COLORS.muted }}>{helperText}</span>}
    </div>
  );
};

// ============================================
// 9. VALIDATION HELPERS
// ============================================

export const Validators = {
  email: (value: string): string | undefined => {
    if (!value) return "E-posta gereklidir";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Geçerli bir e-posta girin";
    return undefined;
  },

  phone: (value: string): string | undefined => {
    if (!value) return "Telefon numarası gereklidir";
    if (!/^90\d{10}$/.test(value.replace(/\D/g, ""))) return "Geçerli bir telefon numarası girin (90xxxxxxxxxx)";
    return undefined;
  },

  required: (value: string | number): string | undefined => {
    if (!value || (typeof value === "string" && value.trim() === "")) return "Bu alan gereklidir";
    return undefined;
  },

  minLength: (min: number) => (value: string): string | undefined => {
    if (value && value.length < min) return `En az ${min} karakter girin`;
    return undefined;
  },

  maxLength: (max: number) => (value: string): string | undefined => {
    if (value && value.length > max) return `Maksimum ${max} karakter`;
    return undefined;
  },

  pattern: (pattern: RegExp, message: string) => (value: string): string | undefined => {
    if (value && !pattern.test(value)) return message;
    return undefined;
  },

  compose: (...validators: Array<(v: unknown) => string | undefined>) => (value: unknown): string | undefined => {
    for (const validator of validators) {
      const error = validator(value);
      if (error) return error;
    }
    return undefined;
  },
};

export default {
  Input,
  PhoneInput,
  NumberInput,
  Select,
  FormField,
  Checkbox,
  RadioGroup,
  DateInput,
  Validators,
};

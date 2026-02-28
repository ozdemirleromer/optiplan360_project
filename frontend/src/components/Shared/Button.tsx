import { CSSProperties, useState } from "react";
import { COLORS, RADIUS, SHADOWS, TRANSITIONS, TYPOGRAPHY } from "./constants";

interface ButtonProps {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  icon?: React.ReactNode;
  type?: "button" | "submit" | "reset";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  style?: CSSProperties;
  title?: string;
  'aria-label'?: string;
}

export const Button = ({
  children,
  variant = "primary",
  size = "md",
  icon,
  type = "button",
  onClick,
  disabled = false,
  loading = false,
  fullWidth = false,
  style = {},
  title,
  'aria-label': ariaLabel,
}: ButtonProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const disabledState = disabled || loading;

  const baseStyles: CSSProperties = {
    fontFamily: TYPOGRAPHY.fontFamily.base,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    borderRadius: RADIUS.lg,
    border: "1px solid transparent",
    cursor: disabledState ? "not-allowed" : "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    transition: TRANSITIONS.fast,
    opacity: disabledState ? 0.48 : 1,
    width: fullWidth ? "100%" : "auto",
    whiteSpace: "nowrap",
    position: "relative",
    transform: isPressed && !disabledState ? "translateY(1px)" : "translateY(0)",
    letterSpacing: "0.01em",
    backdropFilter: "blur(8px)",
  };

  const sizeStyles: Record<string, CSSProperties> = {
    sm: { padding: "8px 12px", fontSize: TYPOGRAPHY.fontSize.xs, minHeight: "40px", minWidth: "40px" },
    md: { padding: "10px 16px", fontSize: TYPOGRAPHY.fontSize.sm, minHeight: "44px", minWidth: "44px" },
    lg: { padding: "12px 20px", fontSize: TYPOGRAPHY.fontSize.base, minHeight: "48px", minWidth: "48px" },
  };

  const variantStyles: Record<string, CSSProperties> = {
    primary: {
      background: isPressed
        ? `linear-gradient(135deg, ${COLORS.primary[700]}, ${COLORS.accent[700]})`
        : isHovered
          ? `linear-gradient(135deg, ${COLORS.primary[600]}, ${COLORS.accent[600]})`
          : `linear-gradient(135deg, ${COLORS.primary.DEFAULT}, ${COLORS.accent.DEFAULT})`,
      color: "#ffffff",
      boxShadow: isHovered && !disabledState
        ? `0 0 0 1px rgba(var(--primary-rgb), 0.28), 0 12px 30px rgba(var(--primary-rgb), 0.28)`
        : "0 2px 10px rgba(0,0,0,0.35)",
    },
    secondary: {
      background: isPressed
        ? `linear-gradient(135deg, rgba(var(--primary-rgb),0.22), rgba(var(--primary-rgb),0.18))`
        : isHovered
          ? `linear-gradient(135deg, rgba(var(--primary-rgb),0.18), rgba(var(--primary-rgb),0.14))`
          : `linear-gradient(135deg, rgba(var(--primary-rgb),0.12), rgba(var(--primary-rgb),0.08))`,
      color: COLORS.text,
      border: `1px solid rgba(var(--primary-rgb), 0.30)`,
      boxShadow: isHovered && !disabledState ? `0 0 18px rgba(var(--primary-rgb), 0.18)` : "none",
    },
    ghost: {
      background: isPressed
        ? "rgba(255,255,255,0.12)"
        : isHovered
          ? "rgba(255,255,255,0.08)"
          : "rgba(255,255,255,0.02)",
      color: COLORS.text,
      border: `1px solid ${COLORS.border}`,
    },
    danger: {
      background: isPressed
        ? "linear-gradient(135deg, #b91c1c, #dc2626)"
        : isHovered
          ? "linear-gradient(135deg, #dc2626, #ef4444)"
          : "linear-gradient(135deg, #ef4444, #f87171)",
      color: "#fff",
      border: "1px solid rgba(239,68,68,0.45)",
      boxShadow: isHovered && !disabledState ? SHADOWS.sm : "none",
    },
  };

  return (
    <button
      type={type}
      style={{ ...baseStyles, ...sizeStyles[size], ...variantStyles[variant], ...style }}
      onClick={onClick}
      disabled={disabledState}
      title={title}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        setIsPressed(false);
      }}
      onMouseDown={() => setIsPressed(true)}
      onMouseUp={() => setIsPressed(false)}
      aria-label={ariaLabel}
    >
      {loading && <span className="btn-spinner" />}
      {!loading && icon && <span style={{ fontSize: "1.05em", lineHeight: 1 }} aria-hidden="true">{icon}</span>}
      {children}
    </button>
  );
};

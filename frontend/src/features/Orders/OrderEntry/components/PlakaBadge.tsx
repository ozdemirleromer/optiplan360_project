import { useRef, useState } from "react";
import type { OrderEntryPlaka } from "../shared/types";

interface PlakaBadgeProps {
  value: string | null | undefined;
  plakalar: OrderEntryPlaka[];
  disabled?: boolean;
  onChange: (ref: string) => void;
}

export function PlakaBadge({ value, plakalar, disabled, onChange }: PlakaBadgeProps) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const current = plakalar.find((p) => p.ref === value);
  const label = current ? `${current.ref} (${current.boyMm}x${current.enMm})` : (value ?? "—");

  if (plakalar.length === 0) {
    return value ? (
      <span
        style={{
          fontSize: 10,
          padding: "1px 5px",
          borderRadius: 3,
          background: "var(--op-accent, #e0f0ff)",
          color: "var(--op-text-muted, #64748b)",
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </span>
    ) : null;
  }

  return (
    <div style={{ position: "relative", display: "inline-flex" }}>
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        aria-label={`Plaka seç — şu an: ${label}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setOpen((o) => !o);
        }}
        style={{
          fontSize: 10,
          padding: "1px 5px",
          borderRadius: 3,
          border: "1px solid var(--op-border, #e2e8f0)",
          background: value ? "var(--op-accent, #e0f0ff)" : "transparent",
          color: "var(--op-text-muted, #64748b)",
          cursor: disabled ? "default" : "pointer",
          whiteSpace: "nowrap",
          lineHeight: 1.4,
        }}
      >
        {label}
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Plaka seçimi"
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 200,
            minWidth: 140,
            background: "var(--op-surface, #fff)",
            border: "1px solid var(--op-border, #e2e8f0)",
            borderRadius: 4,
            boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
            marginTop: 2,
          }}
        >
          {plakalar.map((p) => (
            <button
              key={p.ref}
              type="button"
              role="option"
              aria-selected={p.ref === value}
              onClick={(e) => {
                e.stopPropagation();
                onChange(p.ref);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "5px 8px",
                border: "none",
                background: p.ref === value ? "var(--op-accent, #e0f0ff)" : "transparent",
                cursor: "pointer",
                fontSize: 11,
                color: "var(--op-text, #0f172a)",
              }}
            >
              <strong style={{ fontSize: 11 }}>{p.ref}</strong>
              <span style={{ marginLeft: 6, color: "var(--op-text-muted, #64748b)" }}>
                {p.boyMm}×{p.enMm}
              </span>
              {p.etiket && (
                <span style={{ marginLeft: 6, fontSize: 10, color: "var(--op-text-muted, #64748b)" }}>
                  {p.etiket}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

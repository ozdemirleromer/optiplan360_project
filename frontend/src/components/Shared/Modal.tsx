import { ReactNode, useEffect, useRef } from "react";
import { COLORS, RADIUS, SHADOWS, TYPOGRAPHY, Z_INDEX } from "./constants";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  wide?: boolean;
  id?: string;
}

export function Modal({ open, onClose, title, subtitle, children, wide = false, id = "modal-dialog" }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Handle focus stealing ONLY when modal opens
  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    const focusableElements = modalRef.current?.querySelectorAll(
      "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
    );
    const firstElement = focusableElements?.[0] as HTMLElement;
    setTimeout(() => firstElement?.focus(), 0);

    return () => {
      previousActiveElement.current?.focus();
    };
  }, [open]);

  // Handle keyboard events (Escape, Tab) without stealing focus again
  useEffect(() => {
    if (!open) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    };

    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      const list = modalRef.current?.querySelectorAll(
        "button, [href], input, select, textarea, [tabindex]:not([tabindex=\"-1\"])"
      );
      if (!list || list.length === 0) return;

      const first = list[0] as HTMLElement;
      const last = list[list.length - 1] as HTMLElement;
      const active = document.activeElement as HTMLElement;

      if (e.shiftKey) {
        if (active === first) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleEscape);
    document.addEventListener("keydown", handleTab);

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.removeEventListener("keydown", handleTab);
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(8px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: Z_INDEX.modal,
          animation: "modalBgIn .2s ease",
        }}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={subtitle ? `${id}-subtitle` : undefined}
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: Z_INDEX.modal + 1,
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            background: COLORS.panel,
            borderRadius: RADIUS.xl,
            border: `1px solid ${COLORS.border2}`,
            width: "90%",
            maxWidth: wide ? 700 : 500,
            maxHeight: "85vh",
            overflowY: "auto",
            boxShadow: SHADOWS["2xl"],
            animation: "modalSlideIn .25s cubic-bezier(.22,1,.36,1)",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              padding: "20px 24px",
              borderBottom: `1px solid ${COLORS.border}`,
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
            }}
          >
            <div style={{ flex: 1 }}>
              <h2
                id={`${id}-title`}
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: TYPOGRAPHY.fontWeight.bold,
                  color: COLORS.text,
                }}
              >
                {title}
              </h2>
              {subtitle ? (
                <p
                  id={`${id}-subtitle`}
                  style={{
                    margin: "6px 0 0",
                    fontSize: 13,
                    color: COLORS.muted,
                  }}
                >
                  {subtitle}
                </p>
              ) : null}
            </div>

            <button
              onClick={onClose}
              aria-label="Kapat"
              type="button"
              style={{
                width: 48,
                height: 48,
                minWidth: 48,
                borderRadius: RADIUS.md,
                background: "transparent",
                border: "none",
                fontSize: 24,
                cursor: "pointer",
                color: COLORS.muted,
                lineHeight: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all .15s ease",
                padding: 0,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `${COLORS.error.DEFAULT}20`;
                e.currentTarget.style.color = COLORS.error.DEFAULT;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
                e.currentTarget.style.color = COLORS.muted;
              }}
            >
              X
            </button>
          </div>

          <div style={{ padding: 24 }}>{children}</div>
        </div>
      </div>

      <style>{`
        @keyframes modalBgIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes modalSlideIn { from { opacity: 0; transform: translateY(-20px) scale(.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </>
  );
}

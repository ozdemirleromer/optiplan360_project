import { type CSSProperties } from "react";
import { useMemo } from "react";

import { Button } from "../../components/Shared";

// ── Stil Sabitler ───────────────────────────────────────────────────────────

const modalTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 15,
  fontWeight: 700,
};

const modalDescStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
};

const labelContainerStyle: CSSProperties = {
  display: "grid",
  gap: 5,
};

const labelTextStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
};

const buttonContainerStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  justifyContent: "flex-end",
};

const whatsappBadgeBaseStyle: CSSProperties = {
  padding: "2px 8px",
  borderRadius: 999,
  fontSize: 10,
  fontWeight: 700,
  border: "1px solid #25D366",
  background: "#25D36618",
  color: "#25D366",
};

const headerFlexStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const waModalDescStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
};

// ── Hatalı Görsel Modal ───────────────────────────────────────────────────────

type ErrorModalProps = {
  show: boolean;
  saving: boolean;
  errorNote: string;
  onNoteChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  modalOverlayStyle: CSSProperties;
  modalPanelStyle: CSSProperties;
  sl200: string;
  sl400: string;
  sl700: string;
  sl900: string;
};

export function ErrorModal({
  show,
  saving,
  errorNote,
  onNoteChange,
  onCancel,
  onConfirm,
  modalOverlayStyle,
  modalPanelStyle,
  sl200,
  sl400,
  sl700,
  sl900,
}: ErrorModalProps) {
  const textareaStyle = useMemo(
    () => ({
      padding: "8px 10px",
      borderRadius: 3,
      border: `1px solid ${sl700}`,
      background: sl900,
      color: sl200,
      fontSize: 13,
      resize: "vertical" as const,
      fontFamily: "inherit",
    } as CSSProperties),
    [sl700, sl900, sl200]
  );

  if (!show) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="err-modal-title"
      aria-describedby="err-modal-desc"
      style={modalOverlayStyle}
    >
      <div style={modalPanelStyle}>
        <h2 id="err-modal-title" style={{ ...modalTitleStyle, color: sl200 }}>
          Kaydı Hatalı İşaretle
        </h2>
        <p id="err-modal-desc" style={{ ...modalDescStyle, color: sl400 }}>
          Bu kayıt hatalı işaretlenecek ve OCR Kontrol kuyruğundan çıkarılacak.
        </p>
        <label style={labelContainerStyle}>
          <span style={{ ...labelTextStyle, color: sl400 }}>Operatör Notu (opsiyonel)</span>
          <textarea
            value={errorNote}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder="Neden hatalı işaretlediğinizi kısaca yazın..."
            rows={3}
            style={textareaStyle}
          />
        </label>
        <div style={buttonContainerStyle}>
          <Button type="button" variant="secondary" onClick={onCancel}>
            İptal
          </Button>
          <Button type="button" variant="danger" onClick={onConfirm} disabled={saving}>
            Hatalı İşaretle
          </Button>
        </div>
      </div>
    </div>
  );
}

// ── WhatsApp Taslak Modal ─────────────────────────────────────────────────────

type WhatsAppModalProps = {
  show: boolean;
  draftText: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
  modalOverlayStyle: CSSProperties;
  modalPanelStyle: CSSProperties;
  sl200: string;
  sl400: string;
  sl700: string;
  sl900: string;
};

export function WhatsAppModal({
  show,
  draftText,
  copied,
  onCopy,
  onClose,
  modalOverlayStyle,
  modalPanelStyle,
  sl200,
  sl400,
  sl700,
  sl900,
}: WhatsAppModalProps) {
  const waTextareaStyle = useMemo(
    () => ({
      padding: "10px 12px",
      borderRadius: 3,
      border: `1px solid ${sl700}`,
      background: sl900,
      color: sl200,
      fontSize: 12,
      resize: "vertical" as const,
      fontFamily: "inherit",
    } as CSSProperties),
    [sl700, sl900, sl200]
  );

  if (!show) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="wa-modal-title"
      aria-describedby="wa-modal-desc"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      style={modalOverlayStyle}
    >
      <div style={{ ...modalPanelStyle, width: "min(520px, 92vw)" }}>
        <div style={headerFlexStyle}>
          <h2 id="wa-modal-title" style={{ ...modalTitleStyle, color: sl200 }}>
            WhatsApp Taslak Mesaj
          </h2>
          <span style={whatsappBadgeBaseStyle}>
            TASLAK
          </span>
        </div>
        <p id="wa-modal-desc" style={{ ...waModalDescStyle, color: sl400 }}>
          Kayıt hatalı işaretlendi. Taslak mesajı gözden geçirin. Bu ekranda gerçek gönderim yapılmaz.
        </p>
        <textarea
          readOnly
          value={draftText}
          rows={8}
          style={waTextareaStyle}
        />
        <div style={buttonContainerStyle}>
          <Button type="button" variant="secondary" onClick={onCopy}>
            {copied ? "Kopyalandı ✓" : "Kopyala"}
          </Button>
          <Button type="button" onClick={onClose}>
            Kapat
          </Button>
        </div>
      </div>
    </div>
  );
}

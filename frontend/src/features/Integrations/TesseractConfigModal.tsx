import { useState, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY, Z_INDEX } from "../../components/Shared/constants";
import { adminService } from "../../services/adminService";

interface TesseractConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: TesseractConfig) => void;
  initialConfig?: TesseractConfig;
}

export interface TesseractConfig {
  languages: string;
  tesseractPath: string;
  preprocessingEnabled: boolean;
  confidenceThreshold: number;
  enabled: boolean;
}

const defaultConfig: TesseractConfig = {
  languages: "tur+eng",
  tesseractPath: "/usr/bin/tesseract",
  preprocessingEnabled: true,
  confidenceThreshold: 70,
  enabled: false,
};

export function TesseractConfigModal({ isOpen, onClose, onSave, initialConfig }: TesseractConfigModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<TesseractConfig>(initialConfig || defaultConfig);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleChange = useCallback((field: keyof TesseractConfig, value: string | boolean | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await adminService.updateOCRConfig({
        engine: "tesseract",
        languages: config.languages.split("+"),
        preprocessing_enabled: config.preprocessingEnabled,
        confidence_threshold: config.confidenceThreshold / 100,
      });
      onSave(config);
      onClose();
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : "Kaydetme ba\u015Far\u0131s\u0131z" });
    } finally {
      setSaving(false);
    }
  }, [config, onSave, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const prevFocus = document.activeElement as HTMLElement;
    const focusable = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const first = focusable?.[0] as HTMLElement;
    setTimeout(() => first?.focus(), 0);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); onClose(); return; }
      if (e.key !== "Tab" || !focusable?.length) return;
      const last = focusable[focusable.length - 1] as HTMLElement;
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => { document.removeEventListener("keydown", handleKeyDown); prevFocus?.focus(); };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: Z_INDEX.modal, padding: 24 }}
      onClick={onClose} role="presentation" aria-hidden="true"
    >
      <Card ref={modalRef} style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="config-modal-title"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h2 id="config-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>Tesseract OCR Yap\u0131land\u0131rmas\u0131</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>Yerel OCR motoru ayarlar\u0131</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: RADIUS.md, color: COLORS.muted }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, background: `${COLORS.primary}10`, borderRadius: RADIUS.md, border: `1px solid ${COLORS.primary}30` }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>Servis Durumu</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Tesseract OCR'u aktif/pasif yap</div>
            </div>
            <button type="button" onClick={() => handleChange("enabled", !config.enabled)} style={{ padding: "6px 12px", borderRadius: RADIUS.md, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: config.enabled ? COLORS.success : COLORS.muted, color: "white" }}>
              {config.enabled ? "Aktif" : "Pasif"}
            </button>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>Diller (Language Codes) <span style={{ color: COLORS.danger }}>*</span></label>
            <input type="text" value={config.languages} onChange={(e) => handleChange("languages", e.target.value)} placeholder="tur+eng" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, background: "transparent", color: COLORS.text }} />
            <p style={{ margin: "4px 0 0", fontSize: 11, color: COLORS.muted }}>Birden fazla dil i\u00E7in + i\u015Fareti kullan\u0131n (\u00F6rn: tur+eng)</p>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>Tesseract Yolu (Opsiyonel)</label>
            <input type="text" value={config.tesseractPath} onChange={(e) => handleChange("tesseractPath", e.target.value)} placeholder="/usr/bin/tesseract" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, background: "transparent", color: COLORS.text }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>G\u00FCven E\u015Fi\u011Fi (%)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input type="range" min="50" max="95" value={config.confidenceThreshold} onChange={(e) => handleChange("confidenceThreshold", parseInt(e.target.value))} style={{ flex: 1 }} />
              <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.text, minWidth: 40 }}>{config.confidenceThreshold}%</span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, background: `${COLORS.primary}05`, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}` }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>\u00D6n \u0130\u015Fleme (Preprocessing)</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>G\u00F6r\u00FCnt\u00FC iyile\u015Ftirme ad\u0131mlar\u0131n\u0131 uygula</div>
            </div>
            <button type="button" onClick={() => handleChange("preprocessingEnabled", !config.preprocessingEnabled)} style={{ padding: "6px 12px", borderRadius: RADIUS.md, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: config.preprocessingEnabled ? COLORS.primary : COLORS.muted, color: "white" }}>
              {config.preprocessingEnabled ? "Aktif" : "Pasif"}
            </button>
          </div>

          {testResult && (
            <div style={{ padding: 12, borderRadius: RADIUS.md, background: testResult.success ? `${COLORS.success}15` : `${COLORS.danger}15`, border: `1px solid ${testResult.success ? COLORS.success : COLORS.danger}30` }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: testResult.success ? COLORS.success : COLORS.danger, display: "flex", alignItems: "center", gap: 8 }}>
                {testResult.success ? "[OK]" : "[HATA]"} {testResult.message}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={onClose}>\u0130ptal</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !config.languages}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

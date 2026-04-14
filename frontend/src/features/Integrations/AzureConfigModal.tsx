import { useState, useCallback, useEffect, useRef } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY, Z_INDEX } from "../../components/Shared/constants";
import { adminService } from "../../services/adminService";

interface AzureConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: AzureConfig) => void;
  initialConfig?: AzureConfig;
}

export interface AzureConfig {
  ocrEndpoint: string;
  ocrKey: string;
  ocrRegion: string;
  blobConnectionString?: string;
  blobContainer?: string;
  enabled: boolean;
}

const defaultConfig: AzureConfig = {
  ocrEndpoint: "",
  ocrKey: "",
  ocrRegion: "westeurope",
  blobConnectionString: "",
  blobContainer: "",
  enabled: false,
};

export function AzureConfigModal({ isOpen, onClose, onSave, initialConfig }: AzureConfigModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [config, setConfig] = useState<AzureConfig>(initialConfig || defaultConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback((field: keyof AzureConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await adminService.testAzureOCR();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Ba\u011Flant\u0131 testi ba\u015Far\u0131s\u0131z"
      });
    } finally {
      setTesting(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await adminService.updateAzureConfig({
        ocr_endpoint: config.ocrEndpoint,
        ocr_key: config.ocrKey,
        ocr_region: config.ocrRegion,
        blob_connection_string: config.blobConnectionString,
        blob_container: config.blobContainer,
        enabled: config.enabled,
      });
      onSave(config);
      onClose();
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Kaydetme ba\u015Far\u0131s\u0131z"
      });
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
    <div
      style={{
        position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
        background: "rgba(0,0,0,0.6)", display: "flex",
        alignItems: "center", justifyContent: "center",
        zIndex: Z_INDEX.modal, padding: 24,
      }}
      onClick={onClose}
      role="presentation"
      aria-hidden="true"
    >
      <Card
        ref={modalRef}
        style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflow: "auto" }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="config-modal-title"
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, paddingBottom: 16, borderBottom: `1px solid ${COLORS.border}` }}>
          <div>
            <h2 id="config-modal-title" style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
              Azure Computer Vision Yap\u0131land\u0131rmas\u0131
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
              Microsoft Azure OCR servisi ayarlar\u0131
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Kapat" style={{ background: "none", border: "none", cursor: "pointer", padding: 8, borderRadius: RADIUS.md, color: COLORS.muted }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: 12, background: `${COLORS.primary}10`, borderRadius: RADIUS.md, border: `1px solid ${COLORS.primary}30` }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>Servis Durumu</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Azure OCR servisini aktif/pasif yap</div>
            </div>
            <button type="button" onClick={() => handleChange("enabled", !config.enabled)} style={{ padding: "6px 12px", borderRadius: RADIUS.md, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 500, background: config.enabled ? COLORS.success : COLORS.muted, color: "white" }}>
              {config.enabled ? "Aktif" : "Pasif"}
            </button>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              OCR Endpoint URL <span style={{ color: COLORS.danger }}>*</span>
            </label>
            <input type="url" value={config.ocrEndpoint} onChange={(e) => handleChange("ocrEndpoint", e.target.value)} placeholder="https://<resource>.cognitiveservices.azure.com/" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, background: "transparent", color: COLORS.text }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Subscription Key <span style={{ color: COLORS.danger }}>*</span>
            </label>
            <input type="password" value={config.ocrKey} onChange={(e) => handleChange("ocrKey", e.target.value)} placeholder="\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, background: "transparent", color: COLORS.text }} />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              B\u00F6lge (Region)
            </label>
            <select value={config.ocrRegion} onChange={(e) => handleChange("ocrRegion", e.target.value)} style={{ width: "100%", padding: "10px 12px", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, fontSize: 14, fontFamily: TYPOGRAPHY.fontFamily.base, background: "transparent", color: COLORS.text }}>
              <option value="westeurope">West Europe</option>
              <option value="northeurope">North Europe</option>
              <option value="eastus">East US</option>
              <option value="westus">West US</option>
              <option value="southeastasia">Southeast Asia</option>
            </select>
          </div>

          {testResult && (
            <div style={{ padding: 12, borderRadius: RADIUS.md, background: testResult.success ? `${COLORS.success}15` : `${COLORS.danger}15`, border: `1px solid ${testResult.success ? COLORS.success : COLORS.danger}30` }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: testResult.success ? COLORS.success : COLORS.danger, display: "flex", alignItems: "center", gap: 8 }}>
                {testResult.success ? "[OK]" : "[HATA]"} {testResult.message}
              </div>
            </div>
          )}

          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <Button variant="secondary" size="sm" onClick={handleTest} disabled={testing || !config.ocrEndpoint || !config.ocrKey}>
              {testing ? "Test Ediliyor..." : "Ba\u011Flant\u0131 Testi"}
            </Button>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={onClose}>\u0130ptal</Button>
            <Button variant="primary" size="sm" onClick={handleSave} disabled={saving || !config.ocrEndpoint || !config.ocrKey}>
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

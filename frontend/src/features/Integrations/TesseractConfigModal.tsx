import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
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
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Kaydetme başarısız"
      });
    } finally {
      setSaving(false);
    }
  }, [config, onSave, onClose]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 24,
      }}
      onClick={onClose}
    >
      <Card
        style={{
          width: "100%",
          maxWidth: 560,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 20,
            paddingBottom: 16,
            borderBottom: `1px solid ${COLORS.border}`,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
              Tesseract OCR Yapılandırması
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
              Yerel OCR motoru ayarları
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              borderRadius: RADIUS.md,
              color: COLORS.muted,
            }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ display: "grid", gap: 16 }}>
          {/* Aktif/Pasif Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              background: `${COLORS.primary[500]}10`,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.primary[500]}30`,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>Servis Durumu</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Tesseract OCR'u aktif/pasif yap</div>
            </div>
            <button
              onClick={() => handleChange("enabled", !config.enabled)}
              style={{
                padding: "6px 12px",
                borderRadius: RADIUS.md,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                background: config.enabled ? COLORS.success.DEFAULT : COLORS.muted,
                color: "white",
              }}
            >
              {config.enabled ? "Aktif" : "Pasif"}
            </button>
          </div>

          {/* Languages */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Diller (Language Codes) <span style={{ color: COLORS.error.DEFAULT }}>*</span>
            </label>
            <input
              type="text"
              value={config.languages}
              onChange={(e) => handleChange("languages", e.target.value)}
              placeholder="tur+eng"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`,
                fontSize: 14,
                fontFamily: TYPOGRAPHY.fontFamily.base,
                background: "transparent",
                color: COLORS.text,
              }}
            />
            <p style={{ margin: "4px 0 0", fontSize: 11, color: COLORS.muted }}>
              Birden fazla dil için + işareti kullanın (örn: tur+eng)
            </p>
          </div>

          {/* Tesseract Path */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Tesseract Yolu (Opsiyonel)
            </label>
            <input
              type="text"
              value={config.tesseractPath}
              onChange={(e) => handleChange("tesseractPath", e.target.value)}
              placeholder="/usr/bin/tesseract"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: RADIUS.md,
                border: `1px solid ${COLORS.border}`,
                fontSize: 14,
                fontFamily: TYPOGRAPHY.fontFamily.base,
                background: "transparent",
                color: COLORS.text,
              }}
            />
          </div>

          {/* Confidence Threshold */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Güven Eşiği (%)
            </label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <input
                type="range"
                min="50"
                max="95"
                value={config.confidenceThreshold}
                onChange={(e) => handleChange("confidenceThreshold", parseInt(e.target.value))}
                style={{ flex: 1 }}
              />
              <span style={{ fontSize: 14, fontWeight: 500, color: COLORS.text, minWidth: 40 }}>
                {config.confidenceThreshold}%
              </span>
            </div>
          </div>

          {/* Preprocessing Toggle */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 12,
              background: `${COLORS.primary[500]}05`,
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>Ön İşleme (Preprocessing)</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Görüntü iyileştirme adımlarını uygula</div>
            </div>
            <button
              onClick={() => handleChange("preprocessingEnabled", !config.preprocessingEnabled)}
              style={{
                padding: "6px 12px",
                borderRadius: RADIUS.md,
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 500,
                background: config.preprocessingEnabled ? COLORS.info.DEFAULT : COLORS.muted,
                color: "white",
              }}
            >
              {config.preprocessingEnabled ? "Aktif" : "Pasif"}
            </button>
          </div>

          {/* Test Sonucu */}
          {testResult && (
            <div
              style={{
                padding: 12,
                borderRadius: RADIUS.md,
                background: testResult.success
                  ? `${COLORS.success.DEFAULT}15`
                  : `${COLORS.error.DEFAULT}15`,
                border: `1px solid ${testResult.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT}30`,
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 500,
                  color: testResult.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                {testResult.success ? "[OK]" : "[HATA]"} {testResult.message}
              </div>
            </div>
          )}

          {/* Butonlar */}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={onClose}>
              İptal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || !config.languages}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

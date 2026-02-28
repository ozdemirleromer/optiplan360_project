import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
import { adminService } from "../../services/adminService";

interface GoogleConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: GoogleConfig) => void;
  initialConfig?: GoogleConfig;
}

export interface GoogleConfig {
  apiKey: string;
  projectId: string;
  location: string;
  enabled: boolean;
}

const defaultConfig: GoogleConfig = {
  apiKey: "",
  projectId: "",
  location: "us",
  enabled: false,
};

export function GoogleConfigModal({ isOpen, onClose, onSave, initialConfig }: GoogleConfigModalProps) {
  const [config, setConfig] = useState<GoogleConfig>(initialConfig || defaultConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback((field: keyof GoogleConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await adminService.testGoogle();
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Bağlantı testi başarısız"
      });
    } finally {
      setTesting(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await adminService.updateGoogleConfig({
        api_key: config.apiKey,
        project_id: config.projectId,
        location: config.location,
        enabled: config.enabled,
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
              Google Vision API Yapılandırması
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
              Google Cloud OCR servisi ayarları
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
              <div style={{ fontSize: 12, color: COLORS.muted }}>Google Vision servisini aktif/pasif yap</div>
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

          {/* API Key */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              API Key <span style={{ color: COLORS.error.DEFAULT }}>*</span>
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => handleChange("apiKey", e.target.value)}
              placeholder="AIzaSy..."
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

          {/* Project ID */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Project ID <span style={{ color: COLORS.error.DEFAULT }}>*</span>
            </label>
            <input
              type="text"
              value={config.projectId}
              onChange={(e) => handleChange("projectId", e.target.value)}
              placeholder="my-project-123456"
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

          {/* Location */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Location
            </label>
            <select
              value={config.location}
              onChange={(e) => handleChange("location", e.target.value)}
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
            >
              <option value="us">United States (us)</option>
              <option value="eu">European Union (eu)</option>
              <option value="asia-east1">Taiwan (asia-east1)</option>
              <option value="asia-northeast1">Japan (asia-northeast1)</option>
            </select>
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
            <Button
              variant="secondary"
              size="sm"
              onClick={handleTest}
              disabled={testing || !config.apiKey || !config.projectId}
            >
              {testing ? "Test Ediliyor..." : "Bağlantı Testi"}
            </Button>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={onClose}>
              İptal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || !config.apiKey || !config.projectId}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

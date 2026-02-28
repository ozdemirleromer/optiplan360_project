import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
import { adminService } from "../../services/adminService";

interface EmailConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: EmailConfig) => void;
  initialConfig?: EmailConfig;
}

export interface EmailConfig {
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPass: string;
  imapMailbox: string;
  useSsl: boolean;
  enabled: boolean;
}

const defaultConfig: EmailConfig = {
  imapHost: "",
  imapPort: 993,
  imapUser: "",
  imapPass: "",
  imapMailbox: "INBOX",
  useSsl: true,
  enabled: false,
};

export function EmailConfigModal({ isOpen, onClose, onSave, initialConfig }: EmailConfigModalProps) {
  const [config, setConfig] = useState<EmailConfig>(initialConfig || defaultConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback((field: keyof EmailConfig, value: string | boolean | number) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await adminService.testEmail();
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
      await adminService.updateEmailConfig({
        imap_host: config.imapHost,
        imap_port: config.imapPort,
        imap_user: config.imapUser,
        imap_pass: config.imapPass,
        imap_mailbox: config.imapMailbox,
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
              Email OCR Yapılandırması
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
              IMAP email entegrasyonu ayarları
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
              <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>Email Entegrasyonu</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Email OCR'u aktif/pasif yap</div>
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

          {/* IMAP Host */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              IMAP Sunucu <span style={{ color: COLORS.error.DEFAULT }}>*</span>
            </label>
            <input
              type="text"
              value={config.imapHost}
              onChange={(e) => handleChange("imapHost", e.target.value)}
              placeholder="imap.gmail.com"
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

          {/* IMAP Port & SSL */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                Port
              </label>
              <input
                type="number"
                value={config.imapPort}
                onChange={(e) => handleChange("imapPort", parseInt(e.target.value) || 993)}
                placeholder="993"
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
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
                SSL/TLS
              </label>
              <button
                onClick={() => handleChange("useSsl", !config.useSsl)}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`,
                  fontSize: 14,
                  fontFamily: TYPOGRAPHY.fontFamily.base,
                  background: config.useSsl ? `${COLORS.success.DEFAULT}20` : "transparent",
                  color: config.useSsl ? COLORS.success.DEFAULT : COLORS.text,
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                {config.useSsl ? "[Aktif] SSL Aktif" : "SSL Pasif"}
              </button>
            </div>
          </div>

          {/* IMAP User */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Email Adresi <span style={{ color: COLORS.error.DEFAULT }}>*</span>
            </label>
            <input
              type="email"
              value={config.imapUser}
              onChange={(e) => handleChange("imapUser", e.target.value)}
              placeholder="ornek@email.com"
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

          {/* IMAP Password */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Şifre / Uygulama Şifresi <span style={{ color: COLORS.error.DEFAULT }}>*</span>
            </label>
            <input
              type="password"
              value={config.imapPass}
              onChange={(e) => handleChange("imapPass", e.target.value)}
              placeholder="••••••••••••"
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
              Gmail için uygulama şifresi kullanın
            </p>
          </div>

          {/* Mailbox */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Mailbox
            </label>
            <input
              type="text"
              value={config.imapMailbox}
              onChange={(e) => handleChange("imapMailbox", e.target.value)}
              placeholder="INBOX"
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
              disabled={testing || !config.imapHost || !config.imapUser || !config.imapPass}
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
              disabled={saving || !config.imapHost || !config.imapUser || !config.imapPass}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

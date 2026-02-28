import { useState, useCallback } from "react";
import { X } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
import { adminService } from "../../services/adminService";

interface TelegramConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: TelegramConfig) => void;
  initialConfig?: TelegramConfig;
}

export interface TelegramConfig {
  botToken: string;
  allowedChatId: string;
  webhookSecret: string;
  enabled: boolean;
}

const defaultConfig: TelegramConfig = {
  botToken: "",
  allowedChatId: "",
  webhookSecret: "",
  enabled: false,
};

export function TelegramConfigModal({ isOpen, onClose, onSave, initialConfig }: TelegramConfigModalProps) {
  const [config, setConfig] = useState<TelegramConfig>(initialConfig || defaultConfig);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const handleChange = useCallback((field: keyof TelegramConfig, value: string | boolean) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTestResult(null);
  }, []);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await adminService.testTelegram();
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
      await adminService.updateTelegramConfig({
        bot_token: config.botToken,
        allowed_chat_id: config.allowedChatId,
        webhook_secret: config.webhookSecret,
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
              Telegram OCR Bot Yapılandırması
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
              Telegram bot entegrasyonu ayarları
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
              <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>Bot Durumu</div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>Telegram botunu aktif/pasif yap</div>
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

          {/* Bot Token */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Bot Token <span style={{ color: COLORS.error.DEFAULT }}>*</span>
            </label>
            <input
              type="password"
              value={config.botToken}
              onChange={(e) => handleChange("botToken", e.target.value)}
              placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
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
              BotFather'dan aldığınız bot token'ı
            </p>
          </div>

          {/* Allowed Chat ID */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              İzin Verilen Chat ID
            </label>
            <input
              type="text"
              value={config.allowedChatId}
              onChange={(e) => handleChange("allowedChatId", e.target.value)}
              placeholder="123456789"
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
              Sadece bu chat ID'den gelen mesajlar işlenecek (boş bırakılırsa herkes)
            </p>
          </div>

          {/* Webhook Secret */}
          <div>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 6 }}>
              Webhook Secret (Opsiyonel)
            </label>
            <input
              type="password"
              value={config.webhookSecret}
              onChange={(e) => handleChange("webhookSecret", e.target.value)}
              placeholder="gizli-anahtar"
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
              disabled={testing || !config.botToken}
            >
              {testing ? "Test Ediliyor..." : "Bot Testi"}
            </Button>
            <div style={{ flex: 1 }} />
            <Button variant="ghost" size="sm" onClick={onClose}>
              İptal
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              disabled={saving || !config.botToken}
            >
              {saving ? "Kaydediliyor..." : "Kaydet"}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

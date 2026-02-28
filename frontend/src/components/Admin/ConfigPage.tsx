/**
 * Config Page - System configuration & theme selector
 */

import { useState, useEffect, useCallback } from "react";
import { TopBar } from "../Layout";
import { Button, Card } from "../Shared";
import { COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from "../Shared/constants";
import { THEME_LIST } from "../../themes";
import { useUIStore } from "../../stores/uiStore";
import { useToast } from "../../contexts/ToastContext";
import { adminService } from "../../services/adminService";
import { Palette, Check, Shield, Plug, Loader2 } from "lucide-react";

type FeatureFlag = {
  name: string;
  enabled: boolean;
  updated_at?: string | null;
  updatedAt?: string | null;
};

const FEATURE_LABELS: Record<string, { label: string; description: string }> = {
  ai_orchestrator: { label: "AI Orkestratör", description: "Yapay zeka tabanlı iş akışı optimizasyonu" },
  whatsapp_integration: { label: "WhatsApp Entegrasyonu", description: "WhatsApp üzerinden müşteri bildirimleri" },
  mikro_integration: { label: "Mikro ERP", description: "Mikro muhasebe yazılımı ile MsSQL entegrasyonu" },
  ocr_enabled: { label: "OCR Motoru", description: "Optik karakter tanıma ile sipariş okuma" },
  compliance_checks: { label: "Uyumluluk Kontrolleri", description: "Otomatik kalite ve uyumluluk denetimi" },
  advanced_analytics: { label: "Gelişmiş Analitik", description: "AI destekli tahmin ve kapasite planlaması" },
  beta_features: { label: "Beta Özellikler", description: "Deneysel özellikler (kararsız olabilir)" },
};

export function ConfigPage() {
  const [activeSection, setActiveSection] = useState<"theme" | "system" | "services">("theme");
  const [saving, setSaving] = useState(false);
  const [features, setFeatures] = useState<FeatureFlag[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(false);
  const [togglingFlag, setTogglingFlag] = useState<string | null>(null);

  const currentTheme = useUIStore((s) => s.themeName);
  const setThemeName = useUIStore((s) => s.setThemeName);
  const { addToast } = useToast();

  const loadFeatures = useCallback(async () => {
    setFeaturesLoading(true);
    try {
      const data = await adminService.getFeatureFlags();
      setFeatures(data.features ?? []);
    } catch {
      setFeatures([]);
    } finally {
      setFeaturesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeSection === "services") {
      void loadFeatures();
    }
  }, [activeSection, loadFeatures]);

  const handleToggleFeature = async (flag: FeatureFlag) => {
    setTogglingFlag(flag.name);
    try {
      await adminService.updateFeatureFlag(flag.name, !flag.enabled);
      setFeatures((prev) =>
        prev.map((f) => (f.name === flag.name ? { ...f, enabled: !f.enabled } : f))
      );
      const info = FEATURE_LABELS[flag.name];
      addToast(`${info?.label ?? flag.name} ${!flag.enabled ? "etkinleştirildi" : "devre dışı bırakıldı"}`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "İşlem başarısız";
      addToast(msg, "error");
    } finally {
      setTogglingFlag(null);
    }
  };

  const controlMatrix = [
    {
      category: "Sipariş Yönetimi",
      items: [
        { id: 1, scenario: "Yeni sipariş oluşturulur", action: "Tekil kontrol" },
        { id: 2, scenario: "Sipariş güncellenir", action: "Versiyon kontrol" },
        { id: 3, scenario: "Sipariş silinir", action: "Geçici silme" },
        { id: 4, scenario: "Toplu sipariş eklenir", action: "İşlem bütünlüğü kontrolü" },
      ]
    },
    {
      category: "İstasyon Yönetimi",
      items: [
        { id: 5, scenario: "İstasyon oluşturulur", action: "İsim tekil kontrolü" },
        { id: 6, scenario: "İstasyon kaldırılır", action: "Alt bağımlılıklar kontrol" },
        { id: 7, scenario: "İş akışı değiştirilir", action: "Aktif sipariş kontrol" },
      ]
    },
    {
      category: "Kullanıcı Yönetimi",
      items: [
        { id: 8, scenario: "Kullanıcı oluşturulur", action: "E-posta tekil kontrolü" },
        { id: 9, scenario: "Şifre değiştirilir", action: "Güçlü şifre kontrol" },
        { id: 10, scenario: "Hesap silinir", action: "30 gün saklama" },
      ]
    },
    {
      category: "Sistem Güvenliği",
      items: [
        { id: 11, scenario: "API istek sınırı aşılır", action: "429 döndür" },
        { id: 12, scenario: "Geçersiz token", action: "401 döndür" },
        { id: 13, scenario: "SQL enjeksiyon denemesi", action: "IP banla" },
      ]
    },
  ];

  const handleSave = async () => {
    setSaving(true);
    try {
      await new Promise((resolve) => setTimeout(resolve, 800));
      addToast("Sistem ayarları kaydedildi", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Ayarlar kaydedilemedi";
      addToast(message, "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="electric-page">
      <TopBar title="Sistem Ayarları" subtitle="Konfigürasyon ve denetim matrisi" />

      <div className="app-page-container">
        {/* Section Tabs */}
        <div style={{ display: "flex", gap: "2px", marginBottom: "24px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          {([
            { key: "theme" as const, label: "Tema Ayarları", icon: undefined },
            { key: "system" as const, label: "Sistem Kontrolü", icon: undefined },
            { key: "services" as const, label: "Servisler", icon: <Plug size={14} /> },
          ]).map(({ key, label, icon }) => (
            <button
              key={key}
              onClick={() => setActiveSection(key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: activeSection === key ? 700 : 400,
                color: activeSection === key ? COLORS.primary.DEFAULT : COLORS.muted,
                background: activeSection === key ? `${COLORS.primary.DEFAULT}08` : "transparent",
                border: "none",
                borderBottom: activeSection === key ? `3px solid ${COLORS.primary.DEFAULT}` : "3px solid transparent",
                cursor: "pointer",
                fontFamily: TYPOGRAPHY.fontFamily.base,
                marginBottom: "-1px",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>

        {activeSection === "theme" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "12px" }}>
            {THEME_LIST.map((theme) => {
              const isActive = currentTheme === theme.name;
              return (
                <div
                  key={theme.name}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    setThemeName(theme.name);
                    addToast(`Tema "${theme.label}" uygulandi`, "success");
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setThemeName(theme.name);
                      addToast(`Tema "${theme.label}" uygulandi`, "success");
                    }
                  }}
                  style={{
                    cursor: "pointer",
                    borderRadius: RADIUS.md,
                    overflow: "hidden",
                    outline: "none",
                    transition: "all 0.18s ease",
                    transform: isActive ? "translateY(-2px)" : "none",
                    boxShadow: isActive
                      ? `0 6px 20px ${primaryRgba(0.35)}, 0 0 0 2px ${COLORS.primary.DEFAULT}`
                      : `0 2px 8px ${primaryRgba(0.14)}`,
                  }}
                >
                  {/* Üst şerit — tema ana rengiyle dolu */}
                  <div
                    style={{
                      background: `linear-gradient(135deg, ${theme.preview.primary}, ${theme.preview.accent})`,
                      padding: "14px 14px 12px",
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#ffffff", letterSpacing: "0.01em" }}>
                        {theme.label}
                      </span>
                      {isActive && (
                        <Check size={15} color="#ffffff" strokeWidth={3} />
                      )}
                    </div>
                    {/* Renk nokta önizleme */}
                    <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.bg, border: "1.5px solid rgba(255,255,255,0.4)" }} />
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#ffffff", opacity: 0.7 }} />
                      <div style={{ width: 12, height: 12, borderRadius: "50%", background: theme.preview.accent, border: "1.5px solid rgba(255,255,255,0.4)" }} />
                    </div>
                  </div>
                  {/* Alt açıklama */}
                  <div
                    style={{
                      background: isActive ? primaryRgba(0.10) : COLORS.bg.elevated,
                      padding: "8px 12px 10px",
                      borderTop: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div style={{ fontSize: 11, color: COLORS.muted, lineHeight: 1.45 }}>
                      {theme.description}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}


        {/* System Control Matrix */}
        {activeSection === "system" && (
          <>
            <Card
              title="Denetim Matrisi"
              subtitle="Sistem işlemleri için kontrol senaryoları"
              actions={
                <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </Button>
              }
            >
              <div style={{ display: "grid", gap: "16px" }}>
                {controlMatrix.map((group) => (
                  <div
                    key={group.category}
                    style={{
                      padding: "16px",
                      background: COLORS.bg.surface,
                      borderRadius: RADIUS.md,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div style={{ fontSize: 14, fontWeight: 600, color: COLORS.text, marginBottom: "12px", display: "flex", alignItems: "center", gap: "8px" }}>
                      <Shield size={16} color={COLORS.primary.DEFAULT} />
                      {group.category}
                    </div>
                    <div style={{ display: "grid", gap: "8px" }}>
                      {group.items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            padding: "10px",
                            background: COLORS.bg.main,
                            borderRadius: RADIUS.sm,
                            border: `1px solid ${COLORS.border}`,
                            display: "grid",
                            gridTemplateColumns: "2fr 1fr",
                            gap: "12px",
                            fontSize: 12,
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 600, color: COLORS.text, marginBottom: "2px" }}>
                              {item.scenario}
                            </div>
                            <div style={{ fontSize: 11, color: COLORS.muted }}>Aksiyon: {item.action}</div>
                          </div>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <div
                              style={{
                                width: "16px",
                                height: "16px",
                                borderRadius: "50%",
                                background: COLORS.success.DEFAULT,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              <Check size={12} color="white" />
                            </div>
                            <span style={{ marginLeft: "8px", color: COLORS.muted }}>Aktif</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </>
        )}

        {/* API Servisleri */}
        {activeSection === "services" && (
          <Card
            title="API Servisleri"
            subtitle="Harici entegrasyonları ve sistem modüllerini buradan yönetin"
            actions={
              <Button variant="secondary" size="sm" onClick={loadFeatures} disabled={featuresLoading}>
                {featuresLoading ? "Yükleniyor..." : "Yenile"}
              </Button>
            }
          >
            {featuresLoading && features.length === 0 ? (
              <div style={{ display: "flex", justifyContent: "center", padding: 32, color: COLORS.muted }}>
                <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} />
                <span style={{ marginLeft: 8 }}>Servis durumları yükleniyor...</span>
              </div>
            ) : features.length === 0 ? (
              <div style={{ textAlign: "center", padding: 32, color: COLORS.muted, fontSize: 13 }}>
                Servis bilgisi alınamadı. Backend bağlantısını kontrol edin.
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
                {features.map((flag) => {
                  const info = FEATURE_LABELS[flag.name] ?? { label: flag.name, description: "" };
                  const isToggling = togglingFlag === flag.name;
                  return (
                    <div
                      key={flag.name}
                      style={{
                        padding: 16,
                        background: flag.enabled ? "rgba(34,197,94,0.04)" : COLORS.bg.surface,
                        border: `1px solid ${flag.enabled ? "rgba(34,197,94,0.3)" : COLORS.border}`,
                        borderRadius: RADIUS.md,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                        gap: 12,
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <Plug size={14} color={flag.enabled ? COLORS.success.DEFAULT : COLORS.muted} />
                          <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>{info.label}</span>
                        </div>
                        <div style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.4 }}>{info.description}</div>
                        <div style={{ marginTop: 8 }}>
                          <span
                            style={{
                              fontSize: 11,
                              padding: "2px 8px",
                              borderRadius: RADIUS.sm,
                              background: flag.enabled ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.08)",
                              color: flag.enabled ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
                              fontWeight: 500,
                            }}
                          >
                            {flag.enabled ? "Aktif" : "Devre Dışı"}
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => void handleToggleFeature(flag)}
                        disabled={isToggling}
                        aria-label={`${info.label} ${flag.enabled ? "devre dışı bırak" : "etkinleştir"}`}
                        style={{
                          width: 44,
                          height: 24,
                          borderRadius: 12,
                          border: "none",
                          cursor: isToggling ? "wait" : "pointer",
                          background: flag.enabled ? COLORS.success.DEFAULT : COLORS.gray[400],
                          position: "relative",
                          transition: "background 0.2s",
                          flexShrink: 0,
                          opacity: isToggling ? 0.6 : 1,
                        }}
                      >
                        <div
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: "50%",
                            background: "white",
                            position: "absolute",
                            top: 3,
                            left: flag.enabled ? 23 : 3,
                            transition: "left 0.2s",
                          }}
                        />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}

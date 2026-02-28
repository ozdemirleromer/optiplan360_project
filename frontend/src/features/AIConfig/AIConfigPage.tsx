import { useState, useEffect, useCallback } from "react";
import {
  Bot,
  Key,
  TestTube,
  CheckCircle,
  AlertCircle,
  Loader2,
  Plus,
  Trash2,
  ArrowLeftRight,
} from "lucide-react";
import { TopBar } from "../../components/Layout";
import { Button, Badge, Input, Select, COLORS, RADIUS } from "../../components/Shared";
import { apiRequest } from "../../services/apiClient";

// ── Tipler ───────────────────────────────────────────────────────────────────

type TabId = "providers" | "status" | "test";

interface AIProvider {
  provider: string;
  name: string;
  models: string[];
  description: string;
}

interface AIConfigData {
  model: string;
  updated_at?: string;
  updated_by?: string;
}

interface AIStatus {
  current_provider: string | null;
  configured_providers: string[];
  services: Record<string, {
    configured: boolean;
    active: boolean;
    model: string;
    last_updated?: string;
  }>;
}

interface FormData {
  provider: string;
  api_key: string;
  model: string;
  endpoint: string;
  temperature: number;
  max_tokens: number;
  is_active: boolean;
}

type Feedback = { type: "success" | "error"; text: string } | null;

// ── Sabitler ─────────────────────────────────────────────────────────────────

const PROVIDERS: AIProvider[] = [
  { provider: "gemini",  name: "Google Gemini", models: ["gemini-1.5-pro", "gemini-1.5-pro-vision"], description: "Google'ın çok modelli AI modeli" },
  { provider: "openai",  name: "OpenAI GPT",    models: ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo"],   description: "OpenAI'nin dil modeli" },
  { provider: "custom",  name: "Özel API",       models: ["custom"],                                   description: "Özel AI API endpoint'i" },
];

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "providers", label: "Provider'lar",      icon: <Bot size={14} /> },
  { id: "status",    label: "Durum",             icon: <CheckCircle size={14} /> },
  { id: "test",      label: "Bağlantı Testi",   icon: <TestTube size={14} /> },
];

const cardStyle: React.CSSProperties = {
  background: COLORS.surface,
  border: `1px solid ${COLORS.border}`,
  borderRadius: RADIUS.lg,
  padding: 20,
};

const DEFAULT_FORM: FormData = {
  provider: "gemini",
  api_key: "",
  model: "gemini-1.5-pro",
  endpoint: "",
  temperature: 0.7,
  max_tokens: 8192,
  is_active: true,
};

// ── Yardımcı: inline label ────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: COLORS.text }}>
      {children}
    </div>
  );
}

// ── Ana bileşen ───────────────────────────────────────────────────────────────

export default function AIConfigPage() {
  const [activeTab, setActiveTab] = useState<TabId>("providers");
  const [config, setConfig]       = useState<Record<string, AIConfigData> | null>(null);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [status, setStatus]       = useState<AIStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [feedback, setFeedback]   = useState<Feedback>(null);
  const [formData, setFormData]   = useState<FormData>(DEFAULT_FORM);

  const loadConfig = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await apiRequest<{ providers: Record<string, AIConfigData>; current_provider: string | null }>("/config/ai");
      setConfig(data.providers ?? {});
      setCurrentProvider(data.current_provider ?? null);
    } catch (err) {
      console.error("Config yüklenemedi:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async () => {
    try {
      const data = await apiRequest<AIStatus>("/config/ai/status");
      setStatus(data);
    } catch (err) {
      console.error("Status yüklenemedi:", err);
    }
  }, []);

  useEffect(() => {
    void loadConfig();
    void loadStatus();
  }, [loadConfig, loadStatus]);

  const handleSaveConfig = async () => {
    if (!formData.api_key.trim()) {
      setFeedback({ type: "error", text: "API anahtarı gereklidir." });
      return;
    }
    setIsLoading(true);
    setFeedback(null);
    try {
      await apiRequest("/config/ai", {
        method: "POST",
        body: JSON.stringify(formData),
      });
      setFeedback({ type: "success", text: "AI konfigürasyonu kaydedildi." });
      await loadConfig();
      await loadStatus();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Konfigürasyon kaydedilemedi." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwitchProvider = async (provider: string) => {
    setIsLoading(true);
    setFeedback(null);
    try {
      await apiRequest(`/config/ai/switch/${provider}`, { method: "PUT" });
      setFeedback({ type: "success", text: `Aktif provider ${provider.toUpperCase()} olarak değiştirildi.` });
      await loadConfig();
      await loadStatus();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Provider değiştirilemedi." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteProvider = async (provider: string) => {
    if (!window.confirm(`${provider.toUpperCase()} konfigürasyonunu silmek istediğinizden emin misiniz?`)) return;
    setIsLoading(true);
    setFeedback(null);
    try {
      await apiRequest(`/config/ai/${provider}`, { method: "DELETE" });
      setFeedback({ type: "success", text: "Provider konfigürasyonu silindi." });
      await loadConfig();
      await loadStatus();
    } catch (err) {
      setFeedback({ type: "error", text: err instanceof Error ? err.message : "Provider silinemedi." });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    setFeedback(null);
    try {
      const result = await apiRequest<{ success: boolean; message: string }>("/config/ai/test", {
        method: "POST",
        body: JSON.stringify({
          provider: formData.provider,
          api_key: formData.api_key,
          model: formData.model,
        }),
      });
      setTestResult(result);
    } catch (err) {
      setTestResult({ success: false, message: err instanceof Error ? err.message : "Bağlantı test edilemedi." });
    } finally {
      setIsTesting(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const feedbackBg =
    feedback?.type === "success"
      ? { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.35)", color: COLORS.success.DEFAULT }
      : { bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.35)",  color: COLORS.error.DEFAULT };

  const providerOptions = PROVIDERS.map((p) => ({ value: p.provider, label: p.name }));
  const modelOptions = (PROVIDERS.find((p) => p.provider === formData.provider)?.models ?? [])
    .map((m) => ({ value: m, label: m }));

  return (
    <div className="electric-page">
      <TopBar
        title="AI Konfigürasyon"
        subtitle="AI servisleri ve API anahtarları yönetimi"
        breadcrumbs={["Ayarlar", "AI Konfigürasyon"]}
      >
        {currentProvider && (
          <Badge variant="success">
            <CheckCircle size={12} style={{ marginRight: 4 }} />
            Aktif: {currentProvider.toUpperCase()}
          </Badge>
        )}
      </TopBar>

      <div className="app-page-container" style={{ display: "grid", gap: 16, alignContent: "start" }}>
        {/* Geri bildirim */}
        {feedback && (
          <div
            role={feedback.type === "error" ? "alert" : "status"}
            style={{
              border: `1px solid ${feedbackBg.border}`,
              background: feedbackBg.bg,
              color: feedbackBg.color,
              borderRadius: RADIUS.md,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {feedback.text}
          </div>
        )}

        {/* Sekme çubuğu */}
        <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${COLORS.border}` }}>
          {TABS.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 14px", fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  background: "none", border: "none",
                  borderBottom: active ? `2px solid ${COLORS.primary.DEFAULT}` : "2px solid transparent",
                  color: active ? COLORS.primary.DEFAULT : COLORS.muted,
                  cursor: "pointer", marginBottom: -1,
                }}
              >
                {tab.icon}{tab.label}
              </button>
            );
          })}
        </div>

        {/* ── Provider'lar ── */}
        {activeTab === "providers" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {/* Mevcut provider'lar */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                <Bot size={16} /> Yapılandırılmış Provider'lar
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
                Mevcut AI servisleri konfigürasyonları
              </div>
              {config && Object.keys(config).length > 0 ? (
                <div style={{ display: "grid", gap: 12 }}>
                  {Object.entries(config).map(([provider, cfg]) => (
                    <div
                      key={provider}
                      style={{
                        border: `1px solid ${COLORS.border}`,
                        borderRadius: RADIUS.md,
                        padding: 12,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontWeight: 600 }}>{provider.toUpperCase()}</span>
                          {currentProvider === provider && (
                            <Badge variant="success">Aktif</Badge>
                          )}
                        </div>
                        <div style={{ display: "flex", gap: 6 }}>
                          {currentProvider !== provider && (
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<ArrowLeftRight size={12} />}
                              onClick={() => void handleSwitchProvider(provider)}
                              disabled={isLoading}
                            >
                              Aktif Et
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            size="sm"
                            icon={<Trash2 size={12} />}
                            onClick={() => void handleDeleteProvider(provider)}
                            disabled={isLoading}
                            aria-label="Sil"
                          >{""}</Button>
                        </div>
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.muted }}>
                        <div>Model: {cfg.model}</div>
                        {cfg.updated_at && <div>Son güncelleme: {new Date(cfg.updated_at).toLocaleString("tr-TR")}</div>}
                        {cfg.updated_by && <div>Güncelleyen: {cfg.updated_by}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: "center", padding: "32px 0", color: COLORS.muted, fontSize: 13 }}>
                  Henüz provider yapılandırılmamış
                </div>
              )}
            </div>

            {/* Provider ekle/düzenle */}
            <div style={cardStyle}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                <Plus size={16} /> Provider Ekle/Düzenle
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
                Yeni AI provider'ı yapılandır veya mevcudu güncelle
              </div>
              <div style={{ display: "grid", gap: 12 }}>
                <Select
                  label="Provider"
                  value={formData.provider}
                  onChange={(v) => setFormData({ ...formData, provider: String(v), model: PROVIDERS.find((p) => p.provider === v)?.models[0] ?? "" })}
                  options={providerOptions}
                />
                <Select
                  label="Model"
                  value={formData.model}
                  onChange={(v) => setFormData({ ...formData, model: String(v) })}
                  options={modelOptions}
                />
                <Input
                  type="password"
                  label="API Anahtarı"
                  value={formData.api_key}
                  onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                  placeholder="API anahtarını girin..."
                />
                {formData.provider === "custom" && (
                  <Input
                    label="Endpoint (Opsiyonel)"
                    value={formData.endpoint}
                    onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    placeholder="https://api.example.com/v1"
                  />
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <FieldLabel>Temperature ({formData.temperature.toFixed(1)})</FieldLabel>
                    <input
                      type="range"
                      min="0" max="2" step="0.1"
                      value={formData.temperature}
                      onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                      style={{ width: "100%" }}
                    />
                  </div>
                  <Input
                    type="number"
                    label="Max Tokens"
                    value={formData.max_tokens}
                    onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
                    min={1}
                    max={32768}
                  />
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  />
                  Kaydedilirken aktif et
                </label>
                <Button
                  icon={isLoading ? <Loader2 size={14} /> : <Key size={14} />}
                  onClick={() => void handleSaveConfig()}
                  disabled={isLoading}
                  loading={isLoading}
                  fullWidth
                >
                  Konfigürasyonu Kaydet
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ── Durum ── */}
        {activeTab === "status" && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>AI Servis Durumu</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
              AI servislerinin mevcut durumu ve yapılandırma bilgileri
            </div>
            {status ? (
              <div style={{ display: "grid", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontWeight: 600 }}>Aktif Provider:</span>
                  {status.current_provider ? (
                    <Badge variant="success">
                      <CheckCircle size={12} style={{ marginRight: 4 }} />
                      {status.current_provider.toUpperCase()}
                    </Badge>
                  ) : (
                    <Badge variant="warning">
                      <AlertCircle size={12} style={{ marginRight: 4 }} />
                      Aktif provider yok
                    </Badge>
                  )}
                </div>
                <div style={{ borderTop: `1px solid ${COLORS.border}`, paddingTop: 16 }}>
                  <div style={{ fontWeight: 600, marginBottom: 12 }}>Servisler:</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {Object.entries(status.services).map(([service, info]) => (
                      <div
                        key={service}
                        style={{
                          display: "flex", justifyContent: "space-between", alignItems: "center",
                          border: `1px solid ${COLORS.border}`,
                          borderRadius: RADIUS.md,
                          padding: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: "50%",
                            background: info.active ? COLORS.success.DEFAULT : COLORS.gray[400],
                          }} />
                          <div>
                            <div style={{ fontWeight: 500 }}>{service.toUpperCase()}</div>
                            <div style={{ fontSize: 12, color: COLORS.muted }}>Model: {info.model}</div>
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <Badge variant={info.active ? "success" : "secondary"}>
                            {info.active ? "Aktif" : "Pasif"}
                          </Badge>
                          {info.last_updated && (
                            <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
                              {new Date(info.last_updated).toLocaleString("tr-TR")}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: "center", padding: "32px 0", color: COLORS.muted }}>
                <Loader2 size={32} style={{ margin: "0 auto 12px", display: "block" }} />
                Durum yükleniyor...
              </div>
            )}
          </div>
        )}

        {/* ── Test ── */}
        {activeTab === "test" && (
          <div style={cardStyle}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>Bağlantı Testi</div>
            <div style={{ fontSize: 12, color: COLORS.muted, marginBottom: 16 }}>
              AI provider bağlantısını test et
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <Select
                label="Provider"
                value={formData.provider}
                onChange={(v) => setFormData({ ...formData, provider: String(v) })}
                options={providerOptions}
              />
              <Input
                type="password"
                label="API Anahtarı"
                value={formData.api_key}
                onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
                placeholder="Test etmek için API anahtarı..."
              />
            </div>
            <Button
              icon={isTesting ? <Loader2 size={14} /> : <TestTube size={14} />}
              onClick={() => void handleTestConnection()}
              disabled={isTesting || !formData.api_key.trim()}
              loading={isTesting}
              fullWidth
            >
              Bağlantıyı Test Et
            </Button>
            {testResult && (
              <div
                style={{
                  marginTop: 12,
                  border: `1px solid ${testResult.success ? "rgba(16,185,129,0.35)" : "rgba(239,68,68,0.35)"}`,
                  background: testResult.success ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)",
                  borderRadius: RADIUS.md,
                  padding: 12,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4, color: testResult.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT }}>
                  {testResult.success ? "✓ Test Başarılı" : "✗ Test Başarısız"}
                </div>
                <div style={{ fontSize: 13, color: COLORS.text }}>{testResult.message}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Mikro ERP SQL Server Yapılandırma Modal'ı
 * Admin panelinden Mikro SQL bağlantı ayarlarını yönetir
 */
import { useState, useCallback, useEffect } from "react";
import { X, Database, CheckCircle, AlertCircle, Loader2, ShieldCheck, Server } from "lucide-react";
import { Button, Card } from "../../components/Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
import { adminService, type MikroConfig } from "../../services/adminService";

interface MikroConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: Record<string, unknown>) => void;
  initialConfig?: Record<string, unknown>;
}

const defaultConfig: MikroConfig = {
  configured: false,
  host: "",
  port: 1433,
  instance: "",
  database: "",
  username: "",
  password: "",
  timeoutSeconds: 10,
  encrypt: true,
  trustServerCertificate: false,
};

type ValidationErrors = Partial<Record<keyof MikroConfig, string>>;

function validate(cfg: MikroConfig): ValidationErrors {
  const errors: ValidationErrors = {};
  if (!cfg.host.trim()) errors.host = "SQL Server adresi zorunludur";
  if (!cfg.database.trim()) errors.database = "Veritabanı adı zorunludur";
  if (!cfg.username.trim()) errors.username = "Kullanıcı adı zorunludur";
  if (!cfg.password || (!cfg.password.trim() && !cfg.configured))
    errors.password = "Şifre zorunludur";
  if (cfg.port < 1 || cfg.port > 65535) errors.port = "Port 1-65535 arasında olmalıdır";
  if (cfg.timeoutSeconds < 1 || cfg.timeoutSeconds > 120)
    errors.timeoutSeconds = "Zaman aşımı 1-120 saniye arasında olmalıdır";
  return errors;
}

// Ortak input stili
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: RADIUS.md,
  border: `1px solid ${COLORS.border}`,
  fontSize: 14,
  fontFamily: TYPOGRAPHY.fontFamily.base,
  background: "transparent",
  color: COLORS.text,
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: 13,
  fontWeight: 500,
  color: COLORS.text,
  marginBottom: 6,
};

const errorTextStyle: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.error.DEFAULT,
  marginTop: 4,
};

export function MikroConfigModal({ isOpen, onClose, onSave }: MikroConfigModalProps) {
  const [config, setConfig] = useState<MikroConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<"connection" | "security" | "advanced">("connection");

  // Mevcut yapılandırmayı yükle
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const existing = await adminService.getMikroConfig();
        if (cancelled) return;
        if (existing && existing.configured) {
          setConfig({
            ...defaultConfig,
            ...existing,
            // Maskeli şifre geliyorsa temizle - kullanıcı yeniden yazacak
            password: existing.password === "••••••••" ? "" : (existing.password || ""),
          });
        }
      } catch {
        // İlk kurulumda config yok, default kullan
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [isOpen]);

  // ESC ile kapat
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const handleChange = useCallback(<K extends keyof MikroConfig>(field: K, value: MikroConfig[K]) => {
    setConfig(prev => ({ ...prev, [field]: value }));
    setTouched(prev => new Set(prev).add(field));
    setTestResult(null);
  }, []);

  const errors = validate(config);
  const hasErrors = Object.keys(errors).length > 0;
  // Şifre boş ama önceden configured ise validasyonu gevşet
  const isPasswordOptional = config.configured && !config.password;
  const canSubmit = !hasErrors || (isPasswordOptional && Object.keys(errors).length === 1 && errors.password);

  const handleTest = useCallback(async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await adminService.testMikroConfig(config);
      setTestResult({
        success: result.success ?? true,
        message: result.message ?? "Bağlantı başarılı",
      });
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Bağlantı testi başarısız",
      });
    } finally {
      setTesting(false);
    }
  }, [config]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    setTestResult(null);
    try {
      const saved = await adminService.saveMikroConfig(config);
      setConfig(prev => ({ ...prev, configured: true }));
      setTestResult({ success: true, message: "Yapılandırma başarıyla kaydedildi" });
      onSave(saved as unknown as Record<string, unknown>);
      // Kısa gecikmeyle kapat
      setTimeout(() => onClose(), 1200);
    } catch (error) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : "Kaydetme başarısız",
      });
    } finally {
      setSaving(false);
    }
  }, [config, onSave, onClose]);

  if (!isOpen) return null;

  const tabs: Array<{ id: typeof activeTab; label: string; icon: React.ReactNode }> = [
    { id: "connection", label: "Bağlantı", icon: <Server size={14} aria-hidden /> },
    { id: "security", label: "Güvenlik", icon: <ShieldCheck size={14} aria-hidden /> },
    { id: "advanced", label: "Gelişmiş", icon: <Database size={14} aria-hidden /> },
  ];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Mikro ERP Yapılandırması"
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
          maxWidth: 620,
          maxHeight: "90vh",
          overflow: "auto",
        }}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {/* Header */}
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              width: 40, height: 40, borderRadius: RADIUS.md,
              background: `${COLORS.primary[500]}15`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <Database size={20} color={COLORS.primary[500]} aria-hidden />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: COLORS.text }}>
                Mikro ERP Yapılandırması
              </h2>
              <p style={{ margin: "4px 0 0", fontSize: 13, color: COLORS.muted }}>
                SQL Server bağlantı ayarları ve güvenlik seçenekleri
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Kapat"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 8,
              borderRadius: RADIUS.md,
              color: COLORS.muted,
              minWidth: 44,
              minHeight: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Durum Badge */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          marginBottom: 20, padding: "10px 14px",
          borderRadius: RADIUS.md,
          background: config.configured ? `${COLORS.success.DEFAULT}10` : `${COLORS.warning.DEFAULT}10`,
          border: `1px solid ${config.configured ? COLORS.success.DEFAULT : COLORS.warning.DEFAULT}25`,
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: "50%",
            background: loading ? COLORS.muted : (config.configured ? COLORS.success.DEFAULT : COLORS.warning.DEFAULT),
          }} />
          <span style={{ fontSize: 13, fontWeight: 500, color: COLORS.text }}>
            {loading
              ? "Yapılandırma yükleniyor..."
              : config.configured
                ? "Mikro ERP bağlantısı yapılandırılmış"
                : "Mikro ERP bağlantısı henüz yapılandırılmamış"}
          </span>
        </div>

        {loading ? (
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: 40, gap: 8, color: COLORS.muted }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite" }} aria-hidden />
            <span style={{ fontSize: 14 }}>Yapılandırma yükleniyor...</span>
          </div>
        ) : (
          <>
            {/* Tab Bar */}
            <div style={{
              display: "flex", gap: 4, marginBottom: 20,
              padding: 4, background: `${COLORS.muted}10`, borderRadius: RADIUS.md,
            }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: "8px 12px",
                    borderRadius: RADIUS.sm,
                    border: "none",
                    background: activeTab === tab.id ? COLORS.surface : "transparent",
                    color: activeTab === tab.id ? COLORS.text : COLORS.muted,
                    cursor: "pointer",
                    fontSize: 13, fontWeight: 500,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                    boxShadow: activeTab === tab.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                    transition: "all 0.15s",
                    minHeight: 44,
                  }}
                >
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div style={{ display: "grid", gap: 16 }}>

              {/* TAB: Bağlantı */}
              {activeTab === "connection" && (
                <>
                  {/* Host */}
                  <div>
                    <label htmlFor="mikro-host" style={labelStyle}>
                      SQL Server Adresi (IP / Hostname) <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                    </label>
                    <input
                      id="mikro-host"
                      value={config.host}
                      onChange={(e) => handleChange("host", e.target.value)}
                      placeholder="192.168.1.100 veya mikro-server.local"
                      style={{
                        ...inputStyle,
                        borderColor: touched.has("host") && errors.host ? COLORS.error.DEFAULT : COLORS.border,
                      }}
                    />
                    {touched.has("host") && errors.host && <div style={errorTextStyle}>{errors.host}</div>}
                  </div>

                  {/* Port + Instance (yan yana) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label htmlFor="mikro-port" style={labelStyle}>Port</label>
                      <input
                        id="mikro-port"
                        type="number"
                        value={config.port}
                        onChange={(e) => handleChange("port", Number(e.target.value))}
                        style={{
                          ...inputStyle,
                          borderColor: touched.has("port") && errors.port ? COLORS.error.DEFAULT : COLORS.border,
                        }}
                      />
                      {touched.has("port") && errors.port && <div style={errorTextStyle}>{errors.port}</div>}
                    </div>
                    <div>
                      <label htmlFor="mikro-instance" style={labelStyle}>
                        Sunucu Adı (Instance)
                      </label>
                      <input
                        id="mikro-instance"
                        value={config.instance}
                        onChange={(e) => handleChange("instance", e.target.value)}
                        placeholder="SQLEXPRESS"
                        style={inputStyle}
                      />
                      <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
                        Varsayılan instance ise boş bırakın
                      </div>
                    </div>
                  </div>

                  {/* Database */}
                  <div>
                    <label htmlFor="mikro-database" style={labelStyle}>
                      Veritabanı Adı <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                    </label>
                    <input
                      id="mikro-database"
                      value={config.database}
                      onChange={(e) => handleChange("database", e.target.value)}
                      placeholder="MikroDB_V16"
                      style={{
                        ...inputStyle,
                        borderColor: touched.has("database") && errors.database ? COLORS.error.DEFAULT : COLORS.border,
                      }}
                    />
                    {touched.has("database") && errors.database && <div style={errorTextStyle}>{errors.database}</div>}
                  </div>

                  {/* Username + Password (yan yana) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label htmlFor="mikro-username" style={labelStyle}>
                        Kullanıcı Adı <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                      </label>
                      <input
                        id="mikro-username"
                        value={config.username}
                        onChange={(e) => handleChange("username", e.target.value)}
                        placeholder="sa"
                        autoComplete="username"
                        style={{
                          ...inputStyle,
                          borderColor: touched.has("username") && errors.username ? COLORS.error.DEFAULT : COLORS.border,
                        }}
                      />
                      {touched.has("username") && errors.username && <div style={errorTextStyle}>{errors.username}</div>}
                    </div>
                    <div>
                      <label htmlFor="mikro-password" style={labelStyle}>
                        Şifre <span style={{ color: COLORS.error.DEFAULT }}>*</span>
                      </label>
                      <input
                        id="mikro-password"
                        type="password"
                        value={config.password}
                        onChange={(e) => handleChange("password", e.target.value)}
                        placeholder={config.configured ? "Değiştirmek için yeni şifre girin" : "••••••••"}
                        autoComplete="current-password"
                        style={{
                          ...inputStyle,
                          borderColor: touched.has("password") && errors.password && !isPasswordOptional
                            ? COLORS.error.DEFAULT : COLORS.border,
                        }}
                      />
                      {config.configured && (
                        <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
                          Boş bırakırsanız mevcut şifre korunur
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* TAB: Güvenlik */}
              {activeTab === "security" && (
                <>
                  {/* Encrypt toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: RADIUS.md,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>
                        Bağlantı Şifreleme (TLS/SSL)
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                        SQL Server bağlantısını şifreler. Production ortamında aktif olması tavsiye edilir.
                      </div>
                    </div>
                    <button
                      onClick={() => handleChange("encrypt", !config.encrypt)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: RADIUS.md,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 500,
                        background: config.encrypt ? COLORS.success.DEFAULT : COLORS.gray[400],
                        color: "white",
                        minWidth: 60,
                        minHeight: 44,
                      }}
                    >
                      {config.encrypt ? "Aktif" : "Pasif"}
                    </button>
                  </div>

                  {/* Trust Server Certificate toggle */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "14px 16px",
                      borderRadius: RADIUS.md,
                      border: `1px solid ${COLORS.border}`,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 500, color: COLORS.text }}>
                        Sunucu Sertifikasına Güven
                      </div>
                      <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                        Self-signed sertifika kullanan sunucularda aktif edin.
                        Production ortamında pasif tutulması tavsiye edilir.
                      </div>
                    </div>
                    <button
                      onClick={() => handleChange("trustServerCertificate", !config.trustServerCertificate)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: RADIUS.md,
                        border: "none",
                        cursor: "pointer",
                        fontSize: 13,
                        fontWeight: 500,
                        background: config.trustServerCertificate ? COLORS.warning.DEFAULT : COLORS.gray[400],
                        color: "white",
                        minWidth: 60,
                        minHeight: 44,
                      }}
                    >
                      {config.trustServerCertificate ? "Aktif" : "Pasif"}
                    </button>
                  </div>

                  {/* Bilgi kutusu */}
                  <div style={{
                    padding: "12px 14px",
                    borderRadius: RADIUS.md,
                    background: `${COLORS.info.DEFAULT}08`,
                    border: `1px solid ${COLORS.info.DEFAULT}20`,
                    fontSize: 12,
                    color: COLORS.muted,
                    lineHeight: 1.6,
                  }}>
                    <strong style={{ color: COLORS.text }}>Güvenlik Notu:</strong> Bağlantı şifreleme aktifken ve
                    sunucu sertifikası güvenilir olarak işaretlenmemişken, sunucunun geçerli bir SSL sertifikasına
                    sahip olması gerekir. Local ağda self-signed sertifika kullanılıyorsa &quot;Sunucu Sertifikasına Güven&quot;
                    seçeneğini aktif edin.
                  </div>
                </>
              )}

              {/* TAB: Gelişmiş */}
              {activeTab === "advanced" && (
                <>
                  {/* Connection Timeout */}
                  <div>
                    <label htmlFor="mikro-timeout" style={labelStyle}>
                      Bağlantı Zaman Aşımı (saniye)
                    </label>
                    <input
                      id="mikro-timeout"
                      type="number"
                      min={1}
                      max={120}
                      value={config.timeoutSeconds}
                      onChange={(e) => handleChange("timeoutSeconds", Number(e.target.value))}
                      style={{
                        ...inputStyle,
                        maxWidth: 160,
                        borderColor: touched.has("timeoutSeconds") && errors.timeoutSeconds ? COLORS.error.DEFAULT : COLORS.border,
                      }}
                    />
                    {touched.has("timeoutSeconds") && errors.timeoutSeconds && (
                      <div style={errorTextStyle}>{errors.timeoutSeconds}</div>
                    )}
                    <div style={{ fontSize: 11, color: COLORS.muted, marginTop: 4 }}>
                      Yavaş ağlarda değeri artırın. Önerilen: 10-30 saniye.
                    </div>
                  </div>

                  {/* Connection Info */}
                  <div style={{
                    padding: "14px 16px",
                    borderRadius: RADIUS.md,
                    background: `${COLORS.muted}08`,
                    border: `1px solid ${COLORS.border}`,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: COLORS.text, marginBottom: 8 }}>
                      Bağlantı Bilgileri
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 16px", fontSize: 12 }}>
                      <span style={{ color: COLORS.muted }}>ODBC Driver:</span>
                      <span style={{ color: COLORS.text }}>ODBC Driver 17 for SQL Server</span>
                      <span style={{ color: COLORS.muted }}>Bağlantı Modu:</span>
                      <span style={{ color: COLORS.text }}>Read-Only (ApplicationIntent=ReadOnly)</span>
                      <span style={{ color: COLORS.muted }}>Oluşturulan Server:</span>
                      <span style={{ color: COLORS.text, fontFamily: "monospace" }}>
                        {config.instance
                          ? `${config.host || "..."}\\${config.instance}`
                          : config.port !== 1433
                            ? `${config.host || "..."},${config.port}`
                            : config.host || "..."}
                      </span>
                    </div>
                  </div>

                  {/* Kullanım notları */}
                  <div style={{
                    padding: "12px 14px",
                    borderRadius: RADIUS.md,
                    background: `${COLORS.info.DEFAULT}08`,
                    border: `1px solid ${COLORS.info.DEFAULT}20`,
                    fontSize: 12,
                    color: COLORS.muted,
                    lineHeight: 1.6,
                  }}>
                    <strong style={{ color: COLORS.text }}>Read-Only Bağlantı:</strong> OptiPlan360 Mikro veritabanına
                    yalnızca okuma amaçlı bağlanır. Stok sorgusu ve malzeme önerisi için TBLSTSABIT/STOKLAR tablolarına
                    erişim gerekir. SQL Server kullanıcısına sadece SELECT yetkisi verilmesi tavsiye edilir.
                  </div>
                </>
              )}

              {/* Test Sonucu */}
              {testResult && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: RADIUS.md,
                    background: testResult.success ? `${COLORS.success.DEFAULT}10` : `${COLORS.error.DEFAULT}10`,
                    border: `1px solid ${testResult.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT}25`,
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                  }}
                >
                  {testResult.success
                    ? <CheckCircle size={18} color={COLORS.success.DEFAULT} aria-hidden />
                    : <AlertCircle size={18} color={COLORS.error.DEFAULT} aria-hidden />}
                  <div>
                    <div style={{
                      fontSize: 13, fontWeight: 600,
                      color: testResult.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
                    }}>
                      {testResult.success ? "Bağlantı Başarılı" : "Bağlantı Başarısız"}
                    </div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>
                      {testResult.message}
                    </div>
                  </div>
                </div>
              )}

              {/* Butonlar */}
              <div style={{
                display: "flex", gap: 12, marginTop: 8,
                paddingTop: 16, borderTop: `1px solid ${COLORS.border}`,
              }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleTest}
                  disabled={testing || !canSubmit}
                  title="Bağlantı Testi"
                >
                  {testing ? (
                    <>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden />
                      {" "}Test Ediliyor...
                    </>
                  ) : "Bağlantı Testi"}
                </Button>
                <div style={{ flex: 1 }} />
                <Button variant="ghost" size="sm" onClick={onClose} title="İptal">
                  İptal
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleSave}
                  disabled={saving || !canSubmit}
                  title="Kaydet"
                >
                  {saving ? (
                    <>
                      <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} aria-hidden />
                      {" "}Kaydediliyor...
                    </>
                  ) : "Yapılandırmayı Kaydet"}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Spin animation */}
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

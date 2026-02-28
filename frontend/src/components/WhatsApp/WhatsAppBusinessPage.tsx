/**
 * WhatsApp Business Yapılandırma & Yönetim Ekranı
 * Config, özet istatistikler, şablon yönetimi, mesaj gönderim ve geçmiş — tek sayfada.
 */
import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  MessageCircle,
  Settings,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Eye,
  EyeOff,
  Phone,
  FileText,
  BarChart3,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { adminService } from "../../services/adminService";
import type { WhatsAppConfig } from "../../services/adminService";
import { Button, Card, KPICard, COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from "../Shared";
import { TopBar } from "../Layout/TopBar";

// ── Tipler ───────────────────────────────────────────────────

interface WhatsAppTemplate {
  name: string;
  label: string;
  body: string;
  variables: string[];
}

interface WhatsAppMessage {
  id: string;
  toPhone: string;
  message: string;
  status: string;
  wabaMessageId?: string;
  orderId?: string;
  orderTsCode?: string;
  sentBy: string;
  sentAt: string;
  error?: string;
}

interface WhatsAppSummary {
  configured: boolean;
  totalSent: number;
  todaySent: number;
  failed: number;
}

type TabId = "overview" | "config" | "send" | "history";

// ── Sabitler ─────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  SENT: { bg: COLORS.success.light, color: COLORS.success.DEFAULT, label: "Gönderildi" },
  FAILED: { bg: COLORS.danger.light, color: COLORS.danger.DEFAULT, label: "Başarısız" },
  PENDING: { bg: COLORS.warning.light, color: COLORS.warning.DEFAULT, label: "Bekliyor" },
};

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Genel Bakış", icon: <BarChart3 size={16} aria-hidden="true" /> },
  { id: "config", label: "Yapılandırma", icon: <Settings size={16} aria-hidden="true" /> },
  { id: "send", label: "Mesaj Gönder", icon: <Send size={16} aria-hidden="true" /> },
  { id: "history", label: "Mesaj Geçmişi", icon: <FileText size={16} aria-hidden="true" /> },
];

// ── Ana Bileşen ──────────────────────────────────────────────

export function WhatsAppBusinessPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [loading, setLoading] = useState(true);

  // Veriler
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [summary, setSummary] = useState<WhatsAppSummary | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);

  // Mesaj
  const [toast, setToast] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Timer ref
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((type: "success" | "error", text: string) => {
    setToast({ type, text });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);

  // ── Data Fetch ──────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgData, sumData, tplData, msgData] = await Promise.allSettled([
        adminService.getWhatsAppConfig(),
        adminService.getWhatsAppSummary(),
        adminService.listWhatsAppTemplates(),
        adminService.listWhatsAppMessages(),
      ]);

      if (cfgData.status === "fulfilled") setConfig(cfgData.value);
      if (sumData.status === "fulfilled") {
        const s = sumData.value;
        setSummary({
          configured: s.configured,
          totalSent: s.totalSent,
          todaySent: s.todaySent,
          failed: s.failed,
        });
      }
      if (tplData.status === "fulfilled") setTemplates(tplData.value as unknown as WhatsAppTemplate[]);
      if (msgData.status === "fulfilled") {
        setMessages(
          (msgData.value as unknown as Array<Record<string, unknown>>).map((m) => ({
            id: String(m.id ?? ""),
            toPhone: String(m.toPhone ?? ""),
            message: String(m.message ?? ""),
            status: String(m.status ?? ""),
            wabaMessageId: m.wabaMessageId ? String(m.wabaMessageId) : undefined,
            orderId: m.orderId ? String(m.orderId) : undefined,
            orderTsCode: m.orderTsCode ? String(m.orderTsCode) : undefined,
            sentBy: String(m.sentBy ?? ""),
            sentAt: String(m.sentAt ?? ""),
            error: m.error ? String(m.error) : undefined,
          }))
        );
      }
    } catch {
      showToast("error", "Veriler yüklenirken hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  return (
    <div className="electric-page" style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <TopBar
        title="WhatsApp Business"
        subtitle="Meta WABA Entegrasyonu"
        breadcrumbs={["Ayarlar", "Entegrasyonlar", "WhatsApp Business"]}
      >
        <Button
          variant="ghost"
          onClick={() => void loadAll()}
          icon={<RefreshCw size={14} aria-hidden="true" />}
          title="Yenile"
        >
          Yenile
        </Button>
      </TopBar>

      {/* Toast */}
      {toast && (
        <div
          role="alert"
          style={{
            position: "fixed",
            top: 16,
            right: 16,
            zIndex: 9999,
            padding: "12px 20px",
            borderRadius: RADIUS.md,
            background: toast.type === "success" ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT,
            color: "#fff",
            fontSize: 13,
            fontWeight: TYPOGRAPHY.fontWeight.semibold,
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            display: "flex",
            alignItems: "center",
            gap: 8,
            animation: "slideInRight 0.3s ease",
          }}
        >
          {toast.type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
          {toast.text}
        </div>
      )}

      {/* Sekme Başlıkları */}
      <div className="app-page-container" style={{ paddingTop: 0, paddingBottom: 0 }}>
        <div
          role="tablist"
          aria-label="WhatsApp Business sekmeleri"
          style={{
            display: "flex",
            gap: 4,
            borderBottom: `1px solid ${COLORS.border}`,
            overflowX: "auto",
          }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 16px",
                background: "transparent",
                border: "none",
                borderBottom: `2px solid ${activeTab === tab.id ? COLORS.primary.DEFAULT : "transparent"}`,
                color: activeTab === tab.id ? COLORS.primary.DEFAULT : COLORS.muted,
                fontWeight: activeTab === tab.id ? TYPOGRAPHY.fontWeight.semibold : TYPOGRAPHY.fontWeight.normal,
                fontSize: 13,
                cursor: "pointer",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap",
                fontFamily: TYPOGRAPHY.fontFamily.base,
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sekme İçerikleri */}
      <div className="app-page-container" style={{ flex: 1, overflowY: "auto", paddingTop: 16 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200, color: COLORS.muted, gap: 8 }}>
            <div className="loading-spinner" />
            Yükleniyor...
          </div>
        ) : (
          <>
            {activeTab === "overview" && (
              <OverviewTab summary={summary} config={config} messages={messages} />
            )}
            {activeTab === "config" && (
              <ConfigTab config={config} onSave={async (cfg) => {
                try {
                  const updated = await adminService.updateWhatsAppConfig({
                    phone_number_id: cfg.phoneNumberId,
                    business_account_id: cfg.businessAccountId,
                    access_token: cfg.accessToken,
                    api_version: cfg.apiVersion,
                  });
                  setConfig(updated);
                  showToast("success", "Yapılandırma kaydedildi");
                } catch {
                  showToast("error", "Yapılandırma kaydedilemedi");
                }
              }} />
            )}
            {activeTab === "send" && (
              <SendTab
                templates={templates}
                configured={config?.configured ?? false}
                onSent={async () => {
                  showToast("success", "Mesaj gönderildi");
                  await loadAll();
                }}
                onError={(msg) => showToast("error", msg)}
              />
            )}
            {activeTab === "history" && (
              <HistoryTab messages={messages} onRefresh={loadAll} />
            )}
          </>
        )}
      </div>

      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(30px); }
          to { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// GENEL BAKIŞ SEKMESİ
// ═══════════════════════════════════════════════════

function OverviewTab({
  summary,
  config,
  messages,
}: {
  summary: WhatsAppSummary | null;
  config: WhatsAppConfig | null;
  messages: WhatsAppMessage[];
}) {
  const isConfigured = config?.configured ?? false;

  return (
    <div style={{ display: "grid", gap: 20 }}>
      {/* Bağlantı Durumu */}
      <Card
        title="Bağlantı Durumu"
        icon={<Zap size={14} aria-hidden="true" />}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: isConfigured ? COLORS.success.DEFAULT : COLORS.danger.DEFAULT,
              boxShadow: isConfigured
                ? `0 0 8px ${COLORS.success.DEFAULT}`
                : `0 0 8px ${COLORS.danger.DEFAULT}`,
            }}
          />
          <span style={{ fontSize: 14, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.text }}>
            {isConfigured ? "Aktif — Meta WABA bağlantısı hazır" : "Yapılandırılmamış — Bağlantı ayarları eksik"}
          </span>
        </div>
        {!isConfigured && (
          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              borderRadius: RADIUS.md,
              background: COLORS.warning.light,
              color: COLORS.warning.DEFAULT,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={14} />
            WhatsApp API bağlantısı için Yapılandırma sekmesinden Phone Number ID ve Access Token giriniz.
          </div>
        )}
      </Card>

      {/* KPI'lar */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
        <KPICard
          icon={<Send size={16} aria-hidden="true" />}
          label="Toplam Gönderilen"
          value={summary?.totalSent ?? 0}
          color={COLORS.primary.DEFAULT}
        />
        <KPICard
          icon={<Clock size={16} aria-hidden="true" />}
          label="Bugün Gönderilen"
          value={summary?.todaySent ?? 0}
          color={COLORS.success.DEFAULT}
        />
        <KPICard
          icon={<XCircle size={16} aria-hidden="true" />}
          label="Başarısız"
          value={summary?.failed ?? 0}
          color={COLORS.danger.DEFAULT}
        />
        <KPICard
          icon={<CheckCircle size={16} aria-hidden="true" />}
          label="Başarı Oranı"
          value={
            summary && summary.totalSent > 0
              ? `%${Math.round(((summary.totalSent - summary.failed) / summary.totalSent) * 100)}`
              : "%0"
          }
          color={COLORS.accent.DEFAULT}
        />
      </div>

      {/* Son Mesajlar */}
      <Card title="Son Mesajlar" icon={<MessageCircle size={14} aria-hidden="true" />}>
        {messages.length === 0 ? (
          <p style={{ color: COLORS.muted, fontSize: 13, margin: 0 }}>Henüz mesaj gönderilmemiş.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Telefon", "Durum", "Gönderen", "Tarih", "Mesaj"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        color: COLORS.muted,
                        fontWeight: TYPOGRAPHY.fontWeight.semibold,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {messages.slice(0, 5).map((m) => {
                  const sc = STATUS_COLORS[m.status] ?? STATUS_COLORS.PENDING;
                  return (
                    <tr key={m.id}>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: 12 }}>
                        {m.toPhone}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: RADIUS.full,
                            background: sc.bg,
                            color: sc.color,
                            fontSize: 11,
                            fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          }}
                        >
                          {m.status === "SENT" && <CheckCircle size={10} />}
                          {m.status === "FAILED" && <XCircle size={10} />}
                          {m.status === "PENDING" && <Clock size={10} />}
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted }}>
                        {m.sentBy || "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 12 }}>
                        {m.sentAt ? new Date(m.sentAt).toLocaleString("tr-TR") : "—"}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          maxWidth: 250,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m.message}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// YAPILANDIRMA SEKMESİ
// ═══════════════════════════════════════════════════

function ConfigTab({
  config,
  onSave,
}: {
  config: WhatsAppConfig | null;
  onSave: (cfg: { phoneNumberId: string; businessAccountId: string; accessToken: string; apiVersion: string }) => Promise<void>;
}) {
  const [form, setForm] = useState({
    phoneNumberId: config?.phoneNumberId ?? "",
    businessAccountId: config?.businessAccountId ?? "",
    accessToken: "",
    apiVersion: config?.apiVersion ?? "v18.0",
  });
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: RADIUS.md,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bg.surface,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.base,
    outline: "none",
    transition: "border-color 0.15s ease",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.muted,
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div style={{ display: "grid", gap: 20, maxWidth: 700 }}>
      <Card
        title="Meta WABA API Bağlantısı"
        subtitle="WhatsApp Business API yapılandırması"
        icon={<Settings size={14} aria-hidden="true" />}
      >
        <div style={{ display: "grid", gap: 16 }}>
          {/* Phone Number ID */}
          <div>
            <label htmlFor="wa-phone-id" style={labelStyle}>Phone Number ID</label>
            <input
              id="wa-phone-id"
              type="text"
              value={form.phoneNumberId}
              onChange={(e) => setForm((p) => ({ ...p, phoneNumberId: e.target.value }))}
              placeholder="123456789012345"
              style={inputStyle}
              autoComplete="off"
            />
            <p style={{ margin: "4px 0 0", fontSize: 11, color: COLORS.muted }}>
              Meta Business Manager &gt; WhatsApp &gt; Phone Numbers bölümünden alınır.
            </p>
          </div>

          {/* Business Account ID */}
          <div>
            <label htmlFor="wa-biz-id" style={labelStyle}>Business Account ID</label>
            <input
              id="wa-biz-id"
              type="text"
              value={form.businessAccountId}
              onChange={(e) => setForm((p) => ({ ...p, businessAccountId: e.target.value }))}
              placeholder="987654321098765"
              style={inputStyle}
              autoComplete="off"
            />
          </div>

          {/* Access Token */}
          <div>
            <label htmlFor="wa-token" style={labelStyle}>Access Token</label>
            <div style={{ position: "relative" }}>
              <input
                id="wa-token"
                type={showToken ? "text" : "password"}
                value={form.accessToken}
                onChange={(e) => setForm((p) => ({ ...p, accessToken: e.target.value }))}
                placeholder="EAAX..."
                style={{ ...inputStyle, paddingRight: 48 }}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                aria-label={showToken ? "Token'ı gizle" : "Token'ı göster"}
                style={{
                  position: "absolute",
                  right: 4,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: COLORS.muted,
                  padding: 8,
                  minWidth: 44,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 11, color: COLORS.muted }}>
              Kalıcı token için System User oluşturun. Geçici token 24 saatte sona erer.
            </p>
          </div>

          {/* API Version */}
          <div>
            <label htmlFor="wa-api-ver" style={labelStyle}>API Version</label>
            <input
              id="wa-api-ver"
              type="text"
              value={form.apiVersion}
              onChange={(e) => setForm((p) => ({ ...p, apiVersion: e.target.value }))}
              placeholder="v18.0"
              style={{ ...inputStyle, maxWidth: 200 }}
            />
          </div>

          {/* Kaydet */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Yapılandırmayı Kaydet"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Durum Bilgisi */}
      <Card title="Bağlantı Testi" icon={<Zap size={14} aria-hidden="true" />}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: config?.configured ? COLORS.success.DEFAULT : COLORS.warning.DEFAULT,
            }}
          />
          <span style={{ fontSize: 13, color: COLORS.text }}>
            {config?.configured
              ? "API yapılandırması tamamlandı. Mesaj gönderimine hazır."
              : "Henüz yapılandırılmamış. Yukarıdaki alanları doldurup kaydedin."}
          </span>
        </div>
        {config?.configured && (
          <div
            style={{
              marginTop: 12,
              padding: 12,
              borderRadius: RADIUS.md,
              background: COLORS.success.light,
              fontSize: 12,
              color: COLORS.success.DEFAULT,
              display: "grid",
              gap: 4,
            }}
          >
            <div>Phone Number ID: <strong>{config.phoneNumberId}</strong></div>
            <div>Business Account: <strong>{config.businessAccountId || "—"}</strong></div>
            <div>API Version: <strong>{config.apiVersion}</strong></div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MESAJ GÖNDER SEKMESİ
// ═══════════════════════════════════════════════════

function SendTab({
  templates,
  configured,
  onSent,
  onError,
}: {
  templates: WhatsAppTemplate[];
  configured: boolean;
  onSent: () => Promise<void>;
  onError: (msg: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [orderId, setOrderId] = useState("");
  const [sending, setSending] = useState(false);
  const [preview, setPreview] = useState("");

  // Şablon seçiminde preview güncelle
  useEffect(() => {
    if (selectedTemplate && selectedTemplate !== "custom") {
      const tpl = templates.find((t) => t.name === selectedTemplate);
      setPreview(tpl?.body ?? "");
    } else if (selectedTemplate === "custom") {
      setPreview(customMessage);
    } else {
      setPreview("");
    }
  }, [selectedTemplate, customMessage, templates]);

  const handleSend = async () => {
    if (!phone.trim()) {
      onError("Telefon numarası gerekli");
      return;
    }
    if (!selectedTemplate && !customMessage.trim()) {
      onError("Şablon veya mesaj metni gerekli");
      return;
    }

    setSending(true);
    try {
      await adminService.sendWhatsAppMessage({
        to_phone: phone.trim(),
        template_name: selectedTemplate !== "custom" ? selectedTemplate : undefined,
        message_text: selectedTemplate === "custom" ? customMessage : undefined,
        order_id: orderId || undefined,
      });
      await onSent();
      setPhone("");
      setCustomMessage("");
      setOrderId("");
      setSelectedTemplate("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "Mesaj gönderilemedi");
    } finally {
      setSending(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "10px 12px",
    borderRadius: RADIUS.md,
    border: `1px solid ${COLORS.border}`,
    background: COLORS.bg.surface,
    color: COLORS.text,
    fontSize: 14,
    fontFamily: TYPOGRAPHY.fontFamily.base,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 12,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.muted,
    marginBottom: 6,
  };

  return (
    <div style={{ display: "grid", gap: 20, gridTemplateColumns: "1fr 1fr" }}>
      {/* Sol: Form */}
      <Card title="Mesaj Oluştur" icon={<Send size={14} aria-hidden="true" />}>
        {!configured && (
          <div
            style={{
              marginBottom: 16,
              padding: "10px 14px",
              borderRadius: RADIUS.md,
              background: COLORS.warning.light,
              color: COLORS.warning.DEFAULT,
              fontSize: 12,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <AlertTriangle size={14} />
            API yapılandırılmamış — mesajlar simüle edilecek.
          </div>
        )}

        <div style={{ display: "grid", gap: 14 }}>
          {/* Telefon */}
          <div>
            <label htmlFor="send-phone" style={labelStyle}>
              <Phone size={12} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
              Telefon Numarası
            </label>
            <input
              id="send-phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="05xx xxx xx xx"
              style={inputStyle}
            />
          </div>

          {/* Sipariş ID (opsiyonel) */}
          <div>
            <label htmlFor="send-order" style={labelStyle}>Sipariş ID (opsiyonel)</label>
            <input
              id="send-order"
              type="text"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              placeholder="order-uuid veya boş bırakın"
              style={inputStyle}
            />
          </div>

          {/* Şablon Seçimi */}
          <div>
            <label htmlFor="send-template" style={labelStyle}>Mesaj Şablonu</label>
            <select
              id="send-template"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              style={{
                ...inputStyle,
                cursor: "pointer",
                appearance: "auto",
              }}
            >
              <option value="">Şablon seçin...</option>
              {templates.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* Özel Mesaj */}
          {selectedTemplate === "custom" && (
            <div>
              <label htmlFor="send-custom" style={labelStyle}>Mesaj Metni</label>
              <textarea
                id="send-custom"
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Mesajınızı yazın..."
                rows={4}
                style={{
                  ...inputStyle,
                  resize: "vertical",
                  minHeight: 80,
                }}
              />
            </div>
          )}

          {/* Gönder */}
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
            <Button
              variant="primary"
              onClick={handleSend}
              disabled={sending || !phone.trim()}
              icon={<Send size={14} aria-hidden="true" />}
            >
              {sending ? "Gönderiliyor..." : "Gönder"}
            </Button>
          </div>
        </div>
      </Card>

      {/* Sağ: Şablon Önizleme + Listesi */}
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
        {/* Önizleme */}
        {preview && (
          <Card title="Mesaj Önizleme" icon={<Eye size={14} aria-hidden="true" />}>
            <div
              style={{
                padding: 16,
                borderRadius: RADIUS.lg,
                background: "#DCF8C6",
                color: "#111",
                fontSize: 13,
                lineHeight: 1.6,
                maxWidth: 320,
                position: "relative",
              }}
            >
              {preview}
              <div style={{ fontSize: 10, color: "#888", textAlign: "right", marginTop: 4 }}>
                {new Date().toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </Card>
        )}

        {/* Şablon Listesi */}
        <Card title="Kullanılabilir Şablonlar" icon={<FileText size={14} aria-hidden="true" />}>
          {templates.length === 0 ? (
            <p style={{ color: COLORS.muted, fontSize: 13, margin: 0 }}>Şablon bulunamadı.</p>
          ) : (
            <div style={{ display: "grid", gap: 8 }}>
              {templates.map((t) => (
                <div
                  key={t.name}
                  onClick={() => setSelectedTemplate(t.name)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setSelectedTemplate(t.name)}
                  style={{
                    padding: "10px 14px",
                    borderRadius: RADIUS.md,
                    border: `1px solid ${selectedTemplate === t.name ? COLORS.primary.DEFAULT : COLORS.border}`,
                    background: selectedTemplate === t.name ? primaryRgba(0.08) : COLORS.bg.elevated,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold, fontSize: 13, color: COLORS.text }}>
                      {t.label}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        padding: "2px 6px",
                        borderRadius: RADIUS.full,
                        background: `${COLORS.primary.DEFAULT}18`,
                        color: COLORS.primary.DEFAULT,
                        fontWeight: TYPOGRAPHY.fontWeight.semibold,
                      }}
                    >
                      {t.variables.length} değişken
                    </span>
                  </div>
                  <p style={{ margin: "4px 0 0", fontSize: 11, color: COLORS.muted, lineHeight: 1.4 }}>
                    {t.body.length > 80 ? t.body.slice(0, 80) + "..." : t.body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// MESAJ GEÇMİŞİ SEKMESİ
// ═══════════════════════════════════════════════════

function HistoryTab({
  messages,
  onRefresh,
}: {
  messages: WhatsAppMessage[];
  onRefresh: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<"ALL" | "SENT" | "FAILED" | "PENDING">("ALL");
  const [search, setSearch] = useState("");

  const filtered = messages.filter((m) => {
    if (filter !== "ALL" && m.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        m.toPhone.includes(q) ||
        m.message.toLowerCase().includes(q) ||
        (m.sentBy && m.sentBy.toLowerCase().includes(q)) ||
        (m.orderTsCode && m.orderTsCode.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const filterButtons: { id: "ALL" | "SENT" | "FAILED" | "PENDING"; label: string; color: string }[] = [
    { id: "ALL", label: "Tümü", color: COLORS.text },
    { id: "SENT", label: "Gönderildi", color: COLORS.success.DEFAULT },
    { id: "FAILED", label: "Başarısız", color: COLORS.danger.DEFAULT },
    { id: "PENDING", label: "Bekliyor", color: COLORS.warning.DEFAULT },
  ];

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Filtreler */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {filterButtons.map((fb) => (
            <button
              key={fb.id}
              onClick={() => setFilter(fb.id)}
              style={{
                padding: "6px 14px",
                borderRadius: RADIUS.full,
                border: `1px solid ${filter === fb.id ? fb.color : COLORS.border}`,
                background: filter === fb.id ? `${fb.color}18` : "transparent",
                color: filter === fb.id ? fb.color : COLORS.muted,
                fontSize: 12,
                fontWeight: TYPOGRAPHY.fontWeight.semibold,
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: TYPOGRAPHY.fontFamily.base,
              }}
            >
              {fb.label}
              {fb.id !== "ALL" && (
                <span style={{ marginLeft: 6, opacity: 0.7 }}>
                  ({messages.filter((m) => m.status === fb.id).length})
                </span>
              )}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Telefon, mesaj veya sipariş ara..."
          style={{
            flex: "1 1 200px",
            padding: "8px 12px",
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.border}`,
            background: COLORS.bg.surface,
            color: COLORS.text,
            fontSize: 13,
            outline: "none",
            fontFamily: TYPOGRAPHY.fontFamily.base,
          }}
        />

        <Button variant="ghost" onClick={() => void onRefresh()} icon={<RefreshCw size={14} />} title="Yenile">
          Yenile
        </Button>
      </div>

      {/* Tablo */}
      <Card>
        {filtered.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: COLORS.muted, fontSize: 13 }}>
            {search || filter !== "ALL" ? "Filtreye uygun mesaj bulunamadı." : "Henüz mesaj bulunmuyor."}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Telefon", "Durum", "Sipariş", "Gönderen", "Tarih", "Mesaj", "Hata"].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        borderBottom: `1px solid ${COLORS.border}`,
                        color: COLORS.muted,
                        fontWeight: TYPOGRAPHY.fontWeight.semibold,
                        fontSize: 11,
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => {
                  const sc = STATUS_COLORS[m.status] ?? STATUS_COLORS.PENDING;
                  return (
                    <tr key={m.id} style={{ transition: "background 0.1s ease" }}>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: 12 }}>
                        {m.toPhone}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "2px 8px",
                            borderRadius: RADIUS.full,
                            background: sc.bg,
                            color: sc.color,
                            fontSize: 11,
                            fontWeight: TYPOGRAPHY.fontWeight.semibold,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {m.status === "SENT" && <CheckCircle size={10} />}
                          {m.status === "FAILED" && <XCircle size={10} />}
                          {m.status === "PENDING" && <Clock size={10} />}
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 12 }}>
                        {m.orderTsCode || "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted }}>
                        {m.sentBy || "—"}
                      </td>
                      <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, color: COLORS.muted, fontSize: 12, whiteSpace: "nowrap" }}>
                        {m.sentAt ? new Date(m.sentAt).toLocaleString("tr-TR") : "—"}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          maxWidth: 220,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={m.message}
                      >
                        {m.message}
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                          borderBottom: `1px solid ${COLORS.border}`,
                          color: COLORS.danger.DEFAULT,
                          fontSize: 11,
                          maxWidth: 150,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={m.error ?? ""}
                      >
                        {m.error || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div style={{ padding: "8px 10px", borderTop: `1px solid ${COLORS.border}`, fontSize: 11, color: COLORS.muted }}>
          {filtered.length} / {messages.length} mesaj gösteriliyor
        </div>
      </Card>
    </div>
  );
}

export default WhatsAppBusinessPage;

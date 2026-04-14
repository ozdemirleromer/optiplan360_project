/**
 * WhatsApp Business — Alt bileşenler (Atoms)
 */

import React, { useState, useEffect } from "react";
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
import { Button, Card, KPICard, COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from "../../components/Shared";
import type { WhatsAppTemplate, WhatsAppMessage, WhatsAppSummary, TabId, MessageFilterId } from "./whatsAppTypes";
import {
  STATUS_COLORS,
  TAB_IDS,
  TAB_LABELS,
  FILTER_BUTTONS,
  buildInputStyle,
  buildLabelStyle,
  calcSuccessRate,
  filterMessages,
} from "./whatsAppUtils";

// ── Sekme başlık bileşeni ────────────────────────────────────

export function TabBar({
  activeTab,
  onChange,
}: {
  activeTab: TabId;
  onChange: (tab: TabId) => void;
}) {
  const TAB_ICONS: Record<TabId, React.ReactNode> = {
    overview: <BarChart3 size={16} aria-hidden="true" />,
    config: <Settings size={16} aria-hidden="true" />,
    send: <Send size={16} aria-hidden="true" />,
    history: <FileText size={16} aria-hidden="true" />,
    templates: <MessageCircle size={16} aria-hidden="true" />,
  };

  return (
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
      {TAB_IDS.map((id) => (
        <button
          type="button"
          key={id}
          role="tab"
          aria-selected={activeTab === id}
          onClick={() => onChange(id)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "10px 16px",
            background: "transparent",
            border: "none",
            borderBottom: `2px solid ${activeTab === id ? COLORS.primary : "transparent"}`,
            color: activeTab === id ? COLORS.primary : COLORS.muted,
            fontWeight: activeTab === id ? TYPOGRAPHY.fontWeight.semibold : TYPOGRAPHY.fontWeight.normal,
            fontSize: 13,
            cursor: "pointer",
            transition: "all 0.15s ease",
            whiteSpace: "nowrap",
            fontFamily: TYPOGRAPHY.fontFamily.base,
          }}
        >
          {TAB_ICONS[id]}
          {TAB_LABELS[id]}
        </button>
      ))}
    </div>
  );
}

// ── Toast bileşeni ───────────────────────────────────────────

export function ToastMessage({
  type,
  text,
}: {
  type: "success" | "error";
  text: string;
}) {
  return (
    <div
      role="alert"
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 9999,
        padding: "12px 20px",
        borderRadius: RADIUS.md,
        background: type === "success" ? COLORS.success : COLORS.danger,
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
      {type === "success" ? <CheckCircle size={16} /> : <XCircle size={16} />}
      {text}
    </div>
  );
}

// ── Durum badge bileşeni ─────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const sc = STATUS_COLORS[status] ?? STATUS_COLORS.PENDING;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "2px 8px",
        borderRadius: "50%",
        background: sc.bg,
        color: sc.color,
        fontSize: 11,
        fontWeight: TYPOGRAPHY.fontWeight.semibold,
        whiteSpace: "nowrap",
      }}
    >
      {status === "SENT" && <CheckCircle size={10} />}
      {status === "FAILED" && <XCircle size={10} />}
      {status === "PENDING" && <Clock size={10} />}
      {sc.label}
    </span>
  );
}

// ═══════════════════════════════════════════════════
// GENEL BAKIŞ SEKMESİ
// ═══════════════════════════════════════════════════

export function OverviewTab({
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
      <Card title="Bağlantı Durumu" icon={<Zap size={14} aria-hidden="true" />}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: isConfigured ? COLORS.success : COLORS.danger,
              boxShadow: isConfigured
                ? `0 0 8px ${COLORS.success}`
                : `0 0 8px ${COLORS.danger}`,
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
              background: COLORS.warning,
              color: COLORS.warning,
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
          color={COLORS.primary}
        />
        <KPICard
          icon={<Clock size={16} aria-hidden="true" />}
          label="Bugün Gönderilen"
          value={summary?.todaySent ?? 0}
          color={COLORS.success}
        />
        <KPICard
          icon={<XCircle size={16} aria-hidden="true" />}
          label="Başarısız"
          value={summary?.failed ?? 0}
          color={COLORS.danger}
        />
        <KPICard
          icon={<CheckCircle size={16} aria-hidden="true" />}
          label="Başarı Oranı"
          value={calcSuccessRate(summary)}
          color={COLORS.accent}
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
                {messages.slice(0, 5).map((m) => (
                  <tr key={m.id}>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: 12 }}>
                      {m.toPhone}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` }}>
                      <StatusBadge status={m.status} />
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
                ))}
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

export function ConfigTab({
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

  const inputStyle = buildInputStyle();
  const labelStyle = buildLabelStyle();

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

      {/* Bağlantı Testi */}
      <Card title="Bağlantı Testi" icon={<Zap size={14} aria-hidden="true" />}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: config?.configured ? COLORS.success : COLORS.warning,
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
              background: COLORS.success,
              fontSize: 12,
              color: COLORS.success,
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

export function SendTab({
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

  const inputStyle = buildInputStyle();
  const labelStyle = buildLabelStyle();

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
              background: COLORS.warning,
              color: COLORS.warning,
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

          {/* Sipariş ID */}
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
              style={{ ...inputStyle, cursor: "pointer", appearance: "auto" }}
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
                style={{ ...inputStyle, resize: "vertical", minHeight: 80 }}
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

      {/* Sağ: Önizleme + Şablon Listesi */}
      <div style={{ display: "grid", gap: 16, alignContent: "start" }}>
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
                    border: `1px solid ${selectedTemplate === t.name ? COLORS.primary : COLORS.border}`,
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
                        borderRadius: "50%",
                        background: `${COLORS.primary}18`,
                        color: COLORS.primary,
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

export function HistoryTab({
  messages,
  onRefresh,
}: {
  messages: WhatsAppMessage[];
  onRefresh: () => Promise<void>;
}) {
  const [filter, setFilter] = useState<MessageFilterId>("ALL");
  const [search, setSearch] = useState("");

  const filtered = filterMessages(messages, filter, search);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Filtreler */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: 4 }}>
          {FILTER_BUTTONS.map((fb) => (
            <button
              type="button"
              key={fb.id}
              onClick={() => setFilter(fb.id)}
              style={{
                padding: "6px 14px",
                borderRadius: "50%",
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
                {filtered.map((m) => (
                  <tr key={m.id} style={{ transition: "background 0.1s ease" }}>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}`, fontFamily: TYPOGRAPHY.fontFamily.mono, fontSize: 12 }}>
                      {m.toPhone}
                    </td>
                    <td style={{ padding: "8px 10px", borderBottom: `1px solid ${COLORS.border}` }}>
                      <StatusBadge status={m.status} />
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
                        color: COLORS.danger,
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
                ))}
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

// ═══════════════════════════════════════════════════
// ŞABLON YÖNETİMİ SEKMESİ
// ═══════════════════════════════════════════════════

export function TemplatesTab({ templates }: { templates: WhatsAppTemplate[] }) {
  return (
    <div style={{ display: "grid", gap: 20 }}>
      <Card title="WhatsApp Şablonları" icon={<MessageCircle size={14} aria-hidden="true" />}>
        {templates.length === 0 ? (
          <p style={{ color: COLORS.muted, fontSize: 13, margin: 0 }}>API'den çekilmiş aktif şablon bulunamadı.</p>
        ) : (
          <div style={{ display: "grid", gap: 16 }}>
            {templates.map((tpl, i) => (
              <div
                key={i}
                style={{
                  padding: 16,
                  borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.bg?.surface || "rgba(255,255,255,0.02)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.text }}>{tpl.label || tpl.name}</span>
                  <span style={{ fontSize: 11, color: COLORS.muted, background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: 12 }}>{tpl.name}</span>
                </div>
                <div style={{ fontSize: 13, color: COLORS.text, whiteSpace: "pre-wrap", background: "rgba(0,0,0,0.1)", padding: 12, borderRadius: 8 }}>
                  {tpl.body}
                </div>
                {tpl.variables && tpl.variables.length > 0 && (
                  <div style={{ marginTop: 12, fontSize: 12, color: COLORS.muted }}>
                    <strong style={{ color: COLORS.text }}>Değişkenler:</strong> {tpl.variables.join(", ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
      <div style={{ padding: "16px 20px", background: "rgba(59, 130, 246, 0.1)", color: "#3b82f6", borderRadius: RADIUS.md, fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}>
        <span>Meta tarafında şablon oluşturmak için Meta Business Suite &gt; WhatsApp Manager kullanılmalıdır. Burada sadece Meta tabanlı onaylı şablonların önizlemesi yapılmaktadır.</span>
      </div>
    </div>
  );
}

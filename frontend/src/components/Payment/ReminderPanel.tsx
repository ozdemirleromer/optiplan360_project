import { CheckCircle, Clock, Eye, AlertTriangle, Send, RefreshCw } from "lucide-react";
import { Card, Button } from "../Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../Shared/constants";
import { type Invoice, ReminderType } from "../../services/paymentService";

interface ReminderPanelProps {
  invoices: Invoice[];
  onRefresh: () => void;
}

export default function ReminderPanel({ invoices, onRefresh: _onRefresh }: ReminderPanelProps) {
  // Hatırlatıcı alanları olan Faturaları filtrele
  const invoicesWithReminders = invoices.filter(i => i.reminderType);

  // Durum göre grupla
  const grouped = {
    pending: invoicesWithReminders.filter(i => i.reminderStatus === "PENDING"),
    sent: invoicesWithReminders.filter(i => i.reminderStatus === "SENT"),
    read: invoicesWithReminders.filter(i => i.reminderStatus === "READ"),
    ignored: invoicesWithReminders.filter(i => i.reminderStatus === "IGNORED"),
    bounced: invoicesWithReminders.filter(i => i.reminderStatus === "BOUNCED"),
  };

  const getReminderTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      [ReminderType.EMAIL]: "E-posta",
      [ReminderType.SMS]: "SMS",
      [ReminderType.IN_APP]: "Uygulama İçi",
      [ReminderType.LETTER]: "Mektup",
    };
    return map[type] || type;
  };

  const getReminderStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      PENDING: "Beklemede",
      SENT: "Gönderildi",
      READ: "Okundu",
      IGNORED: "Göz Ardı Edildi",
      BOUNCED: "Geri Döndü",
    };
    return labelMap[status] || status;
  };

  if (invoicesWithReminders.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: 8 }}>
            Hatırlatıcı Yok
          </div>
          <div style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.muted }}>
            Henüz hatırlatıcı ayarlanmış fatura yok. Fatura oluşturulduktan sonra hatırlatıcı ekleyebilirsiniz.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {/* Özet Kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
        {[
          { key: "pending", label: "Beklemede", count: grouped.pending.length, color: COLORS.accent[400] },
          { key: "sent", label: "Gönderildi", count: grouped.sent.length, color: COLORS.success.DEFAULT },
          { key: "read", label: "Okundu", count: grouped.read.length, color: COLORS.info.DEFAULT },
          { key: "ignored", label: "Göz Ardı", count: grouped.ignored.length, color: COLORS.muted },
          { key: "bounced", label: "Geri Döndü", count: grouped.bounced.length, color: COLORS.error.DEFAULT },
        ].map(stat => (
          <Card key={stat.key} style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.muted, marginBottom: 4 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: TYPOGRAPHY.fontSize.xl, fontWeight: TYPOGRAPHY.fontWeight.bold, color: stat.color }}>
              {stat.count}
            </div>
          </Card>
        ))}
      </div>

      {/* Beklemede Olan Hatırlatıcılar */}
      <Card>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
          <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, display: "flex", alignItems: "center", gap: 6 }}>
            <Clock size={16} color={COLORS.accent[400]} aria-hidden /> Gönderilmesi Beklenen Hatırlatıcılar ({grouped.pending.length})
          </h3>
        </div>

        {grouped.pending.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {grouped.pending.map(invoice => (
              <div
                key={invoice.id}
                style={{
                  padding: 12,
                  background: COLORS.bg.subtle,
                  borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`,
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  gap: 12,
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                    {invoice.invoiceNumber}
                  </div>
                  <div style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.muted, marginTop: 4 }}>
                    {getReminderTypeLabel(invoice.reminderType || "")} • Gönderim: {
                      invoice.nextReminderDate
                        ? new Date(invoice.nextReminderDate).toLocaleDateString("tr-TR")
                        : "—"
                    }
                  </div>
                  <div style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.muted, marginTop: 2 }}>
                    Tutar: ₺{(invoice.totalAmount ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })} • Kalan: ₺{(invoice.remainingAmount ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                  </div>
                </div>
                <Button variant="primary" size="sm" icon={<Send size={14} />} disabled title="Yakında">
                  Şimdi Gönder
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: COLORS.muted }}>
            Gönderilmesi beklenen hatırlatıcı yok
          </div>
        )}
      </Card>

      {/* Gönderilen Hatırlatıcılar */}
      {grouped.sent.length > 0 && (
        <Card>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, display: "flex", alignItems: "center", gap: 6 }}>
              <CheckCircle size={16} color={COLORS.success.DEFAULT} aria-hidden /> Gönderilen Hatırlatıcılar ({grouped.sent.length})
            </h3>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {grouped.sent.map(invoice => (
              <div
                key={invoice.id}
                style={{
                  padding: 12,
                  background: COLORS.bg.subtle,
                  borderRadius: RADIUS.md,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                    {invoice.invoiceNumber}
                  </div>
                  <div style={{ color: COLORS.muted, marginTop: 4 }}>
                    {getReminderTypeLabel(invoice.reminderType || "")} • {invoice.reminderCount} kez • Gönderim: {
                      invoice.reminderSentAt
                        ? new Date(invoice.reminderSentAt).toLocaleDateString("tr-TR")
                        : "—"
                    }
                  </div>
                </div>
                <CheckCircle size={16} color={COLORS.success.DEFAULT} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Okundu */}
      {grouped.read.length > 0 && (
        <Card>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
            <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, display: "flex", alignItems: "center", gap: 6 }}>
              <Eye size={16} color={COLORS.info.DEFAULT} aria-hidden /> Okunan Hatırlatıcılar ({grouped.read.length})
            </h3>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {grouped.read.map(invoice => (
              <div key={invoice.id} style={{ padding: 12, background: COLORS.bg.subtle, borderRadius: RADIUS.md, fontSize: TYPOGRAPHY.fontSize.sm }}>
                {invoice.invoiceNumber} • {getReminderTypeLabel(invoice.reminderType || "")}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Sorunlu Hatırlatıcılar */}
      {(grouped.ignored.length > 0 || grouped.bounced.length > 0) && (
        <Card style={{ border: `1px solid ${COLORS.error.DEFAULT}`, background: COLORS.error.light }}>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.error.DEFAULT}` }}>
            <h3 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.error.DEFAULT, display: "flex", alignItems: "center", gap: 6 }}>
              <AlertTriangle size={16} aria-hidden /> Sorunlu Hatırlatıcılar ({grouped.ignored.length + grouped.bounced.length})
            </h3>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[...grouped.ignored, ...grouped.bounced].map(invoice => (
              <div
                key={invoice.id}
                style={{
                  padding: 12,
                  background: COLORS.bg.subtle,
                  borderRadius: RADIUS.md,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                    {invoice.invoiceNumber}
                  </div>
                  <div style={{ color: COLORS.muted, marginTop: 4 }}>
                    {getReminderTypeLabel(invoice.reminderType || "")} • {getReminderStatusLabel(invoice.reminderStatus || "PENDING")}
                  </div>
                </div>
                <Button variant="secondary" size="sm" icon={<RefreshCw size={14} />} disabled title="Yakında">
                  Yeniden Gönder
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

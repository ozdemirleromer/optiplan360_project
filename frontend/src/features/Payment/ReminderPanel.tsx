import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle, Clock, Eye, RefreshCw, Send } from "lucide-react";

import { Card, Button } from "../../components/Shared";
import { useToast } from "../../contexts/ToastContext";
import { COLORS, RADIUS, TYPOGRAPHY } from "../../components/Shared/constants";
import { invoiceService, type Invoice, ReminderType } from "../../services/paymentService";

interface ReminderPanelProps {
  invoices: Invoice[];
  onRefresh: () => Promise<void> | void;
}

function getReminderTypeLabel(type: string) {
  const map: Record<string, string> = {
    [ReminderType.EMAIL]: "E-posta",
    [ReminderType.SMS]: "SMS",
    [ReminderType.IN_APP]: "Uygulama İçi",
    [ReminderType.LETTER]: "Mektup",
  };

  return map[type] || type;
}

function getReminderStatusLabel(status: string) {
  const labelMap: Record<string, string> = {
    PENDING: "Beklemede",
    SENT: "Gönderildi",
    READ: "Okundu",
    IGNORED: "Göz Ardı Edildi",
    BOUNCED: "Geri Döndü",
  };

  return labelMap[status] || status;
}

export default function ReminderPanel({ invoices, onRefresh }: ReminderPanelProps) {
  const { addToast } = useToast();
  const [sendingIds, setSendingIds] = useState<string[]>([]);

  const invoicesWithReminders = useMemo(
    () => invoices.filter((invoice) => invoice.reminderType),
    [invoices],
  );

  const grouped = useMemo(
    () => ({
      pending: invoicesWithReminders.filter((invoice) => invoice.reminderStatus === "PENDING"),
      sent: invoicesWithReminders.filter((invoice) => invoice.reminderStatus === "SENT"),
      read: invoicesWithReminders.filter((invoice) => invoice.reminderStatus === "READ"),
      ignored: invoicesWithReminders.filter((invoice) => invoice.reminderStatus === "IGNORED"),
      bounced: invoicesWithReminders.filter((invoice) => invoice.reminderStatus === "BOUNCED"),
    }),
    [invoicesWithReminders],
  );

  const handleSendReminder = async (invoice: Invoice, mode: "send" | "retry") => {
    if (sendingIds.includes(invoice.id)) {
      return;
    }

    setSendingIds((prev) => [...prev, invoice.id]);
    try {
      await invoiceService.sendReminder(invoice.id);
      addToast(
        mode === "retry"
          ? `Hatırlatma yeniden gönderildi: ${invoice.invoiceNumber}`
          : `Hatırlatma gönderildi: ${invoice.invoiceNumber}`,
        "success",
      );
      await onRefresh();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Hatırlatma gönderilemedi";
      addToast(message, "error");
    } finally {
      setSendingIds((prev) => prev.filter((id) => id !== invoice.id));
    }
  };

  if (invoicesWithReminders.length === 0) {
    return (
      <Card>
        <div style={{ textAlign: "center", padding: 40 }}>
          <div
            style={{
              fontSize: TYPOGRAPHY.fontSize.lg,
              fontWeight: TYPOGRAPHY.fontWeight.semibold,
              marginBottom: 8,
            }}
          >
            Hatırlatıcı Yok
          </div>
          <div style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.muted }}>
            Henüz hatırlatıcı ayarlanmış fatura yok. Fatura oluşturulduktan sonra hatırlatıcı
            ekleyebilirsiniz.
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
          gap: 12,
        }}
      >
        {[
          { key: "pending", label: "Beklemede", count: grouped.pending.length, color: COLORS.accent },
          { key: "sent", label: "Gönderildi", count: grouped.sent.length, color: COLORS.success },
          { key: "read", label: "Okundu", count: grouped.read.length, color: COLORS.primary },
          { key: "ignored", label: "Göz Ardı", count: grouped.ignored.length, color: COLORS.muted },
          { key: "bounced", label: "Geri Döndü", count: grouped.bounced.length, color: COLORS.danger },
        ].map((stat) => (
          <Card key={stat.key} style={{ padding: 12, textAlign: "center" }}>
            <div style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.muted, marginBottom: 4 }}>
              {stat.label}
            </div>
            <div
              style={{
                fontSize: TYPOGRAPHY.fontSize.xl,
                fontWeight: TYPOGRAPHY.fontWeight.bold,
                color: stat.color,
              }}
            >
              {stat.count}
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
          <h3
            style={{
              margin: 0,
              fontSize: TYPOGRAPHY.fontSize.base,
              fontWeight: TYPOGRAPHY.fontWeight.semibold,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Clock size={16} color={COLORS.accent} aria-hidden /> Gönderilmesi Beklenen
            Hatırlatıcılar ({grouped.pending.length})
          </h3>
        </div>

        {grouped.pending.length > 0 ? (
          <div style={{ display: "grid", gap: 12 }}>
            {grouped.pending.map((invoice) => {
              const isSending = sendingIds.includes(invoice.id);
              return (
                <div
                  key={invoice.id}
                  style={{
                    padding: 12,
                    background: COLORS.bg.elevated,
                    borderRadius: RADIUS.md,
                    border: `1px solid ${COLORS.border}`,
                    display: "grid",
                    gridTemplateColumns: "1fr auto",
                    gap: 12,
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>{invoice.invoiceNumber}</div>
                    <div
                      style={{
                        fontSize: TYPOGRAPHY.fontSize.xs,
                        color: COLORS.muted,
                        marginTop: 4,
                      }}
                    >
                      {getReminderTypeLabel(invoice.reminderType || "")} • Gönderim:{" "}
                      {invoice.nextReminderDate
                        ? new Date(invoice.nextReminderDate).toLocaleDateString("tr-TR")
                        : "—"}
                    </div>
                    <div
                      style={{
                        fontSize: TYPOGRAPHY.fontSize.xs,
                        color: COLORS.muted,
                        marginTop: 2,
                      }}
                    >
                      Tutar: ₺
                      {(invoice.totalAmount ?? 0).toLocaleString("tr-TR", {
                        maximumFractionDigits: 2,
                      })}{" "}
                      • Kalan: ₺
                      {(invoice.remainingAmount ?? 0).toLocaleString("tr-TR", {
                        maximumFractionDigits: 2,
                      })}
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={<Send size={14} />}
                    loading={isSending}
                    onClick={() => void handleSendReminder(invoice, "send")}
                    title="Hatırlatmayı hemen gönder"
                  >
                    Şimdi Gönder
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: 20, color: COLORS.muted }}>
            Gönderilmesi beklenen hatırlatıcı yok
          </div>
        )}
      </Card>

      {grouped.sent.length > 0 && (
        <Card>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
            <h3
              style={{
                margin: 0,
                fontSize: TYPOGRAPHY.fontSize.base,
                fontWeight: TYPOGRAPHY.fontWeight.semibold,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <CheckCircle size={16} color={COLORS.success} aria-hidden /> Gönderilen
              Hatırlatıcılar ({grouped.sent.length})
            </h3>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {grouped.sent.map((invoice) => (
              <div
                key={invoice.id}
                style={{
                  padding: 12,
                  background: COLORS.bg.elevated,
                  borderRadius: RADIUS.md,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  <div style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>{invoice.invoiceNumber}</div>
                  <div style={{ color: COLORS.muted, marginTop: 4 }}>
                    {getReminderTypeLabel(invoice.reminderType || "")} • {invoice.reminderCount} kez •
                    Gönderim:{" "}
                    {invoice.reminderSentAt
                      ? new Date(invoice.reminderSentAt).toLocaleDateString("tr-TR")
                      : "—"}
                  </div>
                </div>
                <CheckCircle size={16} color={COLORS.success} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {grouped.read.length > 0 && (
        <Card>
          <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: `1px solid ${COLORS.border}` }}>
            <h3
              style={{
                margin: 0,
                fontSize: TYPOGRAPHY.fontSize.base,
                fontWeight: TYPOGRAPHY.fontWeight.semibold,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Eye size={16} color={COLORS.primary} aria-hidden /> Okunan Hatırlatıcılar (
              {grouped.read.length})
            </h3>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {grouped.read.map((invoice) => (
              <div
                key={invoice.id}
                style={{
                  padding: 12,
                  background: COLORS.bg.elevated,
                  borderRadius: RADIUS.md,
                  fontSize: TYPOGRAPHY.fontSize.sm,
                }}
              >
                {invoice.invoiceNumber} • {getReminderTypeLabel(invoice.reminderType || "")}
              </div>
            ))}
          </div>
        </Card>
      )}

      {(grouped.ignored.length > 0 || grouped.bounced.length > 0) && (
        <Card style={{ border: `1px solid ${COLORS.danger}`, background: COLORS.danger }}>
          <div
            style={{
              marginBottom: 16,
              paddingBottom: 12,
              borderBottom: `1px solid ${COLORS.danger}`,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: TYPOGRAPHY.fontSize.base,
                fontWeight: TYPOGRAPHY.fontWeight.semibold,
                color: COLORS.danger,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <AlertTriangle size={16} aria-hidden /> Sorunlu Hatırlatıcılar (
              {grouped.ignored.length + grouped.bounced.length})
            </h3>
          </div>
          <div style={{ display: "grid", gap: 8 }}>
            {[...grouped.ignored, ...grouped.bounced].map((invoice) => {
              const isSending = sendingIds.includes(invoice.id);
              return (
                <div
                  key={invoice.id}
                  style={{
                    padding: 12,
                    background: COLORS.bg.elevated,
                    borderRadius: RADIUS.md,
                    fontSize: TYPOGRAPHY.fontSize.sm,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>{invoice.invoiceNumber}</div>
                    <div style={{ color: COLORS.muted, marginTop: 4 }}>
                      {getReminderTypeLabel(invoice.reminderType || "")} •{" "}
                      {getReminderStatusLabel(invoice.reminderStatus || "PENDING")}
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<RefreshCw size={14} />}
                    loading={isSending}
                    onClick={() => void handleSendReminder(invoice, "retry")}
                    title="Hatırlatmayı yeniden gönder"
                  >
                    Yeniden Gönder
                  </Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}




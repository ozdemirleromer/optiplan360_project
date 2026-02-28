import { useState } from "react";
import { X, Bell, AlertTriangle } from "lucide-react";
import { Card, Input, Select } from "../Shared";
import { COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from "../Shared/constants";
import { type Invoice, ReminderType, invoiceService } from "../../services/paymentService";

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onSubmit: (data: Invoice) => void;
  onClose: () => void;
}

export default function InvoiceForm({ invoice, onSubmit, onClose }: InvoiceFormProps) {
  const [formData, setFormData] = useState({
    account_id: invoice?.accountId || "",
    subtotal: invoice?.subtotal || 0,
    tax_rate: invoice?.taxAmount && invoice.subtotal ? (invoice.taxAmount / invoice.subtotal) * 100 : 20,
    discount_amount: invoice?.discountAmount || 0,
    invoice_type: invoice?.invoiceType || "SALES",
    notes: invoice?.notes || "",
    reminder_type: invoice?.reminderType || undefined,
    next_reminder_date: invoice?.nextReminderDate || "",
    due_date: invoice?.dueDate || "",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string | number | boolean | undefined) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));
    setError(null);
  };

  const calculateTotal = () => {
    const taxAmount = (formData.subtotal - formData.discount_amount) * (formData.tax_rate / 100);
    return (formData.subtotal - formData.discount_amount) + taxAmount;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.account_id.trim()) {
      setError("Hesap seçilmesi gereklidir");
      return;
    }
    
    if (formData.subtotal <= 0) {
      setError("Tutar 0'dan büyük olmalıdır");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const submitData = {
        account_id: formData.account_id,
        subtotal: formData.subtotal,
        tax_rate: formData.tax_rate,
        discount_amount: formData.discount_amount,
        total_amount: calculateTotal(),
        invoice_type: formData.invoice_type,
        notes: formData.notes,
        due_date: formData.due_date || undefined,
        reminder_type: formData.reminder_type || undefined,
        next_reminder_date: formData.next_reminder_date || undefined,
      };

      let result: Invoice;
      if (invoice?.id) {
        result = await invoiceService.update(invoice.id, submitData);
      } else {
        result = await invoiceService.create(submitData);
      }

      onSubmit(result);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Fatura islemi basarisiz oldu");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      style={{
        width: 600,
        maxHeight: "90vh",
        overflow: "auto",
        background: COLORS.bg.surface,
      }}
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
        <h2 style={{ margin: 0, fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold }}>
          {invoice ? "Fatura Düzenle" : "Yeni Fatura"}
        </h2>
        <button
          onClick={onClose}
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: COLORS.muted,
            padding: 4,
          }}
        >
          <X size={20} />
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "grid", gap: 16 }}>
        {/* Hesap Bilgileri */}
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.muted }}>
            HESAP BİLGİLERİ
          </h3>
          <Input
            label="Hesap ID"
            type="text"
            value={formData.account_id}
            onChange={e => handleChange("account_id", e.target.value)}
            required
          />
        </div>

        {/* Tutar Bilgileri */}
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.muted }}>
            TUTAR BİLGİLERİ
          </h3>
          <Input
            label="Ara Toplam (₺)"
            type="number"
            value={formData.subtotal}
            onChange={e => handleChange("subtotal", parseFloat(e.target.value) || 0)}
            required
          />
          <Input
            label="KDV Oranı (%)"
            type="number"
            value={formData.tax_rate}
            onChange={e => handleChange("tax_rate", parseFloat(e.target.value) || 0)}
            min="0"
            max="100"
          />
          <Input
            label="İndirim (₺)"
            type="number"
            value={formData.discount_amount}
            onChange={e => handleChange("discount_amount", parseFloat(e.target.value) || 0)}
            min="0"
          />
          <div
            style={{
              padding: 12,
              background: primaryRgba(0.05),
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
            }}
          >
            <div style={{ fontSize: TYPOGRAPHY.fontSize.sm, color: COLORS.muted, marginBottom: 4 }}>
              Toplam Tutar
            </div>
            <div style={{ fontSize: TYPOGRAPHY.fontSize.lg, fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.primary[500] }}>
              ₺{calculateTotal().toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Ödeme Bilgileri */}
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.muted }}>
            ÖDEME BİLGİLERİ
          </h3>
          <Input
            label="Vade Tarihi"
            type="date"
            value={formData.due_date}
            onChange={e => handleChange("due_date", e.target.value)}
          />
          <Select
            label="Fatura Türü"
            value={formData.invoice_type}
            onChange={(value) => handleChange("invoice_type", value as string)}
            options={[
              { value: "SALES", label: "Satış" },
              { value: "SERVICE", label: "Hizmet" },
              { value: "CREDIT", label: "Alacak" },
            ]}
          />
        </div>

        {/* Hatırlatıcı Bilgileri */}
        <div style={{ display: "grid", gap: 12, padding: 12, background: primaryRgba(0.05), borderRadius: RADIUS.md, border: `1px solid ${primaryRgba(0.2)}` }}>
          <h3 style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.muted, margin: 0, display: "flex", alignItems: "center", gap: 6 }}>
            <Bell size={14} aria-hidden /> ÖDEME HATIRLATICI
          </h3>
          <Select
            label="Hatırlatma Türü"
            value={formData.reminder_type || ""}
            onChange={(value) => handleChange("reminder_type", value === "" ? undefined : (value as string))}
            options={[
              { value: "", label: "Hatırlatıcı Yok" },
              { value: ReminderType.EMAIL, label: "E-posta" },
              { value: ReminderType.SMS, label: "SMS" },
              { value: ReminderType.IN_APP, label: "Uygulama İçi" },
              { value: ReminderType.LETTER, label: "Mektup" },
            ]}
          />
          {formData.reminder_type && (
            <Input
              label="Sonraki Hatırlatma Tarihi"
              type="datetime-local"
              value={formData.next_reminder_date}
              onChange={e => handleChange("next_reminder_date", e.target.value)}
            />
          )}
        </div>

        {/* Notlar */}
        <div style={{ display: "grid", gap: 12 }}>
          <h3 style={{ fontSize: TYPOGRAPHY.fontSize.sm, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.muted }}>
            NOTLAR
          </h3>
          <textarea
            value={formData.notes}
            onChange={e => handleChange("notes", e.target.value)}
            placeholder="Fatura hakkında notlar..."
            style={{
              padding: 12,
              border: `1px solid ${COLORS.border}`,
              borderRadius: RADIUS.md,
              fontFamily: TYPOGRAPHY.fontFamily.base,
              fontSize: TYPOGRAPHY.fontSize.sm,
              color: COLORS.text,
              background: COLORS.panel,
              resize: "vertical",
              minHeight: 80,
            }}
          />
        </div>

        {/* Hata Mesajı */}
        {error && (
          <div style={{
            padding: 12,
            background: COLORS.error.light,
            border: `1px solid ${COLORS.error.DEFAULT}`,
            borderRadius: RADIUS.md,
            color: COLORS.error.DEFAULT,
            fontSize: TYPOGRAPHY.fontSize.sm,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}>
            <AlertTriangle size={14} aria-hidden /> {error}
          </div>
        )}

        {/* Butonlar */}
        <div style={{ display: "flex", gap: 12, paddingTop: 12, borderTop: `1px solid ${COLORS.border}` }}>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bg.subtle,
              color: COLORS.text,
              borderRadius: RADIUS.md,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: TYPOGRAPHY.fontSize.sm,
              fontWeight: TYPOGRAPHY.fontWeight.medium,
              opacity: loading ? 0.5 : 1,
            }}
          >
            İptal
          </button>
          <button
            type="submit"
            disabled={loading}
            style={{
              flex: 1,
              padding: "10px 16px",
              border: "none",
              background: COLORS.primary[500],
              color: "white",
              borderRadius: RADIUS.md,
              cursor: loading ? "not-allowed" : "pointer",
              fontSize: TYPOGRAPHY.fontSize.sm,
              fontWeight: TYPOGRAPHY.fontWeight.medium,
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? "İşleniyor..." : (invoice ? "Güncelle" : "Oluştur")}
          </button>
        </div>
      </form>
    </Card>
  );
}

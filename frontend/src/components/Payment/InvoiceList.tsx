import { Edit2, Trash2, AlertCircle, CheckCircle, Clock, XCircle, Download, Eye } from "lucide-react";
import { useState } from "react";
import { Card } from "../Shared";
import { COLORS, RADIUS, TYPOGRAPHY } from "../Shared/constants";
import { type Invoice, PaymentStatus, invoiceService } from "../../services/paymentService";
import { exportInvoicesToPDF, exportInvoicesToExcel } from "../../utils/exportUtils";

interface InvoiceListProps {
  invoices: Invoice[];
  loading: boolean;
  onEdit: (invoice: Invoice) => void;
  onDelete?: (invoiceId: string) => void;
  onRefresh: () => void;
}

export default function InvoiceList({ invoices, loading, onEdit, onDelete, onRefresh }: InvoiceListProps) {
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [searchText, setSearchText] = useState<string>("");

  const handleDelete = async (invoice: Invoice) => {
    if (!confirm(`"${invoice.invoiceNumber}" faturası silmek istediğinizden emin misiniz?`)) {
      return;
    }
    try {
      await invoiceService.delete(invoice.id);
      if (onDelete) onDelete(invoice.id);
      onRefresh();
    } catch (err: unknown) {
      alert(`Silme islemi basarisiz: ${err instanceof Error ? err.message : "Bilinmeyen hata"}`);
    }
  };

  const filteredInvoices = invoices.filter(inv => {
    const statusMatch = !filterStatus || inv.status === filterStatus;
    const searchMatch = !searchText || 
      inv.invoiceNumber.toLowerCase().includes(searchText.toLowerCase()) ||
      inv.accountId.toLowerCase().includes(searchText.toLowerCase());
    return statusMatch && searchMatch;
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case PaymentStatus.PAID:
        return <CheckCircle size={16} color={COLORS.success.DEFAULT} />;
      case PaymentStatus.PENDING:
        return <Clock size={16} color={COLORS.accent[400]} />;
      case PaymentStatus.PARTIAL:
        return <Eye size={16} color={COLORS.info.DEFAULT} />;
      case PaymentStatus.OVERDUE:
        return <AlertCircle size={16} color={COLORS.error.DEFAULT} />;
      case PaymentStatus.CANCELLED:
        return <XCircle size={16} color={COLORS.muted} />;
      default:
        return null;
    }
  };

  const getStatusLabel = (status: string) => ({
    [PaymentStatus.PAID]: "Ödendi",
    [PaymentStatus.PENDING]: "Beklemede",
    [PaymentStatus.PARTIAL]: "Kısmi Ödendi",
    [PaymentStatus.OVERDUE]: "Vadesi Geçti",
    [PaymentStatus.CANCELLED]: "İptal",
  }[status] || status);

  const getStatusColor = (status: string) => ({
    [PaymentStatus.PAID]: COLORS.success.DEFAULT,
    [PaymentStatus.PENDING]: COLORS.accent[400],
    [PaymentStatus.PARTIAL]: COLORS.info.DEFAULT,
    [PaymentStatus.OVERDUE]: COLORS.error.DEFAULT,
  }[status] || COLORS.muted);

  const getReminderBadge = (invoice: Invoice) => {
    if (!invoice.reminderType) return null;
    const typeMap: Record<string, string> = { EMAIL: "E-posta", SMS: "SMS", IN_APP: "Uygulama", LETTER: "Mektup" };
    const statusMap: Record<string, string> = { PENDING: "Beklemede", SENT: "Gönderildi", READ: "Okundu", IGNORED: "Göz Ardı", BOUNCED: "Geri Döndü" };
    return `${typeMap[invoice.reminderType] || ""} · ${statusMap[invoice.reminderStatus || ""] || ""}`;
  };

  if (loading) return <Card><div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Yükleniyor...</div></Card>;
  if (invoices.length === 0) return <Card><div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>Henüz fatura yok</div></Card>;

  return (
    <Card style={{ overflow: "hidden" }}>
      {/* Filter Toolbar */}
      <div style={{ padding: 16, borderBottom: `1px solid ${COLORS.border}`, display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr auto", alignItems: "end" }}>
        <div>
          <label style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.muted, display: "block", marginBottom: 4 }}>Ara</label>
          <input type="text" placeholder="Fatura No..." value={searchText} onChange={(e) => setSearchText(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.panel, color: COLORS.text, fontSize: TYPOGRAPHY.fontSize.sm }} />
        </div>
        <div>
          <label style={{ fontSize: TYPOGRAPHY.fontSize.xs, color: COLORS.muted, display: "block", marginBottom: 4 }}>Durum</label>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: `1px solid ${COLORS.border}`, borderRadius: RADIUS.md, background: COLORS.panel, color: COLORS.text, fontSize: TYPOGRAPHY.fontSize.sm }}>
            <option value="">Tümü</option>
            <option value={PaymentStatus.PAID}>Ödendi</option>
            <option value={PaymentStatus.PENDING}>Beklemede</option>
            <option value={PaymentStatus.PARTIAL}>Kısmi Ödendi</option>
            <option value={PaymentStatus.OVERDUE}>Vadesi Geçti</option>
          </select>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => exportInvoicesToPDF(filteredInvoices)} style={{ padding: "8px 12px", background: COLORS.error.DEFAULT, color: "white", border: "none", borderRadius: RADIUS.md, cursor: "pointer", fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: "600", display: "flex", alignItems: "center", gap: 4 }}><Download size={14} /> PDF</button>
          <button onClick={() => exportInvoicesToExcel(filteredInvoices)} style={{ padding: "8px 12px", background: COLORS.success.DEFAULT, color: "white", border: "none", borderRadius: RADIUS.md, cursor: "pointer", fontSize: TYPOGRAPHY.fontSize.xs, fontWeight: "600", display: "flex", alignItems: "center", gap: 4 }}><Download size={14} /> Excel</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPOGRAPHY.fontSize.sm }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${COLORS.border}`, background: COLORS.bg.subtle }}>
              <th style={{ padding: 12, textAlign: "left", fontWeight: "600" }}>Fatura No</th>
              <th style={{ padding: 12, textAlign: "left", fontWeight: "600" }}>Hesap</th>
              <th style={{ padding: 12, textAlign: "right", fontWeight: "600" }}>Tutar</th>
              <th style={{ padding: 12, textAlign: "right", fontWeight: "600" }}>Ödenen</th>
              <th style={{ padding: 12, textAlign: "center", fontWeight: "600" }}>Durum</th>
              <th style={{ padding: 12, textAlign: "center", fontWeight: "600" }}>Hatırlatıcı</th>
              <th style={{ padding: 12, textAlign: "right", fontWeight: "600" }}>Vade</th>
              <th style={{ padding: 12, textAlign: "center", fontWeight: "600" }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {filteredInvoices.map((invoice) => (
              <tr key={invoice.id} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                <td style={{ padding: 12, fontWeight: "600" }}>{invoice.invoiceNumber ?? "—"}</td>
                <td style={{ padding: 12, color: COLORS.muted }}>{invoice.accountId ?? "—"}</td>
                <td style={{ padding: 12, textAlign: "right", fontWeight: "600" }}>₺{(invoice.totalAmount ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                <td style={{ padding: 12, textAlign: "right" }}>₺{(invoice.paidAmount ?? 0).toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                <td style={{ padding: 12, textAlign: "center", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>{getStatusIcon(invoice.status)} <span style={{ color: getStatusColor(invoice.status) }}>{getStatusLabel(invoice.status)}</span></td>
                <td style={{ padding: 12, textAlign: "center" }}>{getReminderBadge(invoice) || "—"}</td>
                <td style={{ padding: 12, textAlign: "right", color: COLORS.muted }}>{invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("tr-TR") : "—"}</td>
                <td style={{ padding: 12, textAlign: "center" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                    <button onClick={() => onEdit(invoice)} style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.info.DEFAULT, padding: 4 }} title="Düzenle"><Edit2 size={16} /></button>
                    <button onClick={() => handleDelete(invoice)} style={{ border: "none", background: "transparent", cursor: "pointer", color: COLORS.error.DEFAULT, padding: 4 }} title="Sil"><Trash2 size={16} /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

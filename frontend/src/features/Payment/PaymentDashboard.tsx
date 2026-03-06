import { useState, useEffect } from "react";
import { Plus, ClipboardList, Bell, BarChart2 } from "lucide-react";
import { Button, KPICard } from "../../components/Shared";
import { COLORS, TYPOGRAPHY, TRANSITIONS } from "../../components/Shared/constants";
import { TopBar } from "../../components/Layout";
import { invoiceService, paymentReportService, type Invoice, type AgingReport, type PaymentStatistics, PaymentStatus } from "../../services/paymentService";
import InvoiceForm from "./InvoiceForm";
import InvoiceList from "./InvoiceList";
import ReminderPanel from "./ReminderPanel";

type Tab = "invoices" | "reminders" | "aging";

export default function PaymentDashboard({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [agingData, setAgingData] = useState<AgingReport | null>(null);
  const [statistics, setStatistics] = useState<PaymentStatistics | null>(null);

  useEffect(() => {
    fetchInvoices();
    fetchAgingReport();
    fetchStatistics();
  }, []);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const data = await invoiceService.list();
      setInvoices(data);
    } catch (error) {
      console.error("Error fetching invoices:", error);
    } finally {
      setLoading(false);
    }
  };
  const fetchAgingReport = async () => {
    try {
      const data = await paymentReportService.getAgingReport();
      setAgingData(data);
    } catch (error) {
      console.error("Error fetching aging report:", error);
    }
  };

  const fetchStatistics = async () => {
    try {
      const data = await paymentReportService.getStatistics();
      setStatistics(data);
    } catch (error) {
      console.error("Error fetching statistics:", error);
    }
  };

  // İstatistikler
  const totalInvoices = invoices.length;
  const paidAmount = invoices
    .filter(i => i.status === PaymentStatus.PAID)
    .reduce((sum, i) => sum + (i.totalAmount ?? 0), 0);
  const pendingAmount = invoices
    .filter(i => i.status === PaymentStatus.PENDING || i.status === PaymentStatus.PARTIAL)
    .reduce((sum, i) => sum + (i.remainingAmount ?? 0), 0);
  const overdueCount = invoices.filter(i => i.status === PaymentStatus.OVERDUE).length;
  const reminderPendingCount = invoices.filter(i => i.reminderStatus === "PENDING" && i.reminderType).length;

  const handleCreateInvoice = async (_data: Invoice) => {
    // Data is already saved by InvoiceForm component
    // Just refresh the list
    await fetchInvoices();
    setShowForm(false);
    setEditingInvoice(null);
  };

  const handleEditInvoice = (invoice: Invoice) => {
    setEditingInvoice(invoice);
    setShowForm(true);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingInvoice(null);
  };

  return (
    <div>
      {!embedded && (
        <TopBar 
          title="Tahsilat Yönetimi" 
          subtitle="Faturaları ve ödeme hatırlatıcılarını yönet"
          breadcrumbs={["Ana İşlemler", "Tahsilat"]}
        >
          <Button 
            variant="primary" 
            size="sm" 
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingInvoice(null);
              setShowForm(true);
            }}
          >
            Yeni Fatura
          </Button>
        </TopBar>
      )}
      {embedded && (
        <div style={{ padding: "12px 0 0", display: "flex", justifyContent: "flex-end" }}>
          <Button 
            variant="primary" 
            size="sm" 
            icon={<Plus size={16} />}
            onClick={() => {
              setEditingInvoice(null);
              setShowForm(true);
            }}
          >
            Yeni Fatura
          </Button>
        </div>
      )}

      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto", display: "grid", gap: 20 }}>
        {/* KPI Kartları */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))", gap: 16 }}>
          <KPICard 
            icon="BI" 
            label="Toplam Fatura" 
            value={totalInvoices} 
            color={COLORS.primary} 
          />
          <KPICard 
            icon="PD" 
            label="Ödenen Tutar" 
            value={`₺${paidAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`} 
            color={COLORS.success} 
          />
          <KPICard 
            icon="PA" 
            label="Bekleyen Tutar" 
            value={`₺${pendingAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`} 
            color={COLORS.accent} 
          />
          <KPICard 
            icon="OD" 
            label="Vadesi Geçmiş" 
            value={overdueCount} 
            color={COLORS.danger}
          />
          <KPICard
            icon="RM"
            label="Bekleyen Hatırlatma"
            value={reminderPendingCount}
            color={COLORS.primary}
          />
          {statistics != null && (
            <KPICard
              icon="CR"
              label="Tahsilat Oranı"
              value={`%${statistics.collectionRate.toFixed(1)}`}
              color={statistics.collectionRate >= 80 ? COLORS.success : COLORS.accent}
            />
          )}
        </div>

        {/* Tab Kontrolü */}
        <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${COLORS.border}` }}>
          {[
            { id: "invoices" as const, label: "Faturalar", icon: <ClipboardList size={14} aria-hidden /> },
            { id: "reminders" as const, label: "Hatırlatıcılar", icon: <Bell size={14} aria-hidden /> },
            { id: "aging" as const, label: "Aging", icon: <BarChart2 size={14} aria-hidden /> },
          ].map(tab => (
            <button type="button"
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: TYPOGRAPHY.fontSize.sm,
                fontWeight: TYPOGRAPHY.fontWeight.medium,
                color: activeTab === tab.id ? COLORS.primary : COLORS.muted,
                borderBottom: activeTab === tab.id ? `2px solid ${COLORS.primary}` : "none",
                transition: TRANSITIONS.fast,
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* İçerik */}
        {activeTab === "invoices" && (
          <InvoiceList 
            invoices={invoices}
            loading={loading}
            onEdit={handleEditInvoice}
            onRefresh={fetchInvoices}
          />
        )}

        {activeTab === "reminders" && (
          <ReminderPanel
            invoices={invoices}
            onRefresh={fetchInvoices}
          />
        )}

        {activeTab === "aging" && (
          <div>
            <h3 style={{ fontSize: TYPOGRAPHY.fontSize.base, fontWeight: TYPOGRAPHY.fontWeight.semibold, marginBottom: 12 }}>
              Yaşlandırma Raporu
            </h3>
            {agingData ? (
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: TYPOGRAPHY.fontSize.sm }}>
                <thead>
                  <tr style={{ background: COLORS.surface }}>
                    <th style={{ padding: "8px 12px", textAlign: "left", borderBottom: `1px solid ${COLORS.border}` }}>Vade Aralığı</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${COLORS.border}` }}>Fatura Sayısı</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${COLORS.border}` }}>Toplam Tutar</th>
                  </tr>
                </thead>
                <tbody>
                  {agingData.buckets.map(bucket => (
                    <tr key={bucket.label} style={{ borderBottom: `1px solid ${COLORS.border}` }}>
                      <td style={{ padding: "8px 12px" }}>{bucket.label}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>{bucket.invoiceCount}</td>
                      <td style={{ padding: "8px 12px", textAlign: "right" }}>
                        ₺{bucket.totalAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                      </td>
                    </tr>
                  ))}
                  <tr style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold, background: COLORS.surface }}>
                    <td style={{ padding: "8px 12px" }}>Toplam Kalan</td>
                    <td />
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>
                      ₺{agingData.totalRemaining.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <p style={{ color: COLORS.muted }}>Aging raporu yükleniyor...</p>
            )}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 1000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={handleCloseForm}
        >
          <div onClick={e => e.stopPropagation()}>
            <InvoiceForm
              invoice={editingInvoice}
              onSubmit={handleCreateInvoice}
              onClose={handleCloseForm}
            />
          </div>
        </div>
      )}
    </div>
  );
}





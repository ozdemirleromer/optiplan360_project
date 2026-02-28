import { useState, useEffect } from "react";
import { Plus, ClipboardList, Bell } from "lucide-react";
import { Button, KPICard } from "../Shared";
import { COLORS, TYPOGRAPHY, TRANSITIONS } from "../Shared/constants";
import { TopBar } from "../Layout";
import { invoiceService, type Invoice, PaymentStatus } from "../../services/paymentService";
import { InvoiceForm, InvoiceList, ReminderPanel } from "./index";

type Tab = "invoices" | "reminders" | "create";

export default function PaymentDashboard({ embedded = false }: { embedded?: boolean }) {
  const [activeTab, setActiveTab] = useState<Tab>("invoices");
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  useEffect(() => {
    fetchInvoices();
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
            color={COLORS.primary[500]} 
          />
          <KPICard 
            icon="PD" 
            label="Ödenen Tutar" 
            value={`₺${paidAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`} 
            color={COLORS.success.DEFAULT} 
          />
          <KPICard 
            icon="PA" 
            label="Bekleyen Tutar" 
            value={`₺${pendingAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}`} 
            color={COLORS.accent[400]} 
          />
          <KPICard 
            icon="OD" 
            label="Vadesi Geçmiş" 
            value={overdueCount} 
            color={COLORS.error.DEFAULT}
          />
          <KPICard 
            icon="RM" 
            label="Bekleyen Hatırlatma" 
            value={reminderPendingCount}
            color={COLORS.info.DEFAULT}
          />
        </div>

        {/* Tab Kontrolü */}
        <div style={{ display: "flex", gap: 8, borderBottom: `1px solid ${COLORS.border}` }}>
          {[
            { id: "invoices" as const, label: "Faturalar", icon: <ClipboardList size={14} aria-hidden /> },
            { id: "reminders" as const, label: "Hatırlatıcılar", icon: <Bell size={14} aria-hidden /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "12px 16px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: TYPOGRAPHY.fontSize.sm,
                fontWeight: TYPOGRAPHY.fontWeight.medium,
                color: activeTab === tab.id ? COLORS.primary[500] : COLORS.muted,
                borderBottom: activeTab === tab.id ? `2px solid ${COLORS.primary[500]}` : "none",
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

import { useState } from "react";
import { ArrowDown, CheckCircle, Clock, Plus, Trash2, Zap } from "lucide-react";
import { TopBar } from "../Layout/TopBar";
import { Button } from "../Shared/Button";
import { COLORS, RADIUS } from "../Shared/constants";

interface WorkflowStep {
  id: string;
  type: "trigger" | "condition" | "action";
  config: {
    typeId: string;
    label: string;
    params: Record<string, string>;
  };
}

interface Workflow {
  id: string;
  name: string;
  description: string;
  active: boolean;
  steps: WorkflowStep[];
  lastRun?: string;
  runCount: number;
}

const DEFAULT_WORKFLOWS: Workflow[] = [
  {
    id: "wf-1",
    name: "Gecikme Uyarisi",
    description: "Geciken siparisler icin otomatik bildirim",
    active: true,
    steps: [
      { id: "s1", type: "trigger", config: { typeId: "schedule", label: "Her gun 09:00", params: { time: "09:00" } } },
      { id: "s2", type: "action", config: { typeId: "send_email", label: "Musteriye e-posta", params: { to: "{{customer.email}}" } } },
      { id: "s3", type: "action", config: { typeId: "send_whatsapp", label: "WhatsApp bildirim", params: { to: "{{customer.phone}}" } } },
    ],
    lastRun: "2024-02-18T09:00:00Z",
    runCount: 45,
  },
  {
    id: "wf-2",
    name: "Dusuk Stok Tedarik",
    description: "Stok azalinca tedarikciye otomatik siparis",
    active: true,
    steps: [
      { id: "s1", type: "trigger", config: { typeId: "stock_low", label: "Stok esik altina dusunce", params: { threshold: "20" } } },
      { id: "s2", type: "action", config: { typeId: "send_email", label: "Tedarikciye siparis", params: { to: "{{supplier.email}}" } } },
      { id: "s3", type: "action", config: { typeId: "create_report", label: "Stok raporu olustur", params: {} } },
    ],
    lastRun: "2024-02-17T14:30:00Z",
    runCount: 12,
  },
  {
    id: "wf-3",
    name: "Istasyon Ariza Protokolu",
    description: "Istasyon arizalaninca yoneticiye bildir",
    active: false,
    steps: [
      { id: "s1", type: "trigger", config: { typeId: "station_offline", label: "Istasyon cevrimdisi", params: {} } },
      { id: "s2", type: "action", config: { typeId: "notify_user", label: "Yoneticiye bildir", params: { role: "ADMIN" } } },
      { id: "s3", type: "action", config: { typeId: "send_telegram", label: "Telegram uyarisi", params: {} } },
    ],
    runCount: 8,
  },
];

export const WorkflowBuilder = () => {
  const [workflows, setWorkflows] = useState<Workflow[]>(DEFAULT_WORKFLOWS);
  const [selectedWorkflow, setSelectedWorkflow] = useState<Workflow | null>(null);

  const toggleWorkflow = (id: string) => {
    setWorkflows((prev) => prev.map((wf) => (wf.id === id ? { ...wf, active: !wf.active } : wf)));
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows((prev) => prev.filter((wf) => wf.id !== id));
    if (selectedWorkflow?.id === id) setSelectedWorkflow(null);
  };

  return (
    <div className="electric-page">
      <TopBar
        title="Is Otomasyon Akislari"
        subtitle="Surec tabanli otomasyonlari yonetin"
        breadcrumbs={["Yonetim", "Workflow Builder"]}
      >
        <Button variant="primary" size="sm">
          <Plus size={16} /> Yeni Akis
        </Button>
      </TopBar>

      <div className="app-page-container">
        <div style={{ display: "grid", gap: 16 }}>
          {workflows.map((wf) => (
            <div
              key={wf.id}
              style={{
                padding: 20,
                borderRadius: RADIUS.lg,
                border: `1px solid ${selectedWorkflow?.id === wf.id ? COLORS.primary.DEFAULT + "50" : COLORS.border}`,
                background: COLORS.bg.surface,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => setSelectedWorkflow(wf)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: RADIUS.md,
                      background: wf.active ? `${COLORS.success.DEFAULT}20` : `${COLORS.gray[400]}20`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: wf.active ? COLORS.success.DEFAULT : COLORS.gray[400],
                    }}
                  >
                    <Zap size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{wf.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{wf.description}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right", fontSize: 11, color: COLORS.muted }}>
                    <div>{wf.runCount} calistirma</div>
                    {wf.lastRun && <div>Son: {new Date(wf.lastRun).toLocaleDateString("tr-TR")}</div>}
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleWorkflow(wf.id);
                    }}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      border: "none",
                      background: wf.active ? COLORS.success.DEFAULT : COLORS.gray[400],
                      cursor: "pointer",
                      position: "relative",
                      transition: "background 0.2s",
                    }}
                  >
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "white",
                        position: "absolute",
                        top: 3,
                        left: wf.active ? 23 : 3,
                        transition: "left 0.2s",
                      }}
                    />
                  </button>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteWorkflow(wf.id);
                    }}
                    style={{ background: "none", border: "none", color: COLORS.danger.DEFAULT, cursor: "pointer", padding: 4 }}
                    aria-label="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {wf.steps.map((step, i) => (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        padding: "4px 10px",
                        borderRadius: 16,
                        background: step.type === "trigger" ? `${COLORS.info.DEFAULT}20` : `${COLORS.accent.DEFAULT}20`,
                        color: step.type === "trigger" ? COLORS.info.DEFAULT : COLORS.accent.DEFAULT,
                        fontSize: 11,
                        fontWeight: 500,
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      {step.type === "trigger" ? <Clock size={12} /> : <CheckCircle size={12} />}
                      {step.config.label}
                    </div>
                    {i < wf.steps.length - 1 && (
                      <ArrowDown size={14} style={{ color: COLORS.muted, transform: "rotate(-90deg)" }} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {workflows.length === 0 && (
          <div style={{ textAlign: "center", padding: 48, color: COLORS.muted }}>
            <Zap size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <h3 style={{ color: COLORS.text, marginBottom: 8 }}>Henuz otomasyon akisi yok</h3>
            <p style={{ fontSize: 14 }}>Ilk otomasyonunuzu olusturmak icin "Yeni Akis" butonunu kullanin.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default WorkflowBuilder;

import { useState } from "react";
import { ArrowDown, CheckCircle, Clock, Plus, Trash2, Zap } from "lucide-react";

import { TopBar } from "../../components/Layout/TopBar";
import { Button } from "../../components/Shared/Button";
import { COLORS, RADIUS } from "../../components/Shared/constants";

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
    setWorkflows((prev) => prev.map((workflow) => (workflow.id === id ? { ...workflow, active: !workflow.active } : workflow)));
  };

  const deleteWorkflow = (id: string) => {
    setWorkflows((prev) => prev.filter((workflow) => workflow.id !== id));
    if (selectedWorkflow?.id === id) {
      setSelectedWorkflow(null);
    }
  };

  const createWorkflow = () => {
    const seed = Date.now();
    const nextWorkflow: Workflow = {
      id: `wf-${seed}`,
      name: `Yeni Akis ${workflows.length + 1}`,
      description: "Duzenlenmeyi bekleyen yeni otomasyon akisi",
      active: false,
      steps: [
        {
          id: `step-${seed}`,
          type: "trigger",
          config: { typeId: "manual", label: "Elle baslat", params: {} },
        },
      ],
      runCount: 0,
    };

    setWorkflows((prev) => [nextWorkflow, ...prev]);
    setSelectedWorkflow(nextWorkflow);
  };

  return (
    <div className="electric-page">
      <TopBar
        title="Is Otomasyon Akislari"
        subtitle="Surec tabanli otomasyonlari yonetin"
        breadcrumbs={["Yonetim", "Workflow Builder"]}
      >
        <Button variant="primary" size="sm" onClick={createWorkflow}>
          <Plus size={16} /> Yeni Akis
        </Button>
      </TopBar>

      <div className="app-page-container">
        <div style={{ display: "grid", gap: 16 }}>
          {workflows.map((workflow) => (
            <div
              key={workflow.id}
              style={{
                padding: 20,
                borderRadius: RADIUS.lg,
                border: `1px solid ${selectedWorkflow?.id === workflow.id ? COLORS.primary + "50" : COLORS.border}`,
                background: COLORS.bg.surface,
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
              onClick={() => setSelectedWorkflow(workflow)}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: RADIUS.md,
                      background: workflow.active ? `${COLORS.success}20` : `${COLORS.muted}20`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: workflow.active ? COLORS.success : COLORS.muted,
                    }}
                  >
                    <Zap size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: COLORS.text }}>{workflow.name}</div>
                    <div style={{ fontSize: 12, color: COLORS.muted, marginTop: 2 }}>{workflow.description}</div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ textAlign: "right", fontSize: 11, color: COLORS.muted }}>
                    <div>{workflow.runCount} calistirma</div>
                    {workflow.lastRun && <div>Son: {new Date(workflow.lastRun).toLocaleDateString("tr-TR")}</div>}
                  </div>

                  <button type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleWorkflow(workflow.id);
                    }}
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      border: "none",
                      background: workflow.active ? COLORS.success : COLORS.muted,
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
                        left: workflow.active ? 23 : 3,
                        transition: "left 0.2s",
                      }}
                    />
                  </button>

                  <button type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteWorkflow(workflow.id);
                    }}
                    style={{ background: "none", border: "none", color: COLORS.danger, cursor: "pointer", padding: 4 }}
                    aria-label="Sil"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
                {workflow.steps.map((step, index) => (
                  <div key={step.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        padding: "4px 10px",
                        borderRadius: 16,
                        background: step.type === "trigger" ? `${COLORS.primary}20` : `${COLORS.accent}20`,
                        color: step.type === "trigger" ? COLORS.primary : COLORS.accent,
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
                    {index < workflow.steps.length - 1 && (
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





import { Calculator, ClipboardList, File, Package, Settings2, Warehouse, Wrench } from "lucide-react";

type RibbonPage =
  | "dashboard"
  | "orders"
  | "order-editor"
  | "kanban"
  | "card-management"
  | "reports-analytics"
  | "system-logs"
  | "user-management"
  | "integrations"
  | "integration-health"
  | "stations"
  | "config"
  | "organization"
  | "user-activity"
  | "workflows"
  | "api-portal"
  | "whatsapp-business"
  | "price-tracking"
  | "ai-assistant"
  | "ai-config"
  | "orchestrator"
  | "product-search"
  | "crm-tickets"
  | "export-page";

type RibbonTab = "dosya" | "cari" | "siparis" | "optimizasyon";

interface WindowsRibbonBarProps {
  activePage: RibbonPage;
  onNavigate: (page: RibbonPage) => void;
}

const PAGE_TO_TAB: Record<RibbonPage, RibbonTab> = {
  dashboard: "cari",
  orders: "siparis",
  "order-editor": "siparis",
  kanban: "siparis",
  "card-management": "cari",
  "reports-analytics": "optimizasyon",
  "system-logs": "optimizasyon",
  "user-management": "cari",
  integrations: "optimizasyon",
  "integration-health": "optimizasyon",
  stations: "optimizasyon",
  config: "optimizasyon",
  organization: "cari",
  "user-activity": "cari",
  workflows: "optimizasyon",
  "api-portal": "optimizasyon",
  "whatsapp-business": "cari",
  "price-tracking": "optimizasyon",
  "ai-assistant": "optimizasyon",
  "ai-config": "optimizasyon",
  orchestrator: "optimizasyon",
  "product-search": "siparis",
  "crm-tickets": "cari",
  "export-page": "siparis",
};

const TAB_LABELS: Record<RibbonTab, string> = {
  dosya: "Dosya",
  cari: "Cari İşlemleri",
  siparis: "Sipariş",
  optimizasyon: "Optimizasyon",
};

const TAB_DEFAULT_PAGE: Record<RibbonTab, RibbonPage> = {
  dosya: "dashboard",
  cari: "card-management",
  siparis: "orders",
  optimizasyon: "orchestrator",
};

const TOOL_GROUPS: Record<
  RibbonTab,
  Array<{ title: string; actions: Array<{ label: string; icon: JSX.Element; page: RibbonPage }> }>
> = {
  dosya: [
    {
      title: "Dosya",
      actions: [
        { label: "Yeni", icon: <File className="h-5 w-5" />, page: "order-editor" },
        { label: "Aç", icon: <ClipboardList className="h-5 w-5" />, page: "orders" },
        { label: "Kaydet", icon: <Package className="h-5 w-5" />, page: "order-editor" },
      ],
    },
  ],
  cari: [
    {
      title: "Kayıt",
      actions: [
        { label: "Yeni Ekle", icon: <ClipboardList className="h-5 w-5" />, page: "card-management" },
        { label: "Borçlandır", icon: <Calculator className="h-5 w-5" />, page: "crm-tickets" },
        { label: "Mutabakat", icon: <Wrench className="h-5 w-5" />, page: "reports-analytics" },
      ],
    },
  ],
  siparis: [
    {
      title: "Sipariş Akışı",
      actions: [
        { label: "Sipariş Listesi", icon: <ClipboardList className="h-5 w-5" />, page: "orders" },
        { label: "Yeni Sipariş", icon: <Package className="h-5 w-5" />, page: "order-editor" },
        { label: "Kanban", icon: <Wrench className="h-5 w-5" />, page: "kanban" },
      ],
    },
  ],
  optimizasyon: [
    {
      title: "Motor",
      actions: [
        { label: "Orchestrator", icon: <Wrench className="h-5 w-5" />, page: "orchestrator" },
        { label: "Raporlar", icon: <ClipboardList className="h-5 w-5" />, page: "reports-analytics" },
        { label: "Sistem", icon: <Settings2 className="h-5 w-5" />, page: "system-logs" },
        { label: "Stok", icon: <Warehouse className="h-5 w-5" />, page: "product-search" },
      ],
    },
  ],
};

export function WindowsRibbonBar({ activePage, onNavigate }: WindowsRibbonBarProps) {
  const activeTab = PAGE_TO_TAB[activePage] ?? "siparis";

  return (
    <header className="hidden h-[85px] w-full border-b border-[#333333] bg-[#1E1E1E] text-[#F3F4F6] md:flex md:flex-col">
      <div className="flex h-7 items-center justify-between border-b border-[#333333] px-1">
        <div className="flex items-center gap-2 text-[11px] font-semibold">
          <span className="inline-flex h-5 w-5 items-center justify-center border border-[#38BDF8] text-[#38BDF8]">OP</span>
          <span>OptiPlan 360</span>
          <span className="text-[#C6C6C6]">| Windows Endüstriyel Kabuk</span>
        </div>
        <div className="flex items-center gap-1 text-[10px]">
          <button type="button" className="h-5 w-6 border border-[#333333] hover:border-[#38BDF8]">_</button>
          <button type="button" className="h-5 w-6 border border-[#333333] hover:border-[#38BDF8]">□</button>
          <button type="button" className="h-5 w-6 border border-[#333333] text-[#EF4444] hover:border-[#EF4444]">×</button>
        </div>
      </div>

      <div className="flex h-6 items-end border-b border-[#333333] px-1">
        <div className="flex h-6 items-end gap-0">
          {(Object.keys(TAB_LABELS) as RibbonTab[]).map((tab) => {
            const active = tab === activeTab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onNavigate(TAB_DEFAULT_PAGE[tab])}
                className={`relative h-6 min-w-[92px] border-l border-r border-t px-2 text-[11px] ${
                  active ? "border-[#333333] bg-[#121212] text-[#38BDF8]" : "border-transparent text-[#F3F4F6]"
                }`}
              >
                {TAB_LABELS[tab]}
                {active ? <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#38BDF8]" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex h-8 items-center gap-2 px-1">
        {TOOL_GROUPS[activeTab].map((group) => (
          <div key={group.title} className="group flex items-center gap-1 border-r border-[#333333] pr-2 peer">
            {group.actions.map((action) => (
              <button
                key={action.label}
                type="button"
                onClick={() => onNavigate(action.page)}
                className="flex h-8 min-w-[58px] flex-col items-center justify-center gap-0 rounded-none border border-[#333333] bg-[#1E1E1E] px-1 text-[9px] uppercase leading-none hover:border-[#0078D4] hover:text-[#0078D4]"
              >
                {action.icon}
                <span>{action.label}</span>
              </button>
            ))}
            <span className="text-[9px] uppercase text-[#C6C6C6]">{group.title}</span>
          </div>
        ))}
      </div>
    </header>
  );
}

export default WindowsRibbonBar;
import { useCallback, useEffect, useRef, useState } from "react";
import { Download, FileSpreadsheet, FileUp, Phone, Printer, Trash2 } from "lucide-react";
import { OrderOptimizationGrid } from "../Grid/OrderOptimizationGrid";
import { OrderOptimizationRibbon, type OrderOptimizationRibbonTab } from "../Ribbon/OrderOptimizationRibbon";
import type { MeasureRow } from "../Orders/OrderEditor/shared";
import { ORDER_OPTIMIZATION_THEME, orderOptimizationStyles, type OrderOptimizationThemeMode } from "./orderOptimizationStyles";
import { OrderOptimizationMetaStrip } from "./OrderOptimizationMetaStrip";
export { MATERIAL_SPECIFICATIONS, STANDARD_MEASUREMENTS } from "./orderOptimizationConstants";

interface PanelMessage {
  tone: "danger" | "success" | "warning";
  text: string;
}

interface OrderOptimizationPanelProps {
  themeMode: OrderOptimizationThemeMode;
  activeTab: OrderOptimizationRibbonTab;
  customerValue: string;
  customerName: string;
  customerPhone: string;
  orderNo: string;
  orderStatus: string;
  dueDate: string;
  plateBoy: string;
  plateEn: string;
  material: string;
  thickness: number;
  priority: string;
  customerSuggestions: string[];
  items: MeasureRow[];
  notice?: { text: string; tone: "default" | "danger" | "accent" } | null;
  messages?: PanelMessage[];
  totalParts: number;
  estimatedArea: string;
  validationState: "idle" | "valid" | "invalid";
  canDelete?: boolean;
  isDeleting?: boolean;
  isSaving?: boolean;
  isOptimizing?: boolean;
  validationErrors?: string[];
  onTabChange: (tab: OrderOptimizationRibbonTab) => void;
  onClose: () => void;
  onCustomerChange: (value: string) => void;
  onCustomerNameChange: (value: string) => void;
  onCustomerPhoneChange: (value: string) => void;
  onDueDateChange: (value: string) => void;
  onPlateBoyChange: (value: string) => void;
  onPlateEnChange: (value: string) => void;
  onPlateBoyBlur: () => void;
  onPlateEnBlur: () => void;
  onMaterialChange: (value: string) => void;
  onThicknessChange: (value: number) => void;
  onPriorityChange: (value: string) => void;
  onItemChange: (id: number, field: keyof MeasureRow, value: string | number | boolean) => void;
  onAddItem: () => void;
  onRemoveItem: (id: number) => void;
  onDuplicateItem: (id: number) => void;
  onSave: () => void;
  onOptimize: () => void;
  onValidate: () => void;
  onOpenImport: () => void;
  onExportCsv: () => void;
  onExportExcel: () => void;
  onPrint: () => void;
  onDownloadTemplate: () => void;
  onDelete?: () => void;
}

export function OrderOptimizationPanel({
  themeMode,
  activeTab,
  customerValue,
  customerName,
  customerPhone,
  orderNo,
  orderStatus,
  dueDate,
  plateBoy,
  plateEn,
  material,
  thickness,
  priority,
  customerSuggestions,
  items,
  notice,
  messages,
  totalParts,
  estimatedArea,
  validationState,
  canDelete,
  isDeleting,
  isSaving,
  isOptimizing,
  validationErrors,
  onTabChange,
  onClose,
  onCustomerChange,
  onCustomerNameChange,
  onCustomerPhoneChange,
  onDueDateChange,
  onPlateBoyChange,
  onPlateEnChange,
  onPlateBoyBlur,
  onPlateEnBlur,
  onMaterialChange,
  onThicknessChange,
  onPriorityChange,
  onItemChange,
  onAddItem,
  onRemoveItem,
  onDuplicateItem,
  onSave,
  onOptimize,
  onValidate,
  onOpenImport,
  onExportCsv,
  onExportExcel,
  onPrint,
  onDownloadTemplate,
  onDelete,
}: OrderOptimizationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const firstGridCellRef = useRef<HTMLInputElement>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (activeTab === "cari") {
      customerInputRef.current?.focus();
    }

    if (activeTab === "siparis") {
      firstGridCellRef.current?.focus();
    }
  }, [activeTab]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === panelRef.current);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleMinimizeToggle = useCallback(() => {
    setIsMinimized((prev) => !prev);
  }, []);

  const handleFullscreenToggle = useCallback(async () => {
    if (!panelRef.current) {
      return;
    }

    if (document.fullscreenElement === panelRef.current) {
      await document.exitFullscreen();
      return;
    }

    await panelRef.current.requestFullscreen();
  }, []);

  const validationLabel = validationState === "valid"
    ? "Doğrulama tamam"
    : validationState === "invalid"
      ? `${validationErrors?.length ?? 0} hata bulundu`
      : "Doğrulama bekleniyor";

  return (
    <div
      ref={panelRef}
      className={orderOptimizationStyles.panel}
      style={{
        ...ORDER_OPTIMIZATION_THEME[themeMode],
        fontFamily: '"Inter", sans-serif',
      }}
    >
      <OrderOptimizationRibbon
        activeTab={activeTab}
        isFullscreen={isFullscreen}
        isMinimized={isMinimized}
        onTabChange={onTabChange}
        onFullscreenToggle={() => void handleFullscreenToggle()}
        onMinimizeToggle={handleMinimizeToggle}
        onClose={onClose}
      />
      {isMinimized ? (
        <div className={orderOptimizationStyles.minimizedBanner}>Panel simge durumuna alındı</div>
      ) : (
        <>
          <OrderOptimizationMetaStrip
            customerValue={customerValue}
            orderNo={orderNo}
            dueDate={dueDate}
            customerSuggestions={customerSuggestions}
            customerInputRef={customerInputRef}
            onCustomerChange={onCustomerChange}
            onDueDateChange={onDueDateChange}
          />

          {messages && messages.length > 0 ? (
            <div className={orderOptimizationStyles.messageStack}>
              {messages.map((message) => (
                <div
                  key={`${message.tone}-${message.text}`}
                  className={`${orderOptimizationStyles.messageBar} ${message.tone === "danger"
                    ? orderOptimizationStyles.messageDanger
                    : message.tone === "success"
                      ? orderOptimizationStyles.messageSuccess
                      : orderOptimizationStyles.messageWarning
                    }`}
                >
                  {message.text}
                </div>
              ))}
            </div>
          ) : null}

          <div className={orderOptimizationStyles.detailStrip}>
            <section className={orderOptimizationStyles.detailCard}>
              <div className={orderOptimizationStyles.detailCardTitle}>Plan</div>
              <label className={orderOptimizationStyles.detailField}>
                <span className={orderOptimizationStyles.detailLabel}>Öncelik</span>
                <select
                  value={priority}
                  onChange={(event) => onPriorityChange(event.target.value)}
                  className={orderOptimizationStyles.selectInput}
                  style={{
                    color: "var(--op-text)",
                    backgroundColor: "var(--op-surface-bg)",
                  }}
                >
                  <option value="low" style={{ color: "#000", backgroundColor: "#fff" }}>Düşük</option>
                  <option value="normal" style={{ color: "#000", backgroundColor: "#fff" }}>Normal</option>
                  <option value="high" style={{ color: "#000", backgroundColor: "#fff" }}>Yüksek</option>
                  <option value="urgent" style={{ color: "#000", backgroundColor: "#fff" }}>Acil</option>
                </select>
              </label>
            </section>

            <section className={orderOptimizationStyles.detailCard}>
              <div className={orderOptimizationStyles.detailCardTitle}>Müşteri ve İletişim</div>
              <label className={orderOptimizationStyles.detailField}>
                <span className={orderOptimizationStyles.detailLabel}>Müşteri</span>
                <input
                  value={customerName}
                  onChange={(event) => onCustomerNameChange(event.target.value)}
                  className={orderOptimizationStyles.input}
                  placeholder="Müşteri adı"
                />
              </label>
              <label className={orderOptimizationStyles.detailField}>
                <span className={orderOptimizationStyles.detailLabel}>Telefon</span>
                <div className={orderOptimizationStyles.inlineField}>
                  <Phone className="h-3.5 w-3.5 opacity-60" />
                  <input
                    value={customerPhone}
                    onChange={(event) => onCustomerPhoneChange(event.target.value)}
                    className={`${orderOptimizationStyles.input} border-0 bg-transparent px-0`}
                    placeholder="+90 5xx xxx xx xx"
                  />
                </div>
              </label>
            </section>

            <section className={orderOptimizationStyles.detailCard}>
              <div className={orderOptimizationStyles.detailCardTitle}>Sipariş Özeti</div>
              <div className={orderOptimizationStyles.metricGrid}>
                <div className={orderOptimizationStyles.metricItem}>
                  <span className={orderOptimizationStyles.detailLabel}>Durum</span>
                  <span className={orderOptimizationStyles.statusPill}>{orderStatus}</span>
                </div>
                <div className={orderOptimizationStyles.metricItem}>
                  <span className={orderOptimizationStyles.detailLabel}>Parça</span>
                  <strong className={orderOptimizationStyles.metricValue}>{totalParts}</strong>
                </div>
                <div className={orderOptimizationStyles.metricItem}>
                  <span className={orderOptimizationStyles.detailLabel}>Alan</span>
                  <strong className={orderOptimizationStyles.metricValue}>{estimatedArea} m2</strong>
                </div>
                <div className={orderOptimizationStyles.metricItem}>
                  <span className={orderOptimizationStyles.detailLabel}>Doğrulama</span>
                  <strong className={orderOptimizationStyles.metricValue}>{validationLabel}</strong>
                </div>
              </div>
              <div className={orderOptimizationStyles.noticeLine}>
                <span className={orderOptimizationStyles.detailLabel}>Operasyon Notu</span>
                <span>{notice?.text || "Hazır"}</span>
              </div>
            </section>

            <section className={orderOptimizationStyles.detailCard}>
              <div className={orderOptimizationStyles.detailCardTitle}>Dosya ve Çıktı</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-[var(--op-border)] bg-[var(--op-surface-bg)] p-3 hover:border-[var(--op-accent)] hover:bg-[rgba(0,188,212,0.05)]">
                  <button type="button" className="flex flex-col items-center gap-2 text-[16px] font-semibold text-[var(--op-text)] hover:text-[var(--op-accent)]" onClick={onOpenImport}>
                    <FileUp className="h-6 w-6" />
                    <span>İçe Aktar</span>
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-[var(--op-border)] bg-[var(--op-surface-bg)] p-3 hover:border-[var(--op-accent)] hover:bg-[rgba(0,188,212,0.05)]">
                  <button type="button" className="flex flex-col items-center gap-2 text-[16px] font-semibold text-[var(--op-text)] hover:text-[var(--op-accent)]" onClick={onExportExcel}>
                    <FileSpreadsheet className="h-6 w-6" />
                    <span>Excel</span>
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-[var(--op-border)] bg-[var(--op-surface-bg)] p-3 hover:border-[var(--op-accent)] hover:bg-[rgba(0,188,212,0.05)]">
                  <button type="button" className="flex flex-col items-center gap-2 text-[16px] font-semibold text-[var(--op-text)] hover:text-[var(--op-accent)]" onClick={onExportCsv}>
                    <Download className="h-6 w-6" />
                    <span>CSV</span>
                  </button>
                </div>
                <div className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-[var(--op-border)] bg-[var(--op-surface-bg)] p-3 hover:border-[var(--op-accent)] hover:bg-[rgba(0,188,212,0.05)]">
                  <button type="button" className="flex flex-col items-center gap-2 text-[16px] font-semibold text-[var(--op-text)] hover:text-[var(--op-accent)]" onClick={onPrint}>
                    <Printer className="h-6 w-6" />
                    <span>Yazdır</span>
                  </button>
                </div>
              </div>
              {canDelete && onDelete ? (
                <button
                  type="button"
                  className={`${orderOptimizationStyles.fileActionButton} ${orderOptimizationStyles.fileActionDanger} w-full mt-2`}
                  onClick={onDelete}
                  disabled={isDeleting}
                >
                  <Trash2 className="h-5 w-5" />
                  {isDeleting ? "Siliniyor..." : "Sil"}
                </button>
              ) : null}
              <div className="mt-4 rounded-lg border-2 border-[#d32f2f] bg-[rgba(211,47,47,0.08)] p-2">
                <button type="button" className={`${orderOptimizationStyles.optimizationButton} w-full`} onClick={onOptimize} disabled={isOptimizing}>
                  {isOptimizing ? "Optimizasyon Devam Ediyor..." : "OPTİMİZASYON"}
                </button>
              </div>
            </section>
          </div>

          <div className={orderOptimizationStyles.workspaceContent}>
            <OrderOptimizationGrid
              items={items}
              plateBoy={plateBoy}
              notice={notice}
              firstCellRef={firstGridCellRef}
              onItemChange={onItemChange}
              onAddItem={onAddItem}
              onRemoveItem={onRemoveItem}
              onDuplicateItem={onDuplicateItem}
            />
          </div>

          {validationErrors && validationErrors.length > 0 && (
            <div
              style={{
                padding: "8px 12px",
                borderTop: "1px solid var(--op-border)",
                background: "var(--op-surface-bg)",
                maxHeight: 120,
                overflowY: "auto",
              }}
            >
              {validationErrors.map((err, i) => (
                <div key={i} style={{ fontSize: 11, color: "var(--op-danger)", padding: "2px 0" }}>
                  • {err}
                </div>
              ))}
            </div>
          )}

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
              padding: "8px 12px",
              borderTop: "1px solid var(--op-border)",
              background: "var(--op-surface-bg)",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={onValidate}
                className={orderOptimizationStyles.commandButton}
                style={{ height: 28, width: 250, fontSize: 11 }}
              >
                Doğrula
              </button>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <button
                type="button"
                onClick={onSave}
                disabled={isSaving || isOptimizing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  height: 28,
                  width: 250,
                  padding: "0 16px",
                  border: "1px solid var(--op-accent)",
                  background: "var(--op-accent)",
                  color: "#FFFFFF",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: isSaving ? "not-allowed" : "pointer",
                  opacity: isSaving ? 0.6 : 1,
                }}
              >
                {isSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              <button
                type="button"
                onClick={onOptimize}
                disabled={isSaving || isOptimizing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  height: 28,
                  width: 250,
                  padding: "0 16px",
                  border: "1px solid var(--op-accent)",
                  background: "transparent",
                  color: "var(--op-accent)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: isOptimizing ? "not-allowed" : "pointer",
                  opacity: isOptimizing ? 0.6 : 1,
                }}
              >
                {isOptimizing ? "Gönderiliyor..." : "Optimizasyona Gönder"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

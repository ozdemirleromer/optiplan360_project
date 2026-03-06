import { useEffect, useRef } from "react";
import { Download, FileSpreadsheet, FileUp, Phone, Printer, Trash2, CheckCircle, X, AlertTriangle, Plus } from "lucide-react";
import { OrderOptimizationGrid } from "./OrderOptimizationGrid";
import type { OrderOptimizationRibbonTab } from "./OrderOptimizationRibbon";
import type { MeasureRow } from "../OrderEditor/shared";
import { ORDER_OPTIMIZATION_THEME, orderOptimizationStyles, type OrderOptimizationThemeMode } from "./orderOptimizationStyles";
import "../../../styles/optiplan-order-entry.css";
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
  plateEn: _plateEn,
  material: _material,
  thickness: _thickness,
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
  onPlateBoyChange: _onPlateBoyChange,
  onPlateEnChange: _onPlateEnChange,
  onPlateBoyBlur: _onPlateBoyBlur,
  onPlateEnBlur: _onPlateEnBlur,
  onMaterialChange: _onMaterialChange,
  onThicknessChange: _onThicknessChange,
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
  onDownloadTemplate: _onDownloadTemplate,
  onDelete,
}: OrderOptimizationPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const customerInputRef = useRef<HTMLInputElement>(null);
  const firstGridCellRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === "cari") {
      customerInputRef.current?.focus();
    }

    if (activeTab === "siparis") {
      firstGridCellRef.current?.focus();
    }
  }, [activeTab]);

  return (
    <div
      ref={panelRef}
      style={{
        ...(ORDER_OPTIMIZATION_THEME[themeMode] as React.CSSProperties),
        background: "var(--op-main-bg)",
        color: "var(--op-text)",
        fontFamily: '"Inter", system-ui, sans-serif',
        fontSize: "13px",
        minHeight: "100%",
        display: "flex",
        flexDirection: "column",
        width: "100%"
      }}
    >
      {/* ── HEADER STRIP ──────────────────────────────────────────────── */}
      <div className="oe-header-bar">
        {/* Left — sipariş meta */}
        <div className="oe-header-left">
          {/* Brand badge */}
          <div className="oe-badge">YENİ SİPARİŞ</div>

          <div className="oe-separator" />

          <div className="oe-meta-block">
            <span className="oe-meta-label">SİPARİŞ NO</span>
            <span className="oe-meta-value">{orderNo || "YENİ"}</span>
          </div>

          <div className="oe-separator" />

          <div className="oe-meta-block">
            <span className="oe-meta-label">TERMİN</span>
            <input
              type="date"
              value={dueDate}
              onChange={e => onDueDateChange(e.target.value)}
              style={{
                background: "transparent", border: "none",
                color: "var(--op-text)", outline: "none", cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: "14px", fontWeight: 700, lineHeight: 1.2, padding: 0,
              }}
            />
          </div>

          <div className="oe-separator" />

          <div className="oe-meta-block">
            <span className="oe-meta-label">DURUM</span>
            <span className={orderOptimizationStyles.statusPill}>{orderStatus}</span>
          </div>
        </div>

        {/* Right — actions */}
        <div className="oe-header-right">
          <button type="button" onClick={onValidate} className="oe-btn">
            <CheckCircle size={13} /> Doğrula
          </button>
          <button
            type="button"
            onClick={onClose}
            className="oe-btn oe-btn-danger"
          >
            <X size={13} /> Kapat
          </button>

          <div className="oe-separator" />

          <button
            type="button"
            onClick={() => void onSave()}
            disabled={isSaving}
            className="oe-btn oe-btn-primary"
            style={{ opacity: isSaving ? 0.6 : 1, cursor: isSaving ? "not-allowed" : "pointer", padding: "0 24px" }}
          >
            {isSaving ? "Kaydediliyor..." : "Kaydet"}
          </button>
        </div>
      </div>

      {/* ── VALIDATION ERRORS ────────────────────────────────────────── */}
      {validationErrors && validationErrors.length > 0 && (
        <div className={orderOptimizationStyles.messageStack}>
          {validationErrors.map((err, i) => (
            <div key={i} className={`${orderOptimizationStyles.messageBar} ${orderOptimizationStyles.messageDanger}`}>
              <AlertTriangle size={11} style={{ display: "inline", marginRight: 5 }} /> {err}
            </div>
          ))}
        </div>
      )}

      {/* ── MESSAGES ──────────────────────────────────────────────────── */}
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
              <option value="low" style={{ color: "#e0e4ea", backgroundColor: "#1e1e1e" }}>Düşük</option>
              <option value="normal" style={{ color: "#e0e4ea", backgroundColor: "#1e1e1e" }}>Normal</option>
              <option value="high" style={{ color: "#e0e4ea", backgroundColor: "#1e1e1e" }}>Yüksek</option>
              <option value="urgent" style={{ color: "#e0e4ea", backgroundColor: "#1e1e1e" }}>Acil</option>
            </select>
          </label>
        </section>

        <section className={orderOptimizationStyles.detailCard}>
          <div className={orderOptimizationStyles.detailCardTitle}>Müşteri ve İletişim</div>
          <label className={orderOptimizationStyles.detailField}>
            <span className={orderOptimizationStyles.detailLabel}>Cari Arama (Firma | Tel)</span>
            <input
              ref={customerInputRef}
              list="order-optimization-customers"
              value={customerValue}
              onChange={(event) => onCustomerChange(event.target.value)}
              className={orderOptimizationStyles.input}
              placeholder="Firma Adı | 5XXXXXXXXX"
            />
            <datalist id="order-optimization-customers">
              {customerSuggestions.map((suggestion) => (
                <option key={suggestion} value={suggestion} />
              ))}
            </datalist>
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <label className={orderOptimizationStyles.detailField}>
              <span className={orderOptimizationStyles.detailLabel}>Müşteri Adı</span>
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
                  className={`${orderOptimizationStyles.input} border-0 bg-transparent px-0 w-full`}
                  placeholder="+90 5xx"
                />
              </div>
            </label>
          </div>
        </section>

        <section className={orderOptimizationStyles.detailCard}>
          <div className={orderOptimizationStyles.detailCardTitle}>Sipariş Özeti</div>
          <div className={orderOptimizationStyles.metricGrid}>
            <div className={orderOptimizationStyles.metricItem}>
              <span className={orderOptimizationStyles.detailLabel}>Parça</span>
              <strong className={orderOptimizationStyles.metricValue}>{totalParts}</strong>
            </div>
            <div className={orderOptimizationStyles.metricItem}>
              <span className={orderOptimizationStyles.detailLabel}>Alan</span>
              <strong className={orderOptimizationStyles.metricValue}>{estimatedArea} m²</strong>
            </div>
            <div className={orderOptimizationStyles.metricItem}>
              <span className={orderOptimizationStyles.detailLabel}>Hata</span>
              <strong className={orderOptimizationStyles.metricValue} style={{ color: validationErrors && validationErrors.length > 0 ? "var(--op-danger)" : "inherit" }}>
                {validationErrors && validationErrors.length > 0 ? validationErrors.length : "—"}
              </strong>
            </div>
          </div>
          <div className={orderOptimizationStyles.noticeLine} style={{ marginTop: 6 }}>
            <span className={orderOptimizationStyles.detailLabel}>Operasyon Notu</span>
            <span>{notice?.text || "Hazır"}</span>
          </div>
        </section>

        <section className={orderOptimizationStyles.detailCard} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className={orderOptimizationStyles.detailCardTitle}>Dosya ve Çıktı</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, flex: 1 }}>
            <button type="button" className="oe-file-btn" onClick={onOpenImport}>
              <FileUp size={14} className="mb-1" />
              İçe Aktar
            </button>
            <button type="button" className="oe-file-btn" onClick={onExportExcel}>
              <FileSpreadsheet size={14} className="mb-1" />
              Excel
            </button>
            <button type="button" className="oe-file-btn" onClick={onExportCsv}>
              <Download size={14} className="mb-1" />
              CSV
            </button>
            <button type="button" className="oe-file-btn" onClick={onPrint}>
              <Printer size={14} className="mb-1" />
              Yazdır
            </button>
          </div>
          {canDelete && onDelete ? (
            <button
              type="button"
              className={`${orderOptimizationStyles.fileActionButton} ${orderOptimizationStyles.fileActionDanger} w-full`}
              onClick={onDelete}
              disabled={isDeleting}
              style={{ height: 30, fontSize: 13, gap: 4, padding: 0 }}
            >
              <Trash2 size={14} />
              {isDeleting ? "Siliniyor..." : "Sil"}
            </button>
          ) : null}
          <button
            type="button"
            className="oe-optim-btn"
            onClick={onOptimize}
            disabled={isOptimizing}
          >
            {isOptimizing ? "BEKLEYİN..." : "OPTİMİZASYON"}
          </button>
        </section>
      </div>

      {/* ── TABLE ────────────────────────────────────────────────────── */}
      <div style={{ margin: "0", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
        {/* Table Toolbar */}
        <div className="oe-table-toolbar">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="oe-table-title">Sipariş Satırları</span>
            <span className="oe-table-subtitle">{items.length} kayıt var</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button type="button" onClick={onAddItem} className="oe-btn" style={{ padding: "0 12px" }}>
              <Plus size={13} style={{ marginRight: 4 }} /> Satır Ekle
            </button>
          </div>
        </div>

        <div className={orderOptimizationStyles.workspaceContent} style={{ flex: 1 }}>
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
      </div>
    </div>
  );
}

import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Z_INDEX } from "../../components/Shared/constants";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { crmService } from "../../services/crmService";
import type { CRMAccount, CRMQuote } from "../../services/crmService";
import { integrationService } from "../../services/integrationService";
import type {
  EntityMap,
  IntegrationAudit,
  IntegrationError,
  OutboxItem,
} from "../../services/integrationService";

const QUOTE_STATUSES = ["DRAFT", "SENT", "ACCEPTED", "REJECTED", "REVISED", "EXPIRED"] as const;

type QuoteSortKey = "quoteNumber" | "accountName" | "status" | "total" | "validUntil" | "updatedAt";
type SortDirection = "asc" | "desc";

interface SortState {
  key: QuoteSortKey;
  direction: SortDirection;
}

interface LineForm {
  id: string;
  productCode: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: "" | "10" | "20";
}

const s: Record<string, CSSProperties> = {
  // Enhanced color system
  page: { 
    display: "flex", 
    flexDirection: "column", 
    minHeight: "100vh", 
    background: "linear-gradient(135deg, #f8f6f3 0%, #f1ece4 50%, #e9e2d8 100%)", 
    color: "#2d231d",
    position: "relative"
  },
  header: { 
    padding: "24px 32px 20px", 
    borderBottom: "1px solid rgba(218, 203, 185, 0.6)", 
    background: "linear-gradient(135deg, #fff9f0 0%, #f7efe5 30%, #eadcca 100%)",
    backdropFilter: "blur(20px)",
    boxShadow: "0 4px 20px rgba(0, 0, 0, 0.08)"
  },
  title: { 
    margin: 0, 
    fontSize: "28px", 
    fontWeight: 900, 
    letterSpacing: "-0.02em",
    background: "linear-gradient(135deg, #2d231d 0%, #5d4635 100%)",
    WebkitBackgroundClip: "text",
    WebkitTextFillColor: "transparent",
    backgroundClip: "text"
  },
  subtitle: { 
    marginTop: 8, 
    fontSize: "14px", 
    color: "#755f4f",
    fontWeight: 500,
    letterSpacing: "0.01em"
  },
  body: { 
    flex: 1, 
    display: "grid", 
    gridTemplateColumns: "440px minmax(0, 1fr)", 
    minHeight: 0,
    gap: "1px",
    background: "rgba(218, 203, 185, 0.3)"
  },
  bodyMobile: { 
    flex: 1, 
    display: "grid", 
    gridTemplateColumns: "1fr", 
    minHeight: 0,
    gap: "1px",
    background: "rgba(218, 203, 185, 0.3)"
  },
  leftPanel: { 
    display: "flex", 
    flexDirection: "column", 
    minHeight: 0, 
    borderRight: "none", 
    background: "linear-gradient(135deg, #faf8f5 0%, #f8f4ee 100%)",
    backdropFilter: "blur(10px)"
  },
  leftPanelMobile: { 
    display: "flex", 
    flexDirection: "column", 
    minHeight: 0, 
    borderBottom: "1px solid rgba(218, 203, 185, 0.6)", 
    background: "linear-gradient(135deg, #faf8f5 0%, #f8f4ee 100%)",
    backdropFilter: "blur(10px)"
  },
  toolbar: { 
    display: "flex", 
    gap: 10, 
    alignItems: "center", 
    padding: 18, 
    borderBottom: "1px solid rgba(231, 219, 205, 0.8)",
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(10px)"
  },
  toolbarMobile: { 
    display: "flex", 
    gap: 8, 
    alignItems: "center", 
    padding: 14, 
    borderBottom: "1px solid rgba(231, 219, 205, 0.8)", 
    flexWrap: "wrap",
    background: "rgba(255, 255, 255, 0.7)",
    backdropFilter: "blur(10px)"
  },
  toolbarSpacer: { flex: 1 },
  
  // Enhanced button system
  btnPrimary: { 
    background: "linear-gradient(135deg, #8a4e30 0%, #6b3d24 50%, #5a3320 100%)", 
    color: "#fff", 
    border: "1px solid rgba(138, 78, 48, 0.3)",
    borderRadius: 12, 
    padding: "12px 20px", 
    fontSize: "14px", 
    fontWeight: 700, 
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    boxShadow: "0 4px 14px rgba(138, 78, 48, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)",
    transform: "translateY(0)",
    backdropFilter: "blur(10px)",
    position: "relative",
    overflow: "hidden"
  },
  btnPrimaryMobile: { 
    background: "linear-gradient(135deg, #8a4e30 0%, #6b3d24 50%, #5a3320 100%)", 
    color: "#fff", 
    border: "1px solid rgba(138, 78, 48, 0.3)",
    borderRadius: 10, 
    padding: "10px 16px", 
    fontSize: "13px", 
    fontWeight: 700, 
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    boxShadow: "0 4px 14px rgba(138, 78, 48, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)",
    transform: "translateY(0)",
    backdropFilter: "blur(10px)",
    flex: 1,
    minWidth: 0,
    position: "relative",
    overflow: "hidden"
  },
  btnSecondary: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    color: "#5d4635", 
    border: "1px solid rgba(205, 185, 163, 0.6)",
    borderRadius: 12, 
    padding: "11px 18px", 
    fontSize: "14px", 
    fontWeight: 600, 
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
    transform: "translateY(0)",
    backdropFilter: "blur(10px)",
    position: "relative",
    overflow: "hidden"
  },
  btnSecondaryMobile: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    color: "#5d4635", 
    border: "1px solid rgba(205, 185, 163, 0.6)",
    borderRadius: 10, 
    padding: "9px 14px", 
    fontSize: "13px", 
    fontWeight: 600, 
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
    transform: "translateY(0)",
    backdropFilter: "blur(10px)",
    flex: 1,
    minWidth: 0,
    position: "relative",
    overflow: "hidden"
  },
  
  // Enhanced typography and spacing
  filterNote: { 
    padding: "0 18px 14px", 
    fontSize: "13px", 
    color: "#7f6a59",
    fontWeight: 500,
    letterSpacing: "0.01em"
  },
  filterNoteMobile: { 
    padding: "0 14px 12px", 
    fontSize: "12px", 
    color: "#7f6a59",
    fontWeight: 500,
    letterSpacing: "0.01em"
  },
  relative: { position: "relative" },
  
  // Enhanced dropdown system
  optionsList: { 
    position: "absolute", 
    top: 48, 
    left: 0, 
    minWidth: 200, 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(217, 204, 185, 0.8)",
    borderRadius: 12, 
    boxShadow: "0 20px 40px rgba(79, 56, 38, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)", 
    zIndex: 20, 
    overflow: "hidden",
    animation: "slideDown 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(20px)"
  },
  optionsListMobile: { 
    position: "absolute", 
    top: 48, 
    left: 0, 
    minWidth: 160, 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(217, 204, 185, 0.8)",
    borderRadius: 10, 
    boxShadow: "0 20px 40px rgba(79, 56, 38, 0.15), 0 8px 16px rgba(0, 0, 0, 0.1)", 
    zIndex: 20, 
    overflow: "hidden",
    animation: "slideDown 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(20px)"
  },
  option: { 
    padding: "12px 16px", 
    cursor: "pointer", 
    fontSize: "14px", 
    color: "#4f3b30",
    fontWeight: 500,
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    borderBottom: "1px solid rgba(231, 219, 205, 0.5)"
  },
  optionMobile: { 
    padding: "10px 12px", 
    cursor: "pointer", 
    fontSize: "13px", 
    color: "#4f3b30",
    fontWeight: 500,
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    borderBottom: "1px solid rgba(231, 219, 205, 0.5)"
  },
  
  // Enhanced list system
  listWrap: { 
    padding: "0 12px 18px", 
    overflowY: "auto", 
    flex: 1,
    background: "rgba(255, 255, 255, 0.3)",
    backdropFilter: "blur(5px)"
  },
  listWrapMobile: { 
    padding: "0 10px 14px", 
    overflowY: "auto", 
    flex: 1,
    background: "rgba(255, 255, 255, 0.3)",
    backdropFilter: "blur(5px)"
  },
  listTable: { 
    width: "100%", 
    borderCollapse: "separate", 
    borderSpacing: "0 10px"
  },
  listTableMobile: { 
    width: "100%", 
    borderCollapse: "separate", 
    borderSpacing: "0 6px"
  },
  listHeadCell: { 
    fontSize: "12px", 
    fontWeight: 900, 
    color: "#8f7866", 
    textTransform: "uppercase", 
    padding: "0 10px 8px", 
    textAlign: "left", 
    whiteSpace: "nowrap",
    letterSpacing: "0.05em"
  },
  listHeadCellMobile: { 
    fontSize: "11px", 
    fontWeight: 900, 
    color: "#8f7866", 
    textTransform: "uppercase", 
    padding: "0 8px 6px", 
    textAlign: "left", 
    whiteSpace: "nowrap",
    letterSpacing: "0.05em"
  },
  sortButton: { 
    background: "transparent", 
    border: "none", 
    padding: 0, 
    cursor: "pointer", 
    color: "inherit", 
    font: "inherit", 
    display: "inline-flex", 
    alignItems: "center", 
    gap: 6,
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)"
  },
  
  // Enhanced row system
  listRow: { 
    background: "linear-gradient(135deg, #fffaf4 0%, #fff8f0 100%)", 
    cursor: "pointer", 
    boxShadow: "0 4px 16px rgba(98, 73, 53, 0.08), 0 2px 4px rgba(0, 0, 0, 0.04)",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    transform: "translateY(0)",
    border: "1px solid rgba(234, 223, 211, 0.8)",
    backdropFilter: "blur(10px)"
  },
  listRowMobile: { 
    background: "linear-gradient(135deg, #fffaf4 0%, #fff8f0 100%)", 
    cursor: "pointer", 
    boxShadow: "0 2px 8px rgba(98, 73, 53, 0.08), 0 1px 2px rgba(0, 0, 0, 0.04)",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    transform: "translateY(0)",
    border: "1px solid rgba(234, 223, 211, 0.8)",
    backdropFilter: "blur(10px)"
  },
  listRowActive: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    cursor: "pointer", 
    boxShadow: "0 12px 32px rgba(138, 78, 48, 0.18), 0 6px 12px rgba(0, 0, 0, 0.1)", 
    outline: "2px solid rgba(138, 78, 48, 0.4)",
    transform: "translateY(-2px)",
    border: "1px solid rgba(138, 78, 48, 0.3)",
    backdropFilter: "blur(15px)"
  },
  listRowActiveMobile: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    cursor: "pointer", 
    boxShadow: "0 8px 20px rgba(138, 78, 48, 0.18), 0 4px 8px rgba(0, 0, 0, 0.1)", 
    outline: "2px solid rgba(138, 78, 48, 0.4)",
    transform: "translateY(-1px)",
    border: "1px solid rgba(138, 78, 48, 0.3)",
    backdropFilter: "blur(15px)"
  },
  listCell: { 
    padding: "14px 10px", 
    fontSize: "13px", 
    color: "#4d3d33", 
    borderTop: "1px solid rgba(234, 223, 211, 0.6)", 
    borderBottom: "1px solid rgba(234, 223, 211, 0.6)",
    fontWeight: 500
  },
  listCellMobile: { 
    padding: "12px 8px", 
    fontSize: "12px", 
    color: "#4d3d33", 
    borderTop: "1px solid rgba(234, 223, 211, 0.6)", 
    borderBottom: "1px solid rgba(234, 223, 211, 0.6)",
    fontWeight: 500
  },
  listCellFirst: { 
    borderTopLeftRadius: 16, 
    borderBottomLeftRadius: 16, 
    borderLeft: "1px solid rgba(234, 223, 211, 0.6)" 
  },
  listCellFirstMobile: { 
    borderTopLeftRadius: 12, 
    borderBottomLeftRadius: 12, 
    borderLeft: "1px solid rgba(234, 223, 211, 0.6)" 
  },
  listCellLast: { 
    borderTopRightRadius: 16, 
    borderBottomRightRadius: 16, 
    borderRight: "1px solid rgba(234, 223, 211, 0.6)" 
  },
  listCellLastMobile: { 
    borderTopRightRadius: 12, 
    borderBottomRightRadius: 12, 
    borderRight: "1px solid rgba(234, 223, 211, 0.6)" 
  },
  rowPrimary: { 
    fontWeight: 700, 
    color: "#6b3c25",
    letterSpacing: "0.01em"
  },
  rowPrimaryMobile: { 
    fontWeight: 700, 
    color: "#6b3c25", 
    fontSize: "14px",
    letterSpacing: "0.01em"
  },
  rowMeta: { 
    marginTop: 5, 
    fontSize: "12px", 
    color: "#857160",
    fontWeight: 400
  },
  rowMetaMobile: { 
    marginTop: 4, 
    fontSize: "11px", 
    color: "#857160",
    fontWeight: 400
  },
  
  // Enhanced right panel
  rightPanel: { 
    padding: 28, 
    overflowY: "auto", 
    minWidth: 0,
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
    backdropFilter: "blur(10px)"
  },
  rightPanelMobile: { 
    padding: 20, 
    overflowY: "auto", 
    minWidth: 0,
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
    backdropFilter: "blur(10px)"
  },
  
  // Enhanced card system
  statusCard: { 
    background: "linear-gradient(135deg, #fffaf4 0%, #fff8f0 100%)", 
    border: "1px solid rgba(229, 217, 205, 0.8)", 
    borderRadius: 20, 
    padding: 20, 
    marginBottom: 20,
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    boxShadow: "0 6px 20px rgba(88, 64, 45, 0.1), 0 2px 6px rgba(0, 0, 0, 0.04)",
    backdropFilter: "blur(15px)"
  },
  statusCardMobile: { 
    background: "linear-gradient(135deg, #fffaf4 0%, #fff8f0 100%)", 
    border: "1px solid rgba(229, 217, 205, 0.8)", 
    borderRadius: 16, 
    padding: 16, 
    marginBottom: 16,
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    boxShadow: "0 4px 12px rgba(88, 64, 45, 0.1), 0 2px 4px rgba(0, 0, 0, 0.04)",
    backdropFilter: "blur(15px)"
  },
  statusTitle: { 
    margin: 0, 
    fontSize: "16px", 
    fontWeight: 800, 
    color: "#684229",
    letterSpacing: "0.01em"
  },
  statusTitleMobile: { 
    margin: 0, 
    fontSize: "15px", 
    fontWeight: 800, 
    color: "#684229",
    letterSpacing: "0.01em"
  },
  statusList: { 
    margin: "14px 0 0", 
    paddingLeft: 20, 
    fontSize: "14px", 
    color: "#725c4b",
    fontWeight: 500
  },
  statusListMobile: { 
    margin: "12px 0 0", 
    paddingLeft: 18, 
    fontSize: "13px", 
    color: "#725c4b",
    fontWeight: 500
  },
  topGrid: { 
    display: "grid", 
    gridTemplateColumns: "1.3fr 0.9fr", 
    gap: 20, 
    marginBottom: 20
  },
  topGridMobile: { 
    display: "grid", 
    gridTemplateColumns: "1fr", 
    gap: 16, 
    marginBottom: 16
  },
  card: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(225, 213, 200, 0.8)", 
    borderRadius: 20, 
    padding: 20, 
    boxShadow: "0 10px 30px rgba(88, 64, 45, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)",
    transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    transform: "translateY(0)",
    backdropFilter: "blur(20px)"
  },
  cardMobile: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(225, 213, 200, 0.8)", 
    borderRadius: 16, 
    padding: 16, 
    boxShadow: "0 6px 16px rgba(88, 64, 45, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06)",
    transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    transform: "translateY(0)",
    backdropFilter: "blur(20px)"
  },
  cardTitle: { 
    margin: 0, 
    fontSize: "16px", 
    fontWeight: 800, 
    color: "#5d3f2c",
    letterSpacing: "0.01em"
  },
  cardTitleMobile: { 
    margin: 0, 
    fontSize: "15px", 
    fontWeight: 800, 
    color: "#5d3f2c",
    letterSpacing: "0.01em"
  },
  cardSubtitle: { 
    marginTop: 6, 
    fontSize: "13px", 
    color: "#8a7460",
    fontWeight: 500
  },
  cardSubtitleMobile: { 
    marginTop: 5, 
    fontSize: "12px", 
    color: "#8a7460",
    fontWeight: 500
  },
  infoGrid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))", 
    gap: 14, 
    marginTop: 18
  },
  infoGridMobile: { 
    display: "grid", 
    gridTemplateColumns: "1fr", 
    gap: 10, 
    marginTop: 14
  },
  infoCell: { 
    padding: "12px 14px", 
    background: "linear-gradient(135deg, #faf6f1 0%, #f5f0e8 100%)", 
    borderRadius: 14, 
    border: "1px solid rgba(238, 227, 214, 0.8)",
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  infoCellMobile: { 
    padding: "10px 12px", 
    background: "linear-gradient(135deg, #faf6f1 0%, #f5f0e8 100%)", 
    borderRadius: 12, 
    border: "1px solid rgba(238, 227, 214, 0.8)",
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  infoLabel: { 
    fontSize: "11px", 
    textTransform: "uppercase", 
    fontWeight: 800, 
    color: "#927b67", 
    marginBottom: 6,
    letterSpacing: "0.05em"
  },
  infoLabelMobile: { 
    fontSize: "10px", 
    textTransform: "uppercase", 
    fontWeight: 800, 
    color: "#927b67", 
    marginBottom: 5,
    letterSpacing: "0.05em"
  },
  infoValue: { 
    fontSize: "15px", 
    color: "#433327", 
    fontWeight: 600,
    letterSpacing: "0.01em"
  },
  infoValueMobile: { 
    fontSize: "14px", 
    color: "#433327", 
    fontWeight: 600,
    letterSpacing: "0.01em"
  },
  
  // Enhanced totals system
  totalsStack: { 
    display: "grid", 
    gap: 12, 
    marginTop: 18
  },
  totalsStackMobile: { 
    display: "grid", 
    gap: 10, 
    marginTop: 14
  },
  totalRow: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    padding: "12px 14px", 
    background: "linear-gradient(135deg, #faf6f1 0%, #f5f0e8 100%)", 
    border: "1px solid rgba(238, 227, 214, 0.8)", 
    borderRadius: 14,
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  totalRowMobile: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    padding: "10px 12px", 
    background: "linear-gradient(135deg, #faf6f1 0%, #f5f0e8 100%)", 
    border: "1px solid rgba(238, 227, 214, 0.8)", 
    borderRadius: 12,
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  totalLabel: { 
    fontSize: "14px", 
    color: "#735d4b",
    fontWeight: 600
  },
  totalLabelMobile: { 
    fontSize: "13px", 
    color: "#735d4b",
    fontWeight: 600
  },
  totalValue: { 
    fontSize: "16px", 
    fontWeight: 700, 
    color: "#49382d",
    letterSpacing: "0.01em"
  },
  totalValueMobile: { 
    fontSize: "15px", 
    fontWeight: 700, 
    color: "#49382d",
    letterSpacing: "0.01em"
  },
  grandTotalRow: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    padding: "16px 20px", 
    background: "linear-gradient(135deg, #8a4e30 0%, #6b3d24 50%, #5a3320 100%)", 
    borderRadius: 16, 
    color: "#fff",
    boxShadow: "0 8px 24px rgba(138, 78, 48, 0.35), 0 4px 8px rgba(0, 0, 0, 0.15)",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.1)"
  },
  grandTotalRowMobile: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    padding: "14px 16px", 
    background: "linear-gradient(135deg, #8a4e30 0%, #6b3d24 50%, #5a3320 100%)", 
    borderRadius: 14, 
    color: "#fff",
    boxShadow: "0 6px 18px rgba(138, 78, 48, 0.35), 0 3px 6px rgba(0, 0, 0, 0.15)",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.1)"
  },
  grandTotalLabel: { 
    fontSize: "14px", 
    fontWeight: 700,
    letterSpacing: "0.01em"
  },
  grandTotalLabelMobile: { 
    fontSize: "13px", 
    fontWeight: 700,
    letterSpacing: "0.01em"
  },
  grandTotalValue: { 
    fontSize: "20px", 
    fontWeight: 900,
    letterSpacing: "0.01em"
  },
  grandTotalValueMobile: { 
    fontSize: "18px", 
    fontWeight: 900,
    letterSpacing: "0.01em"
  },
  
  // Enhanced section cards
  sectionCard: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(225, 213, 200, 0.8)", 
    borderRadius: 20, 
    padding: 20, 
    boxShadow: "0 10px 30px rgba(88, 64, 45, 0.12), 0 4px 8px rgba(0, 0, 0, 0.06)", 
    marginBottom: 20,
    transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    transform: "translateY(0)",
    backdropFilter: "blur(20px)"
  },
  sectionCardMobile: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(225, 213, 200, 0.8)", 
    borderRadius: 16, 
    padding: 16, 
    boxShadow: "0 6px 16px rgba(88, 64, 45, 0.12), 0 2px 4px rgba(0, 0, 0, 0.06)", 
    marginBottom: 16,
    transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    transform: "translateY(0)",
    backdropFilter: "blur(20px)"
  },
  tableWrap: { 
    overflowX: "auto", 
    marginTop: 18,
    background: "rgba(255, 255, 255, 0.5)",
    borderRadius: 12,
    padding: 4,
    backdropFilter: "blur(10px)"
  },
  tableWrapMobile: { 
    overflowX: "auto", 
    marginTop: 14,
    background: "rgba(255, 255, 255, 0.5)",
    borderRadius: 10,
    padding: 3,
    backdropFilter: "blur(10px)"
  },
  detailTable: { 
    width: "100%", 
    borderCollapse: "collapse", 
    fontSize: "14px"
  },
  detailTableMobile: { 
    width: "100%", 
    borderCollapse: "collapse", 
    fontSize: "13px"
  },
  detailHeadCell: { 
    textAlign: "left", 
    padding: "14px 12px", 
    fontSize: "12px", 
    fontWeight: 900, 
    color: "#8d7763", 
    textTransform: "uppercase", 
    borderBottom: "1px solid rgba(234, 223, 212, 0.8)", 
    whiteSpace: "nowrap",
    letterSpacing: "0.05em"
  },
  detailHeadCellMobile: { 
    textAlign: "left", 
    padding: "12px 10px", 
    fontSize: "11px", 
    fontWeight: 900, 
    color: "#8d7763", 
    textTransform: "uppercase", 
    borderBottom: "1px solid rgba(234, 223, 212, 0.8)", 
    whiteSpace: "nowrap",
    letterSpacing: "0.05em"
  },
  detailCell: { 
    padding: "16px 12px", 
    fontSize: "14px", 
    color: "#4b3a2f", 
    borderBottom: "1px solid rgba(241, 231, 220, 0.8)", 
    verticalAlign: "top",
    fontWeight: 500
  },
  detailCellMobile: { 
    padding: "14px 10px", 
    fontSize: "13px", 
    color: "#4b3a2f", 
    borderBottom: "1px solid rgba(241, 231, 220, 0.8)", 
    verticalAlign: "top",
    fontWeight: 500
  },
  stockName: { 
    fontWeight: 700, 
    color: "#603f2c",
    letterSpacing: "0.01em"
  },
  stockNameMobile: { 
    fontWeight: 700, 
    color: "#603f2c", 
    fontSize: "14px",
    letterSpacing: "0.01em"
  },
  stockMeta: { 
    marginTop: 5, 
    fontSize: "13px", 
    color: "#8b7664",
    fontWeight: 400
  },
  stockMetaMobile: { 
    marginTop: 4, 
    fontSize: "12px", 
    color: "#8b7664",
    fontWeight: 400
  },
  footerMeta: { 
    display: "grid", 
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))", 
    gap: 14, 
    marginTop: 18
  },
  footerMetaMobile: { 
    display: "grid", 
    gridTemplateColumns: "1fr", 
    gap: 10, 
    marginTop: 14
  },
  
  // Enhanced action system
  actions: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    gap: 14, 
    marginTop: 20, 
    flexWrap: "wrap"
  },
  actionsMobile: { 
    display: "flex", 
    flexDirection: "column", 
    gap: 10, 
    marginTop: 16, 
    flexWrap: "wrap"
  },
  actionGroup: { 
    display: "flex", 
    gap: 10, 
    flexWrap: "wrap"
  },
  actionGroupMobile: { 
    display: "flex", 
    gap: 8, 
    flexWrap: "wrap", 
    width: "100%"
  },
  convertBtn: { 
    background: "linear-gradient(135deg, #2d6a4f 0%, #1e4a35 50%, #163a28 100%)", 
    color: "#fff", 
    border: "1px solid rgba(45, 106, 79, 0.3)",
    borderRadius: 12, 
    padding: "12px 20px", 
    fontSize: "14px", 
    fontWeight: 700, 
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    boxShadow: "0 4px 14px rgba(45, 106, 79, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)",
    transform: "translateY(0)",
    backdropFilter: "blur(10px)",
    position: "relative",
    overflow: "hidden"
  },
  convertBtnMobile: { 
    background: "linear-gradient(135deg, #2d6a4f 0%, #1e4a35 50%, #163a28 100%)", 
    color: "#fff", 
    border: "1px solid rgba(45, 106, 79, 0.3)",
    borderRadius: 10, 
    padding: "12px 16px", 
    fontSize: "13px", 
    fontWeight: 700, 
    cursor: "pointer",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    boxShadow: "0 4px 14px rgba(45, 106, 79, 0.25), 0 2px 4px rgba(0, 0, 0, 0.1)",
    transform: "translateY(0)",
    backdropFilter: "blur(10px)",
    width: "100%",
    position: "relative",
    overflow: "hidden"
  },
  
  // Enhanced tech panel
  techPanel: { 
    marginTop: 16, 
    padding: 18, 
    background: "linear-gradient(135deg, #fffaf4 0%, #fff8f0 100%)", 
    borderRadius: 18, 
    border: "1px dashed rgba(213, 198, 180, 0.8)",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  techPanelMobile: { 
    marginTop: 14, 
    padding: 14, 
    background: "linear-gradient(135deg, #fffaf4 0%, #fff8f0 100%)", 
    borderRadius: 14, 
    border: "1px dashed rgba(213, 198, 180, 0.8)",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  badge: { 
    display: "inline-block", 
    padding: "5px 10px", 
    borderRadius: 999, 
    fontSize: "11px", 
    fontWeight: 800,
    letterSpacing: "0.02em"
  },
  badgeMobile: { 
    display: "inline-block", 
    padding: "4px 8px", 
    borderRadius: 999, 
    fontSize: "10px", 
    fontWeight: 800,
    letterSpacing: "0.02em"
  },
  errItem: { 
    marginTop: 12, 
    padding: 14, 
    background: "linear-gradient(135deg, #fff2ef 0%, #ffe8e4 100%)", 
    border: "1px solid rgba(240, 200, 191, 0.8)", 
    borderRadius: 14, 
    fontSize: "13px", 
    color: "#7d3125",
    animation: "shake 0.5s ease-in-out",
    backdropFilter: "blur(10px)"
  },
  errItemMobile: { 
    marginTop: 10, 
    padding: 12, 
    background: "linear-gradient(135deg, #fff2ef 0%, #ffe8e4 100%)", 
    border: "1px solid rgba(240, 200, 191, 0.8)", 
    borderRadius: 12, 
    fontSize: "12px", 
    color: "#7d3125",
    animation: "shake 0.5s ease-in-out",
    backdropFilter: "blur(10px)"
  },
  emptyState: { 
    padding: 48, 
    textAlign: "center", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px dashed rgba(220, 204, 192, 0.8)", 
    borderRadius: 20, 
    color: "#846e5d",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  emptyStateMobile: { 
    padding: 28, 
    textAlign: "center", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px dashed rgba(220, 204, 192, 0.8)", 
    borderRadius: 16, 
    color: "#846e5d",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  
  // Enhanced modal system
  overlay: { 
    position: "fixed", 
    inset: 0, 
    background: "rgba(33, 24, 18, 0.5)", 
    zIndex: Z_INDEX.overlay, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 24,
    backdropFilter: "blur(8px)"
  },
  overlayMobile: { 
    position: "fixed", 
    inset: 0, 
    background: "rgba(33, 24, 18, 0.5)", 
    zIndex: Z_INDEX.overlay, 
    display: "flex", 
    alignItems: "center", 
    justifyContent: "center", 
    padding: 16,
    backdropFilter: "blur(8px)"
  },
  dialog: { 
    width: 1100, 
    maxWidth: "100%", 
    maxHeight: "90vh", 
    overflowY: "auto", 
    background: "linear-gradient(135deg, #fffaf4 0%, #fff8f0 100%)", 
    borderRadius: 24, 
    padding: 28, 
    boxShadow: "0 40px 80px rgba(44, 26, 15, 0.35), 0 20px 40px rgba(0, 0, 0, 0.15)",
    animation: "scaleIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.2)"
  },
  dialogMobile: { 
    width: "95%", 
    maxWidth: "100%", 
    maxHeight: "95vh", 
    overflowY: "auto", 
    background: "linear-gradient(135deg, #fffaf4 0%, #fff8f0 100%)", 
    borderRadius: 20, 
    padding: 20, 
    boxShadow: "0 40px 80px rgba(44, 26, 15, 0.35), 0 20px 40px rgba(0, 0, 0, 0.15)",
    animation: "scaleIn 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.2)"
  },
  dialogTitle: { 
    margin: 0, 
    fontSize: "22px", 
    fontWeight: 900, 
    color: "#5b3b2a",
    letterSpacing: "0.01em"
  },
  dialogTitleMobile: { 
    margin: 0, 
    fontSize: "20px", 
    fontWeight: 900, 
    color: "#5b3b2a",
    letterSpacing: "0.01em"
  },
  
  // Enhanced create form
  createLayout: { 
    display: "grid", 
    gridTemplateColumns: "1.05fr 1.35fr", 
    gap: 20, 
    marginTop: 20
  },
  createLayoutMobile: { 
    display: "grid", 
    gridTemplateColumns: "1fr", 
    gap: 16, 
    marginTop: 16
  },
  createCard: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(229, 215, 202, 0.8)", 
    borderRadius: 18, 
    padding: 18,
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(15px)"
  },
  createCardMobile: { 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(229, 215, 202, 0.8)", 
    borderRadius: 14, 
    padding: 14,
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(15px)"
  },
  createCardTitle: { 
    margin: 0, 
    fontSize: "16px", 
    fontWeight: 800, 
    color: "#5d3f2c",
    letterSpacing: "0.01em"
  },
  createCardTitleMobile: { 
    margin: 0, 
    fontSize: "15px", 
    fontWeight: 800, 
    color: "#5d3f2c",
    letterSpacing: "0.01em"
  },
  createCardSub: { 
    marginTop: 6, 
    fontSize: "13px", 
    color: "#8a7460",
    fontWeight: 500
  },
  createCardSubMobile: { 
    marginTop: 5, 
    fontSize: "12px", 
    color: "#8a7460",
    fontWeight: 500
  },
  formGrid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))", 
    gap: 16
  },
  formGridMobile: { 
    display: "grid", 
    gridTemplateColumns: "1fr", 
    gap: 12
  },
  formGroup: { 
    marginBottom: 16
  },
  formGroupMobile: { 
    marginBottom: 12
  },
  formLabel: { 
    display: "block", 
    marginBottom: 8, 
    fontSize: "12px", 
    fontWeight: 800, 
    textTransform: "uppercase", 
    color: "#8d7764",
    letterSpacing: "0.05em"
  },
  formLabelMobile: { 
    display: "block", 
    marginBottom: 6, 
    fontSize: "11px", 
    fontWeight: 800, 
    textTransform: "uppercase", 
    color: "#8d7764",
    letterSpacing: "0.05em"
  },
  input: { 
    width: "100%", 
    boxSizing: "border-box", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(215, 198, 178, 0.8)", 
    borderRadius: 14, 
    padding: "12px 14px", 
    color: "#3f2f24", 
    fontSize: "15px",
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  inputMobile: { 
    width: "100%", 
    boxSizing: "border-box", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(215, 198, 178, 0.8)", 
    borderRadius: 12, 
    padding: "10px 12px", 
    color: "#3f2f24", 
    fontSize: "14px",
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  selectBtn: { 
    width: "100%", 
    textAlign: "left", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(215, 198, 178, 0.8)", 
    borderRadius: 14, 
    padding: "12px 14px", 
    color: "#3f2f24", 
    fontSize: "15px", 
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  selectBtnMobile: { 
    width: "100%", 
    textAlign: "left", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(215, 198, 178, 0.8)", 
    borderRadius: 12, 
    padding: "10px 12px", 
    color: "#3f2f24", 
    fontSize: "14px", 
    cursor: "pointer",
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  hintWarn: { 
    marginTop: 8, 
    fontSize: "13px", 
    color: "#9b662c",
    fontWeight: 500
  },
  hintWarnMobile: { 
    marginTop: 6, 
    fontSize: "12px", 
    color: "#9b662c",
    fontWeight: 500
  },
  validationErr: { 
    marginTop: 14, 
    fontSize: "14px", 
    color: "#a33d2f",
    fontWeight: 600
  },
  validationErrMobile: { 
    marginTop: 10, 
    fontSize: "13px", 
    color: "#a33d2f",
    fontWeight: 600
  },
  wizardActions: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    gap: 14, 
    marginTop: 18
  },
  wizardActionsMobile: { 
    display: "flex", 
    flexDirection: "column", 
    gap: 10, 
    marginTop: 14
  },
  
  // Enhanced line system
  linesHeader: { 
    display: "flex", 
    justifyContent: "space-between", 
    alignItems: "center", 
    gap: 14, 
    marginBottom: 14
  },
  linesHeaderMobile: { 
    display: "flex", 
    flexDirection: "column", 
    gap: 10, 
    marginBottom: 12
  },
  lineTableWrap: { 
    marginTop: 14, 
    border: "1px solid rgba(234, 222, 209, 0.8)", 
    borderRadius: 14, 
    overflow: "hidden", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(15px)"
  },
  lineTableWrapMobile: { 
    marginTop: 12, 
    border: "1px solid rgba(234, 222, 209, 0.8)", 
    borderRadius: 12, 
    overflow: "hidden", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)",
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(15px)"
  },
  lineTable: { 
    width: "100%", 
    borderCollapse: "collapse"
  },
  lineHeadCell: { 
    textAlign: "left", 
    padding: "12px 10px", 
    fontSize: "12px", 
    textTransform: "uppercase", 
    color: "#8f7763", 
    background: "linear-gradient(135deg, #faf5ef 0%, #f5f0e8 100%)", 
    borderBottom: "1px solid rgba(234, 222, 209, 0.8)",
    fontWeight: 800,
    letterSpacing: "0.05em"
  },
  lineHeadCellMobile: { 
    textAlign: "left", 
    padding: "10px 8px", 
    fontSize: "11px", 
    textTransform: "uppercase", 
    color: "#8f7763", 
    background: "linear-gradient(135deg, #faf5ef 0%, #f5f0e8 100%)", 
    borderBottom: "1px solid rgba(234, 222, 209, 0.8)",
    fontWeight: 800,
    letterSpacing: "0.05em"
  },
  lineCell: { 
    padding: "12px 10px", 
    borderBottom: "1px solid rgba(243, 233, 221, 0.8)", 
    verticalAlign: "middle"
  },
  lineCellMobile: { 
    padding: "10px 8px", 
    borderBottom: "1px solid rgba(243, 233, 221, 0.8)", 
    verticalAlign: "middle"
  },
  inputCompact: { 
    width: "100%", 
    boxSizing: "border-box", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(215, 198, 178, 0.8)", 
    borderRadius: 12, 
    padding: "10px 12px", 
    color: "#3f2f24", 
    fontSize: "14px",
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  inputCompactMobile: { 
    width: "100%", 
    boxSizing: "border-box", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    border: "1px solid rgba(215, 198, 178, 0.8)", 
    borderRadius: 10, 
    padding: "8px 10px", 
    color: "#3f2f24", 
    fontSize: "13px",
    transition: "all 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(10px)"
  },
  createTotals: { 
    marginTop: 20, 
    display: "grid", 
    gap: 10
  },
  createTotalsMobile: { 
    marginTop: 16, 
    display: "grid", 
    gap: 8
  },
  
  // Enhanced preview system
  previewSheetWrap: { 
    marginTop: 20, 
    background: "linear-gradient(135deg, #efe7dd 0%, #e8ddd0 100%)", 
    borderRadius: 20, 
    padding: 20,
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(15px)"
  },
  previewSheetWrapMobile: { 
    marginTop: 16, 
    background: "linear-gradient(135deg, #efe7dd 0%, #e8ddd0 100%)", 
    borderRadius: 16, 
    padding: 16,
    transition: "all 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(15px)"
  },
  previewSheet: { 
    width: 860, 
    maxWidth: "100%", 
    margin: "0 auto", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    color: "#1f1b17", 
    borderRadius: 12, 
    padding: "32px 36px", 
    boxShadow: "0 30px 60px rgba(40, 26, 17, 0.2), 0 15px 30px rgba(0, 0, 0, 0.1)",
    transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.3)"
  },
  previewSheetMobile: { 
    width: "100%", 
    margin: "0 auto", 
    background: "linear-gradient(135deg, #ffffff 0%, #fafafa 100%)", 
    color: "#1f1b17", 
    borderRadius: 12, 
    padding: "20px 24px", 
    boxShadow: "0 30px 60px rgba(40, 26, 17, 0.2), 0 15px 30px rgba(0, 0, 0, 0.1)",
    transition: "all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    backdropFilter: "blur(20px)",
    border: "1px solid rgba(255, 255, 255, 0.3)"
  },
  previewHeader: { 
    display: "flex", 
    justifyContent: "space-between", 
    gap: 28, 
    borderBottom: "2px solid #3e3026", 
    paddingBottom: 18, 
    marginBottom: 20
  },
  previewHeaderMobile: { 
    display: "flex", 
    flexDirection: "column", 
    gap: 14, 
    borderBottom: "2px solid #3e3026", 
    paddingBottom: 14, 
    marginBottom: 16
  },
  previewTitle: { 
    margin: 0, 
    fontSize: "24px", 
    fontWeight: 900,
    letterSpacing: "0.01em"
  },
  previewTitleMobile: { 
    margin: 0, 
    fontSize: "20px", 
    fontWeight: 900,
    letterSpacing: "0.01em"
  },
  previewBlockTitle: { 
    fontSize: "12px", 
    fontWeight: 800, 
    textTransform: "uppercase", 
    color: "#6c5948", 
    marginBottom: 10,
    letterSpacing: "0.05em"
  },
  previewBlockTitleMobile: { 
    fontSize: "11px", 
    fontWeight: 800, 
    textTransform: "uppercase", 
    color: "#6c5948", 
    marginBottom: 8,
    letterSpacing: "0.05em"
  },
  previewMetaGrid: { 
    display: "grid", 
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))", 
    gap: 18, 
    marginBottom: 20
  },
  previewMetaGridMobile: { 
    display: "grid", 
    gridTemplateColumns: "1fr", 
    gap: 14, 
    marginBottom: 16
  },
  previewTable: { 
    width: "100%", 
    borderCollapse: "collapse", 
    fontSize: "13px", 
    marginBottom: 20
  },
  previewTableMobile: { 
    width: "100%", 
    borderCollapse: "collapse", 
    fontSize: "12px", 
    marginBottom: 16
  },
  previewHeadCell: { 
    textAlign: "left", 
    padding: "10px 8px", 
    borderBottom: "1px solid #3d2d21", 
    fontSize: "12px", 
    textTransform: "uppercase",
    fontWeight: 800,
    letterSpacing: "0.05em"
  },
  previewHeadCellMobile: { 
    textAlign: "left", 
    padding: "8px 6px", 
    borderBottom: "1px solid #3d2d21", 
    fontSize: "11px", 
    textTransform: "uppercase",
    fontWeight: 800,
    letterSpacing: "0.05em"
  },
  previewCell: { 
    padding: "10px 8px", 
    borderBottom: "1px solid #ddd2c7",
    fontWeight: 500
  },
  previewCellMobile: { 
    padding: "8px 6px", 
    borderBottom: "1px solid #ddd2c7",
    fontWeight: 500
  },
  previewTotals: { 
    marginLeft: "auto", 
    width: 300, 
    display: "grid", 
    gap: 10
  },
  previewTotalsMobile: { 
    marginLeft: "auto", 
    width: "100%", 
    display: "grid", 
    gap: 8
  },
  previewTotalRow: { 
    display: "flex", 
    justifyContent: "space-between", 
    padding: "10px 12px", 
    background: "linear-gradient(135deg, #f5eee6 0%, #f0e8da 100%)", 
    borderRadius: 8,
    backdropFilter: "blur(10px)"
  },
  previewTotalRowMobile: { 
    display: "flex", 
    justifyContent: "space-between", 
    padding: "8px 10px", 
    background: "linear-gradient(135deg, #f5eee6 0%, #f0e8da 100%)", 
    borderRadius: 8,
    backdropFilter: "blur(10px)"
  },
  previewGrandRow: { 
    display: "flex", 
    justifyContent: "space-between", 
    padding: "12px 14px", 
    background: "linear-gradient(135deg, #3f3026 0%, #2d231d 100%)", 
    color: "#fff", 
    borderRadius: 8, 
    fontWeight: 800,
    backdropFilter: "blur(10px)"
  },
  previewGrandRowMobile: { 
    display: "flex", 
    justifyContent: "space-between", 
    padding: "10px 12px", 
    background: "linear-gradient(135deg, #3f3026 0%, #2d231d 100%)", 
    color: "#fff", 
    borderRadius: 8, 
    fontWeight: 800,
    backdropFilter: "blur(10px)"
  },
  previewFooter: { 
    marginTop: 28, 
    paddingTop: 18, 
    borderTop: "1px solid #d7c9bb", 
    fontSize: "13px", 
    color: "#655346",
    fontWeight: 500
  },
  previewFooterMobile: { 
    marginTop: 20, 
    paddingTop: 14, 
    borderTop: "1px solid #d7c9bb", 
    fontSize: "12px", 
    color: "#655346",
    fontWeight: 500
  },
};

function createEmptyLine(): LineForm {
  return {
    id: `line-${Math.random().toString(36).slice(2, 10)}`,
    productCode: "",
    description: "",
    quantity: "1",
    unitPrice: "0",
    taxRate: "",
  };
}

function generateDocumentNumber(): string {
  const year = new Date().getFullYear();
  const serial = String(Date.now() % 1_000_000).padStart(6, "0");
  return `TF-${year}-${serial}`;
}

function formatMoney(value: number | undefined, currency = "TRY"): string {
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? Number(value) : 0);
}

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("tr-TR");
}

function getStockCode(line: NonNullable<CRMQuote["lines"]>[number]): string {
  return line.productCode || line.mikroStokKod || "-";
}

function getLineAmount(line: NonNullable<CRMQuote["lines"]>[number]): number {
  if (typeof line.lineTotal === "number") return line.lineTotal;
  const quantity = Number(line.quantity ?? 0);
  const unitPrice = Number(line.unitPrice ?? 0);
  const lineNet = quantity * unitPrice;
  const taxRate = Number(line.taxRate ?? 0);
  const lineTax = lineNet * (taxRate / 100);
  return lineNet + lineTax;
}

function getCreateLineNet(line: LineForm): number {
  const quantity = Number(line.quantity || 0);
  const unitPrice = Number(line.unitPrice || 0);
  return quantity * unitPrice;
}

function getCreateLineTax(line: LineForm): number {
  const lineNet = getCreateLineNet(line);
  const taxRate = Number(line.taxRate || 0);
  return lineNet * (taxRate / 100);
}

function getCreateLineAmount(line: LineForm): number {
  return getCreateLineNet(line) + getCreateLineTax(line);
}

function canConvertQuote(status: string): boolean {
  return status === "DRAFT" || status === "SENT" || status === "REVISED";
}

function getSortValue(quote: CRMQuote, key: QuoteSortKey): string | number {
  switch (key) {
    case "quoteNumber":
      return quote.quoteNumber || "";
    case "accountName":
      return quote.accountName || "";
    case "status":
      return quote.status || "";
    case "total":
      return Number(quote.total || 0);
    case "validUntil":
      return quote.validUntil ? new Date(quote.validUntil).getTime() : 0;
    case "updatedAt":
      return quote.updatedAt ? new Date(quote.updatedAt).getTime() : 0;
    default:
      return "";
  }
}

function sortQuotes(quotes: CRMQuote[], sortState: SortState): CRMQuote[] {
  return [...quotes].sort((left, right) => {
    const leftValue = getSortValue(left, sortState.key);
    const rightValue = getSortValue(right, sortState.key);

    if (typeof leftValue === "number" && typeof rightValue === "number") {
      return sortState.direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
    }

    const compare = String(leftValue).localeCompare(String(rightValue), "tr", { sensitivity: "base" });
    return sortState.direction === "asc" ? compare : -compare;
  });
}

function SkeletonLoading({ isMobile = false }: { isMobile?: boolean }) {
  const skeletonStyles = {
    container: {
      ...s.card,
      ...s[isMobile ? 'cardMobile' : 'card'],
      padding: 0,
      overflow: 'hidden'
    },
    row: {
      display: 'flex',
      padding: isMobile ? '12px' : '16px',
      borderBottom: '1px solid #f1e7dc',
      gap: isMobile ? '8px' : '12px',
      alignItems: 'center'
    },
    skeleton: {
      background: 'linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%)',
      backgroundSize: '200% 100%',
      animation: 'loading 1.5s infinite',
      borderRadius: '4px'
    },
    text: {
      height: isMobile ? '12px' : '14px',
      width: '60%',
      ...{ animationDelay: '0.1s' }
    },
    number: {
      height: isMobile ? '12px' : '14px',
      width: '40px',
      ...{ animationDelay: '0.2s' }
    },
    status: {
      height: isMobile ? '20px' : '24px',
      width: isMobile ? '60px' : '80px',
      borderRadius: '12px',
      ...{ animationDelay: '0.3s' }
    },
    date: {
      height: isMobile ? '10px' : '12px',
      width: '80px',
      ...{ animationDelay: '0.4s' }
    }
  };

  return (
    <div style={skeletonStyles.container}>
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} style={skeletonStyles.row}>
          <div style={{ ...skeletonStyles.skeleton, ...skeletonStyles.text }} />
          <div style={{ ...skeletonStyles.skeleton, ...skeletonStyles.number }} />
          <div style={{ ...skeletonStyles.skeleton, ...skeletonStyles.status }} />
          <div style={{ ...skeletonStyles.skeleton, ...skeletonStyles.date }} />
        </div>
      ))}
      <style jsx>{`
        @keyframes loading {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

function LoadingSpinner({ size = 20 }: { size?: number }) {
  return (
    <div style={{
      width: size,
      height: size,
      border: '2px solid #f3f3f3',
      borderTop: `2px solid #8a4e30`,
      borderRadius: '50%',
      animation: 'spin 1s linear infinite'
    }}>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function Warnings({ detail, accounts }: { detail: CRMQuote; accounts: CRMAccount[] }) {
  const warnings: string[] = [];
  const account = accounts.find((item) => item.id === detail.accountId);
  if (!detail.validUntil) warnings.push("Geçerlilik tarihi eksik.");
  if (!detail.lines?.length) warnings.push("Satır bilgisi girilmemiş.");
  if (!account?.mikroCariKod) warnings.push("Müşteri cari eşlemesi eksik.");

  // Card hover handlers
  const handleCardHover = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = 'translateY(-4px)';
    card.style.boxShadow = '0 20px 40px rgba(88, 64, 45, 0.15)';
    card.style.borderColor = 'rgba(138, 78, 48, 0.3)';
  };

  const handleCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    const card = e.currentTarget;
    card.style.transform = 'translateY(0)';
    card.style.boxShadow = '0 8px 22px rgba(88, 64, 45, 0.06)';
    card.style.borderColor = '#e1d5c8';
  };

  // Row hover handlers
  const handleRowHover = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const row = e.currentTarget;
    row.style.transform = 'translateY(-1px)';
    row.style.boxShadow = '0 8px 20px rgba(98, 73, 53, 0.1)';
    row.style.backgroundColor = '#ffffff';
  };

  const handleRowLeave = (e: React.MouseEvent<HTMLTableRowElement>) => {
    const row = e.currentTarget;
    row.style.transform = 'translateY(0)';
    row.style.boxShadow = '0 4px 12px rgba(98, 73, 53, 0.05)';
    row.style.backgroundColor = '#fffaf4';
  };

  // Button hover handlers
  const handleButtonHover = (e: React.MouseEvent<HTMLButtonElement>, isPrimary: boolean = false) => {
    const button = e.currentTarget;
    if (isPrimary) {
      button.style.transform = 'translateY(-2px)';
      button.style.boxShadow = '0 6px 16px rgba(138, 78, 48, 0.3)';
    } else {
      button.style.transform = 'translateY(-1px)';
      button.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
    }
  };

  const handleButtonLeave = (e: React.MouseEvent<HTMLButtonElement>, isPrimary: boolean = false) => {
    const button = e.currentTarget;
    button.style.transform = 'translateY(0)';
    if (isPrimary) {
      button.style.boxShadow = '0 2px 4px rgba(138, 78, 48, 0.2)';
    } else {
      button.style.boxShadow = '0 1px 3px rgba(0, 0, 0, 0.1)';
    }
  };

  if (warnings.length === 0) return null;

  return (
    <div style={s.statusCard}>
      <h3 style={s.statusTitle}>İşlem Durumu</h3>
      <ul style={s.statusList}>
        {warnings.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

function PrintablePreview({ quote }: { quote: CRMQuote }) {
  const currency = quote.currency || "TRY";

  return (
    <div style={s.previewSheetWrap}>
      <div style={s.previewSheet}>
        <div style={s.previewHeader}>
          <div>
            <h2 style={s.previewTitle}>Teklif Fişi</h2>
            <div style={{ marginTop: 6, fontSize: "12px", color: "#655346" }}>
              Mikro düzenine yakın baskı önizleme yüzeyi
            </div>
          </div>
          <div>
            <div style={s.previewBlockTitle}>Belge Bilgisi</div>
            <div>Belge Numarası: {quote.quoteNumber}</div>
            <div>Durum: {quote.status}</div>
            <div>Tarih: {formatDate(quote.updatedAt)}</div>
          </div>
        </div>

        <div style={s.previewMetaGrid}>
          <div>
            <div style={s.previewBlockTitle}>Müşteri</div>
            <div>{quote.accountName || "-"}</div>
            <div>{quote.title || "-"}</div>
          </div>
          <div>
            <div style={s.previewBlockTitle}>Teslim ve Geçerlilik</div>
            <div>Geçerlilik: {formatDate(quote.validUntil)}</div>
            <div>Revizyon: {quote.revision}</div>
          </div>
        </div>

        <table style={s.previewTable}>
          <thead>
            <tr>
              <th style={s.previewHeadCell}>Stok Kodu</th>
              <th style={s.previewHeadCell}>Stok Adı</th>
              <th style={s.previewHeadCell}>Miktar</th>
              <th style={s.previewHeadCell}>Birim Fiyat</th>
              <th style={s.previewHeadCell}>Vergi</th>
              <th style={s.previewHeadCell}>Tutar</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines?.map((line) => (
              <tr key={line.id}>
                <td style={s.previewCell}>{getStockCode(line)}</td>
                <td style={s.previewCell}>{line.description}</td>
                <td style={s.previewCell}>{line.quantity}</td>
                <td style={s.previewCell}>{formatMoney(line.unitPrice, currency)}</td>
                <td style={s.previewCell}>%{line.taxRate ?? quote.taxRate ?? 0}</td>
                <td style={s.previewCell}>{formatMoney(getLineAmount(line), currency)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={s.previewTotals}>
          <div style={s.previewTotalRow}><span>Toplam</span><strong>{formatMoney(quote.subtotal, currency)}</strong></div>
          <div style={s.previewTotalRow}><span>Vergi</span><strong>{formatMoney(quote.taxAmount, currency)}</strong></div>
          <div style={s.previewGrandRow}><span>Genel Toplam</span><span>{formatMoney(quote.total, currency)}</span></div>
        </div>

        <div style={s.previewFooter}>
          <div>Geçerlilik Tarihi: {formatDate(quote.validUntil)}</div>
          <div style={{ marginTop: 6 }}>Açıklama: {quote.description || "-"}</div>
        </div>
      </div>
    </div>
  );
}

export default function TeklifFisiPage() {
  const [quotes, setQuotes] = useState<CRMQuote[]>([]);
  const [accounts, setAccounts] = useState<CRMAccount[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CRMQuote | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showFilterDrop, setShowFilterDrop] = useState(false);
  const [sortState, setSortState] = useState<SortState>({ key: "updatedAt", direction: "desc" });
  const [entityMaps, setEntityMaps] = useState<EntityMap[]>([]);
  const [outbox, setOutbox] = useState<OutboxItem[]>([]);
  const [errors, setErrors] = useState<IntegrationError[]>([]);
  const [, setAudit] = useState<IntegrationAudit[]>([]);
  const [showTechPanel, setShowTechPanel] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [converting, setConverting] = useState(false);
  const [createValidErr, setCreateValidErr] = useState<string | null>(null);
  const [cDocumentNo, setCDocumentNo] = useState(() => generateDocumentNumber());
  const [cAccountId, setCAccountId] = useState("");
  const [cValidUntil, setCValidUntil] = useState("");
  const [cLines, setCLines] = useState<LineForm[]>([createEmptyLine()]);
  const [showAccountDrop, setShowAccountDrop] = useState(false);

  const selectedAccount = accounts.find((item) => item.id === cAccountId);
  const selectedEntityMap = entityMaps[0];
  const sortedQuotes = useMemo(() => sortQuotes(quotes, sortState), [quotes, sortState]);

  const createSubtotal = useMemo(() => cLines.reduce((sum, line) => sum + getCreateLineNet(line), 0), [cLines]);
  const createTaxAmount = useMemo(() => cLines.reduce((sum, line) => sum + getCreateLineTax(line), 0), [cLines]);
  const createGrandTotal = createSubtotal + createTaxAmount;

  const loadQuotes = useCallback(async (filter: string | null) => {
    const params = filter ? { status: filter } : {};
    const data = await crmService.listQuotes(params);
    setQuotes(data);
    setSelectedId((current) => current ?? data[0]?.id ?? null);
  }, []);

  useEffect(() => {
    void loadQuotes(null);
    crmService.listAccounts().then(setAccounts).catch(() => null);
  }, [loadQuotes]);

  useEffect(() => {
    if (!selectedId) return;
    crmService.getQuote(selectedId).then(setDetail).catch(() => null);
    integrationService.listEntityMaps({ entity_type: "QUOTE", internal_id: selectedId }).then(setEntityMaps).catch(() => null);
    integrationService.listOutbox({ entity_type: "QUOTE", entity_id: selectedId }).then(setOutbox).catch(() => null);
    integrationService.listErrors({ is_resolved: false, entity_type: "QUOTE", entity_id: selectedId }).then(setErrors).catch(() => null);
    integrationService.listAudit({ entity_type: "QUOTE", entity_id: selectedId }).then(setAudit).catch(() => null);
  }, [selectedId]);

  const applyFilter = (filter: string | null) => {
    setStatusFilter(filter);
    setShowFilterDrop(false);
    setSelectedId(null);
    setDetail(null);
    setEntityMaps([]);
    setOutbox([]);
    setErrors([]);
    void loadQuotes(filter);
  };

  const handleSort = (key: QuoteSortKey) => {
    setSortState((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc",
    }));
  };

  const resetCreateState = () => {
    setCreateValidErr(null);
    setCDocumentNo(generateDocumentNumber());
    setCAccountId("");
    setCValidUntil("");
    setCLines([createEmptyLine()]);
    setShowAccountDrop(false);
  };

  const openCreate = () => {
    resetCreateState();
    setShowCreate(true);
  };

  const closeCreate = () => {
    setShowCreate(false);
    resetCreateState();
  };

  const updateLine = (lineId: string, field: keyof LineForm, value: string) => {
    setCLines((current) => current.map((line) => (line.id === lineId ? { ...line, [field]: value } : line)));
  };

  const addLine = () => {
    setCLines((current) => [...current, createEmptyLine()]);
  };

  const removeLine = (lineId: string) => {
    setCLines((current) => (current.length === 1 ? current : current.filter((line) => line.id !== lineId)));
  };

  const handleConvert = async () => {
    if (!selectedId || !detail || !canConvertQuote(detail.status)) return;
    setConverting(true);
    try {
      await crmService.convertQuoteToOrder(selectedId);
    } finally {
      setConverting(false);
    }
  };

  const handleCreate = async () => {
    setCreateValidErr(null);
    if (!cAccountId) {
      setCreateValidErr("Müşteri seçimi zorunludur.");
      return;
    }

    const activeLines = cLines.filter((line) => line.description.trim());
    if (activeLines.length === 0) {
      setCreateValidErr("En az bir stok adı girilmelidir.");
      return;
    }

    const invalidLine = activeLines.find((line) => Number(line.quantity || 0) <= 0 || Number(line.unitPrice || 0) < 0);
    if (invalidLine) {
      setCreateValidErr("Miktar 0'dan büyük ve birim fiyat negatif olmayan değer olmalıdır.");
      return;
    }

    setCreating(true);
    try {
      await crmService.createQuote({
        account_id: cAccountId,
        title: cDocumentNo,
        document_no: cDocumentNo,
        tax_rate: 0,
        discount_rate: 0,
        currency: "TRY",
        valid_until: cValidUntil || undefined,
        lines: activeLines.map((line) => ({
          product_code: line.productCode.trim() || undefined,
          description: line.description.trim(),
          quantity: Number(line.quantity || 1),
          unit: "ADET",
          unit_price: Number(line.unitPrice || 0),
          discount_rate: 0,
          tax_rate: Number(line.taxRate || 0),
        })),
      });

      closeCreate();
      await loadQuotes(statusFilter);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <h1 style={s.title}>{ORDER_ROUTE_META.quoteForm.title}</h1>
        <div style={s.subtitle}>Liste artık sıralanabilir tablo, satır girişi çoklu yapıda ve baskı önizleme Mikro fişi mantığına yaklaştırıldı.</div>
      </div>

      <div style={s.body}>
        <div style={s.leftPanel}>
          <div style={s.toolbar}>
            <div style={s.relative}>
              <button style={s.btnSecondary} aria-label="Durum Filtresi" onClick={() => setShowFilterDrop((current) => !current)}>
                Durum Filtresi
              </button>
              {showFilterDrop ? (
                <div style={s.optionsList}>
                  <div role="option" aria-selected={statusFilter === null} style={s.option} onClick={() => applyFilter(null)}>
                    Tüm
                  </div>
                  {QUOTE_STATUSES.map((status) => (
                    <div key={status} role="option" aria-selected={statusFilter === status} style={s.option} onClick={() => applyFilter(status)}>
                      {status}
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <div style={s.toolbarSpacer} />
            <button style={s.btnPrimary} onClick={openCreate}>+ Yeni Teklif</button>
          </div>

          <div style={s.filterNote}>{statusFilter ? `${statusFilter} filtre aktif` : "Tüm durumlar listeleniyor"}</div>

          <div style={s.listWrap}>
            <table style={s.listTable}>
              <thead>
                <tr>
                  <th style={s.listHeadCell}><button style={s.sortButton} onClick={() => handleSort("quoteNumber")}>Belge Numarası {sortState.key === "quoteNumber" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</button></th>
                  <th style={s.listHeadCell}><button style={s.sortButton} onClick={() => handleSort("accountName")}>Cari {sortState.key === "accountName" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</button></th>
                  <th style={s.listHeadCell}><button style={s.sortButton} onClick={() => handleSort("status")}>Durum {sortState.key === "status" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</button></th>
                  <th style={s.listHeadCell}><button style={s.sortButton} onClick={() => handleSort("total")}>Toplam {sortState.key === "total" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</button></th>
                  <th style={s.listHeadCell}><button style={s.sortButton} onClick={() => handleSort("validUntil")}>Geçerlilik {sortState.key === "validUntil" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</button></th>
                  <th style={s.listHeadCell}><button style={s.sortButton} onClick={() => handleSort("updatedAt")}>Güncelleme {sortState.key === "updatedAt" ? (sortState.direction === "asc" ? "↑" : "↓") : ""}</button></th>
                </tr>
              </thead>
              <tbody>
                {sortedQuotes.map((quote) => {
                  const isActive = quote.id === selectedId;
                  return (
                    <tr key={quote.id} style={isActive ? s.listRowActive : s.listRow} onClick={() => setSelectedId(quote.id)}>
                      <td style={{ ...s.listCell, ...s.listCellFirst }}>
                        <div style={s.rowPrimary}>{quote.quoteNumber}</div>
                        <div style={s.rowMeta}>{quote.createdBy || "-"}</div>
                      </td>
                      <td style={s.listCell}>
                        <div style={s.rowPrimary}>{quote.accountName || "-"}</div>
                        <div style={s.rowMeta}>{quote.title}</div>
                      </td>
                      <td style={s.listCell}>{quote.status}</td>
                      <td style={s.listCell}>{formatMoney(quote.total, quote.currency || "TRY")}</td>
                      <td style={s.listCell}>{formatDate(quote.validUntil)}</td>
                      <td style={{ ...s.listCell, ...s.listCellLast }}>{formatDate(quote.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div style={s.rightPanel}>
          {detail ? (
            <>
              <Warnings detail={detail} accounts={accounts} />

              <div style={s.topGrid}>
                <section style={s.card}>
                  <h2 style={s.cardTitle}>Müşteri ve Teklif Bilgileri</h2>
                  <div style={s.cardSubtitle}>Header alanı yalnızca işlem için gereken bilgileri taşır.</div>
                  <div style={s.infoGrid}>
                    <div style={s.infoCell}><div style={s.infoLabel}>Müşteri</div><div style={s.infoValue}>{detail.accountName || "-"}</div></div>
                    <div style={s.infoCell}><div style={s.infoLabel}>Belge Numarası</div><div style={s.infoValue}>{detail.quoteNumber}</div></div>
                    <div style={s.infoCell}><div style={s.infoLabel}>Cari Kodu</div><div style={s.infoValue}>{accounts.find((item) => item.id === detail.accountId)?.mikroCariKod || "-"}</div></div>
                    <div style={s.infoCell}><div style={s.infoLabel}>Telefon</div><div style={s.infoValue}>{accounts.find((item) => item.id === detail.accountId)?.phone || "-"}</div></div>
                    <div style={s.infoCell}><div style={s.infoLabel}>Durum</div><div style={s.infoValue}>{detail.status}</div></div>
                    <div style={s.infoCell}><div style={s.infoLabel}>Oluşturan</div><div style={s.infoValue}>{detail.createdBy || "-"}</div></div>
                    <div style={s.infoCell}><div style={s.infoLabel}>Güncelleme Tarihi</div><div style={s.infoValue}>{formatDate(detail.updatedAt)}</div></div>
                  </div>
                </section>

                <section style={s.card}>
                  <h2 style={s.cardTitle}>Toplamlar</h2>
                  <div style={s.cardSubtitle}>Ara toplam, vergi ve genel toplam sade ticari özet olarak sunulur.</div>
                  <div style={s.totalsStack}>
                    <div style={s.totalRow}><span style={s.totalLabel}>Toplam</span><span style={s.totalValue}>{formatMoney(detail.subtotal, detail.currency || "TRY")}</span></div>
                    <div style={s.totalRow}><span style={s.totalLabel}>Vergi</span><span style={s.totalValue}>{formatMoney(detail.taxAmount, detail.currency || "TRY")}</span></div>
                    <div style={s.grandTotalRow}><span style={s.grandTotalLabel}>Genel Toplam</span><span style={s.grandTotalValue}>{formatMoney(detail.total, detail.currency || "TRY")}</span></div>
                  </div>
                </section>
              </div>

              <section style={s.sectionCard}>
                <h2 style={s.cardTitle}>Satır Detayı</h2>
                <div style={s.cardSubtitle}>Yalnızca stok kodu, stok adı, miktar, birim fiyat, vergi ve tutar gösterilir.</div>
                <div style={s.tableWrap}>
                  <table style={s.detailTable}>
                    <thead>
                      <tr>
                        <th style={s.detailHeadCell}>Stok Kodu</th>
                        <th style={s.detailHeadCell}>Stok Adı</th>
                        <th style={s.detailHeadCell}>Miktar</th>
                        <th style={s.detailHeadCell}>Birim Fiyat</th>
                        <th style={s.detailHeadCell}>Vergi</th>
                        <th style={s.detailHeadCell}>Tutar</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.lines?.length ? (
                        detail.lines.map((line) => (
                          <tr key={line.id}>
                            <td style={s.detailCell}>{getStockCode(line)}</td>
                            <td style={s.detailCell}><div style={s.stockName}>{line.description}</div><div style={s.stockMeta}>{line.unit ? `Birim: ${line.unit}` : "Birim: ADET"}</div></td>
                            <td style={s.detailCell}>{line.quantity}</td>
                            <td style={s.detailCell}>{formatMoney(line.unitPrice, detail.currency || "TRY")}</td>
                            <td style={s.detailCell}>%{line.taxRate ?? detail.taxRate ?? 0}</td>
                            <td style={s.detailCell}>{formatMoney(getLineAmount(line), detail.currency || "TRY")}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td style={s.detailCell} colSpan={6}>Henüz satır bulunmuyor.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div style={s.footerMeta}>
                  <div style={s.infoCell}><div style={s.infoLabel}>Geçerlilik Tarihi</div><div style={s.infoValue}>{formatDate(detail.validUntil)}</div></div>
                  <div style={s.infoCell}><div style={s.infoLabel}>Açıklama</div><div style={s.infoValue}>{detail.description || "-"}</div></div>
                  <div style={s.infoCell}><div style={s.infoLabel}>Revizyon</div><div style={s.infoValue}>{detail.revision}</div></div>
                </div>

                <div style={s.actions}>
                  <div style={s.actionGroup}>
                    {canConvertQuote(detail.status) ? (
                      <button style={s.convertBtn} onClick={() => void handleConvert()} disabled={converting} aria-label="Siparise Donustur">
                        {converting ? "Dönüştürülüyor..." : "Siparişe Dönüştür"}
                      </button>
                    ) : (
                      <div style={{ ...s.infoValue, fontSize: "12px" }}>Bu durumdaki teklifler siparişe dönüştürülemez.</div>
                    )}
                    <button style={s.btnSecondary} onClick={() => setShowPreview(true)} aria-label="Baski onizleme">Baskı Önizleme</button>
                  </div>

                  <button style={s.btnSecondary} onClick={() => setShowTechPanel((current) => !current)} aria-label="Teknik aktarim ozeti">
                    {showTechPanel ? "Teknik özeti gizle" : "Teknik özeti göster"}
                  </button>
                </div>

                {showTechPanel ? (
                  <div style={s.techPanel}>
                    <h3 style={s.statusTitle}>Teknik Aktarım Özeti</h3>
                    <div style={{ marginTop: 6, fontSize: "12px", color: "#786555" }}>Teknik ayrıntılar operasyon ekranından ayrıldı, sadece gerektiğinde açılır.</div>
                    {selectedEntityMap ? (
                      <div style={{ marginTop: 12 }}>
                        <span style={{ ...s.badge, background: "#e7f0e8", color: "#2f5f3d" }}>{selectedEntityMap.externalSystem}</span>
                        <div style={{ marginTop: 6, fontSize: "13px", color: "#5c4839" }}>{selectedEntityMap.externalId}</div>
                      </div>
                    ) : null}

                    {outbox.map((item) => (
                      <div key={item.id} style={{ marginTop: 12 }}>
                        <span style={{ ...s.badge, background: item.status === "SUCCESS" ? "#e7f0e8" : "#fdecea", color: item.status === "SUCCESS" ? "#2f5f3d" : "#8b362c" }}>{item.status}</span>
                        {item.status === "FAILED" ? (
                          <div style={s.errItem}>
                            <div>Retry: {item.retryCount} / {item.maxRetries}</div>
                            {item.errorMessage ? <div>{item.errorMessage}</div> : null}
                          </div>
                        ) : null}
                      </div>
                    ))}

                    {errors.map((item) => (
                      <div key={item.id} style={s.errItem}>
                        <div style={{ fontWeight: 800 }}>{item.errorCode}</div>
                        <div>{item.errorMessage}</div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            </>
          ) : (
            <div style={s.emptyState}>Teklif detayını görmek için soldan bir kayıt seçin.</div>
          )}
        </div>
      </div>

      {showCreate ? (
        <div style={s.overlay}>
          <div role="dialog" aria-label="Yeni Teklif Olustur" style={s.dialog}>
            <h2 style={s.dialogTitle}>Yeni Teklif Oluştur</h2>

            <div style={s.createLayout}>
              <section style={s.createCard}>
                <h3 style={s.createCardTitle}>Teklif Üst Bilgileri</h3>
                <div style={s.createCardSub}>Cari kodu, telefon ve belge numarası sabit bilgi olarak burada izlenir.</div>
                <div style={{ ...s.formGrid, marginTop: 14 }}>
                  <div style={{ ...s.formGroup, ...s.relative }}>
                    <label style={s.formLabel}>Müşteri</label>
                    <button aria-label="Cari Hesap" style={s.selectBtn} onClick={() => setShowAccountDrop((current) => !current)}>
                      {cAccountId ? (accounts.find((item) => item.id === cAccountId)?.companyName || cAccountId) : "Seçin..."}
                    </button>
                    {showAccountDrop ? (
                      <div style={s.optionsList}>
                        {accounts.map((account) => (
                          <div key={account.id} role="option" aria-selected={account.id === cAccountId} style={s.option} onClick={() => { setCAccountId(account.id); setShowAccountDrop(false); }}>
                            {account.companyName}
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {selectedAccount && !selectedAccount.mikroCariKod ? <div style={s.hintWarn}>Seçili müşteri için mikro cari kodu eksik.</div> : null}
                  </div>

                  <div style={s.formGroup}>
                    <label htmlFor="c-cari-kod" style={s.formLabel}>Cari Kodu</label>
                    <input id="c-cari-kod" aria-label="Cari Kodu" style={s.input} value={selectedAccount?.mikroCariKod || ""} readOnly />
                  </div>

                  <div style={s.formGroup}>
                    <label htmlFor="c-phone" style={s.formLabel}>Telefon</label>
                    <input id="c-phone" aria-label="Telefon" style={s.input} value={selectedAccount?.phone || ""} readOnly />
                  </div>

                  <div style={s.formGroup}>
                    <label htmlFor="c-doc-no" style={s.formLabel}>Belge Numarası</label>
                    <input id="c-doc-no" aria-label="Belge Numarası" style={s.input} value={cDocumentNo} readOnly />
                  </div>

                  <div style={s.formGroup}>
                    <label htmlFor="c-valid" style={s.formLabel}>Geçerlilik Tarihi</label>
                    <input id="c-valid" aria-label="Gecerlilik Tarihi" style={s.input} type="date" value={cValidUntil} onChange={(event) => setCValidUntil(event.target.value)} />
                    {!cValidUntil ? <div style={s.hintWarn}>Geçerlilik tarihi seçilmedi.</div> : null}
                  </div>
                </div>
              </section>

              <section style={s.createCard}>
                <div style={s.linesHeader}>
                  <div>
                    <h3 style={s.createCardTitle}>Satır Girişi ve Toplamlar</h3>
                    <div style={s.createCardSub}>Stok satırlarını yatay tabloda girin ve toplamları anlık takip edin.</div>
                  </div>
                  <button style={s.btnSecondary} onClick={addLine} aria-label="Yeni satir ekle">+ Satır Ekle</button>
                </div>

                <div style={s.lineTableWrap}>
                  <table style={s.lineTable}>
                    <thead>
                      <tr>
                        <th style={s.lineHeadCell}>Stok Kodu</th>
                        <th style={s.lineHeadCell}>Stok Adı</th>
                        <th style={s.lineHeadCell}>Miktar</th>
                        <th style={s.lineHeadCell}>Birim Fiyat</th>
                        <th style={s.lineHeadCell}>Vergi (%)</th>
                        <th style={s.lineHeadCell}>Tutar</th>
                        <th style={s.lineHeadCell}>İşlem</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cLines.map((line, index) => (
                        <tr key={line.id}>
                          <td style={s.lineCell}><input id={`stock-code-${line.id}`} aria-label={`Stok Kodu ${index + 1}`} style={s.inputCompact} value={line.productCode} onChange={(event) => updateLine(line.id, "productCode", event.target.value)} /></td>
                          <td style={s.lineCell}><input id={`stock-name-${line.id}`} aria-label={`Stok Adi ${index + 1}`} style={s.inputCompact} value={line.description} onChange={(event) => updateLine(line.id, "description", event.target.value)} /></td>
                          <td style={s.lineCell}><input id={`quantity-${line.id}`} aria-label={`Miktar ${index + 1}`} style={s.inputCompact} type="number" value={line.quantity} onChange={(event) => updateLine(line.id, "quantity", event.target.value)} /></td>
                          <td style={s.lineCell}><input id={`price-${line.id}`} aria-label={`Birim Fiyat ${index + 1}`} style={s.inputCompact} type="number" value={line.unitPrice} onChange={(event) => updateLine(line.id, "unitPrice", event.target.value)} /></td>
                          <td style={s.lineCell}>
                            <select id={`tax-${line.id}`} aria-label={`Vergi ${index + 1}`} style={s.inputCompact} value={line.taxRate} onChange={(event) => updateLine(line.id, "taxRate", event.target.value as "" | "10" | "20")}>
                              <option value="">Boş</option>
                              <option value="10">%10</option>
                              <option value="20">%20</option>
                            </select>
                          </td>
                          <td style={s.lineCell}><strong>{formatMoney(getCreateLineAmount(line))}</strong></td>
                          <td style={s.lineCell}><button style={s.btnSecondary} onClick={() => removeLine(line.id)} disabled={cLines.length === 1} aria-label={`Satir ${index + 1} sil`}>Sil</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={s.createTotals}>
                  <div style={s.totalRow}><span style={s.totalLabel}>Toplam</span><span style={s.totalValue}>{formatMoney(createSubtotal)}</span></div>
                  <div style={s.totalRow}><span style={s.totalLabel}>Vergi</span><span style={s.totalValue}>{formatMoney(createTaxAmount)}</span></div>
                  <div style={s.grandTotalRow}><span style={s.grandTotalLabel}>Genel Toplam</span><span style={s.grandTotalValue}>{formatMoney(createGrandTotal)}</span></div>
                </div>
              </section>
            </div>

            {createValidErr ? <div style={s.validationErr}>{createValidErr}</div> : null}

            <div style={s.wizardActions}>
              <button style={s.btnSecondary} onClick={closeCreate}>İptal</button>
              <button style={s.btnPrimary} onClick={() => void handleCreate()} disabled={creating}>{creating ? "Oluşturuluyor..." : "Teklif Oluştur"}</button>
            </div>
          </div>
        </div>
      ) : null}

      {showPreview && detail ? (
        <div style={s.overlay}>
          <div role="dialog" aria-label="Baski Onizleme" style={s.dialog}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2 style={s.dialogTitle}>Baskı Önizleme</h2>
              <div style={s.actionGroup}>
                <button style={s.btnSecondary} onClick={() => window.print()} aria-label="Yazdir">Yazdır</button>
                <button style={s.btnPrimary} onClick={() => setShowPreview(false)}>Kapat</button>
              </div>
            </div>
            <PrintablePreview quote={detail} />
          </div>
        </div>
      ) : null}
    </div>
  );
}

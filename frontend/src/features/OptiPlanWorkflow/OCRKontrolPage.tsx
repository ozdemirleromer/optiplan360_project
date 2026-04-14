import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AlertTriangle } from "lucide-react";

import { TopBar } from "../../components/Layout";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import { Button } from "../../components/Shared";
import { COLORS, RADIUS } from "../../components/Shared/constants";
import type { CellBlocker } from "../../types";
import { optiplanWorkflowService } from "../../services/optiplanWorkflowService";
import type { WorkflowRecord, WorkflowRow } from "../../services/optiplanWorkflowService";
import {
  CONFIDENCE_FIELDS,
  CRITICAL_FIELD_TEXT,
  EMPTY_APPROVED_FIELDS,
  FIELD_LABEL,
  isBooleanField,
  isNumericField,
} from "./phase2GridConstants";
import { focusPhase2GridCell, handlePhase2GridCellKeyDown } from "./phase2GridNavigation";
import { createPhase2GridStyleGetters } from "./phase2GridStyles";
import type { BooleanField, ConfidenceField, NumericField, RowEditState } from "./phase2GridTypes";
import {
  BlockerWarningBanner,
} from "./phase2MiniPanels";
import { FooterActionBar, QueuePanel } from "./phase2WorkspacePanels";
import { ErrorModal, WhatsAppModal } from "./phase2Modals";
import { Phase2RecordGatePanel } from "./phase2RecordGatePanel";
import { Phase2SideRail } from "./phase2SideRail";
import { Phase2PreviewPanel } from "./phase2PreviewPanel";
import { Phase2GridPanel } from "./phase2GridPanel";
import {
  buildWhatsAppDraft,
  countLowCells,
  getRowConfidenceMetrics,
  getRowFieldScore,
  pickNextPhase2Uuid,
} from "./phase2WorkflowUtils";
import type { RowConfidenceMetrics } from "./phase2WorkflowUtils";
import { usePhase2Gate, useValidateCell } from "./usePhase2Gate";
import { usePhase2Confidence } from "./usePhase2Confidence";
import { usePhase2CellActions } from "./usePhase2CellActions";
import { usePhase2BboxOverlay } from "./usePhase2BboxOverlay";
import { usePhase2DerivedState } from "./usePhase2DerivedState";
import { usePhase2ErrorActions } from "./usePhase2ErrorActions";
import { usePhase2Hotkeys } from "./usePhase2Hotkeys";
import { usePhase2ImageAsset } from "./usePhase2ImageAsset";
import { usePhase2PreviewState } from "./usePhase2PreviewState";
import { usePhase2RecordActions } from "./usePhase2RecordActions";

// ─── Sabitler ──────────────────────────────────────────────────────────────────

const SPLIT_MIN = 30;
const SPLIT_MAX = 70;
const IMAGE_ZOOM_MIN = 0.75;
const IMAGE_ZOOM_MAX = 2.5;
const IMAGE_ZOOM_STEP = 0.15;

const OPERATOR_SHORTCUT_LINES = [
  "Tab / Shift+Tab → Hücre geç",
  "Enter → Onayla + Alta geç",
  "Yön tuşları → Hücreler arasında gez",
  "F2 → Mevcut hücreyi onayla",
  "Shift+F2 → Onayla + Sonraki hücre",
  "Ctrl+A → Tüm satırları onayla",
  "Ctrl+Shift+A → Düşük güvenlileri toplu onayla",
  "Ctrl+Enter → Phase 3'e geç",
  "Ctrl+Z → Son işlemi geri al",
  "1-9 → İlk 9 satıra atla",
];

const PHASE2_SCOPE_LINES = [
  "Bu faz yalnız BOY / EN / ADET / U1 / U2 / K1 / K2 doğrulama içindir.",
  "7 alanlı grid sabittir; Phase 2 sabit alan kuralına uyar.",
  "Cari/Stok eşleme ve sipariş düzenleme Phase 3'te yapılır.",
];
// ─── Tasarım Sabitleri (Phase 2 UI spec §18) ──────────────────────────────────

// Slate renk paleti — dense ERP, koyu tema
const SL_900 = "#0f172a"; // arka plan
const SL_800 = "#1e293b"; // paneller
const SL_750 = "#243247"; // hover / aktif satır
const SL_700 = "#334155"; // border
const SL_200 = "#e2e8f0"; // ana metin
const SL_400 = "#94a3b8"; // ikincil metin

// State renkleri
const COLOR_WARNING = "#d97706";   // amber — düşük güven
const COLOR_WARNING_LIGHT = "18";  // opacity suffix
const COLOR_WARNING_LIGHTEST = "28";
const COLOR_SUCCESS = "#16a34a";   // emerald — onaylı / hazır
const COLOR_DANGER = "#dc2626";    // kırmızı — çok düşük / hata
const COLOR_PRIMARY = "#2563eb";   // mavi — primer CTA
const COLOR_BBOX = "#fbbf24";      // sarı — OCR bbox

// Kolon genişlikleri
const COL_NO = 44;
const COL_NUMERIC = 88;
const COL_BOOL = 56;
const COL_CONF = 64;
const COL_STATUS = 80;
const COL_ACTION = 66;
const PHASE2_GRID_MIN_WIDTH = 820;

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function confidenceColor(score: number, threshold: number = 80): string {
  if (score < 50) return COLOR_DANGER;
  if (score < threshold) return COLOR_WARNING;
  if (score < 95) return "#ca8a04";
  return COLOR_SUCCESS;
}

function isLowConfidence(score: number, threshold: number = 80): boolean {
  return score < threshold;
}

// ─── Ana Bileşen ──────────────────────────────────────────────────────────────

export function OCRKontrolPage() {
  // ── State ─────────────────────────────────────────────────────────────────

  const [records, setRecords] = useState<WorkflowRecord[]>([]);
  const [activeUuid, setActiveUuid] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [cellBlockers, setCellBlockers] = useState<Record<string, CellBlocker[]>>({});
  const { confidenceThreshold, setConfidenceThreshold } = usePhase2Confidence();

  // rowId → onaylanan alanlar
  const [approvedCells, setApprovedCells] = useState<Record<string, Set<ConfidenceField>>>({});
  // rowId → düzenlenmiş değerler
  const [rowEdits, setRowEdits] = useState<Record<string, RowEditState>>({});

  // Hatalı görsel modal
  const [errorNote, setErrorNote] = useState("");
  const [showErrorModal, setShowErrorModal] = useState(false);

  // WhatsApp taslak modal (provider pattern)
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppDraftText, setWhatsAppDraftText] = useState("");
  const [whatsAppCopied, setWhatsAppCopied] = useState(false);
  const pendingNextUuidRef = useRef<string | null>(null);

  const [pendingUndoEventId, setPendingUndoEventId] = useState<string | null>(null);
  const [showOperatorHelp, setShowOperatorHelp] = useState(false);
  const [showDecisionHistory, setShowDecisionHistory] = useState(false);

  // Klavye navigasyonu
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [selectedField, setSelectedField] = useState<ConfidenceField | null>(null);
  // ── Hooks ─────────────────────────────────────────────────────────────────

  const {
    gateStatus,
    undoTimeline,
    loading: gateLoading,
    processingDecision,
    processingUndo,
    error: gateError,
    decideCell,
    undoDecision,
  } = usePhase2Gate(activeUuid);
  const {
    validate: validateCell,
    loading: validateLoading,
    error: validateError,
  } = useValidateCell();
  const {
    imageLoadError,
    imageObjectUrl,
    setImageLoadError,
    setImageObjectUrl,
  } = usePhase2ImageAsset(records, activeUuid);
  const {
    leftPanelRatio,
    isNarrowViewport,
    imageZoom,
    imagePan,
    isPreviewVisible,
    imageRef,
    bboxCanvasRef,
    previewViewportRef,
    splitWrapRef,
    isPanningImageRef,
    setImageZoom,
    setImagePan,
    handleSplitKeyDown,
    applyImageZoom,
    handlePreviewWheel,
    beginImagePan,
    beginSplitResize,
    handleImageLoad,
    resetPreviewState,
  } = usePhase2PreviewState({
    activeUuid,
    splitMin: SPLIT_MIN,
    splitMax: SPLIT_MAX,
    imageZoomMin: IMAGE_ZOOM_MIN,
    imageZoomMax: IMAGE_ZOOM_MAX,
    imageZoomStep: IMAGE_ZOOM_STEP,
    narrowBreakpoint: 1280,
  });

  // ── Refs ──────────────────────────────────────────────────────────────────

  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  // Aktif kayıt değişince geçici state'leri sıfırla
  useEffect(() => {
    setApprovedCells({});
    setRowEdits({});
    setCellBlockers({});
    setSelectedRowId(null);
    setSelectedField(null);
    setPendingUndoEventId(null);
    setImageLoadError(false);
    setImageObjectUrl(null);
    resetPreviewState();
  }, [activeUuid]);

  // ── Yükle ─────────────────────────────────────────────────────────────────

  const load = useCallback(async (): Promise<WorkflowRecord[]> => {
    try {
      setErrorMsg(null);
      const data = await optiplanWorkflowService.listRecords();
      const phase2Queue = data.filter((r) => r.dosyaDurumu.includes("PHASE_2"));
      const phase2 = await Promise.all(
        phase2Queue.map(async (record) => {
          try {
            return await optiplanWorkflowService.getRecord(record.kayitUuid);
          } catch {
            return record;
          }
        }),
      );
      if (!isMounted.current) return phase2;
      setRecords(phase2);
      setActiveUuid((prev) => prev ?? phase2[0]?.kayitUuid ?? null);
      return phase2;
    } catch (err) {
      if (isMounted.current) {
        setErrorMsg(err instanceof Error ? err.message : "Kayıtlar yüklenemedi");
      }
      return [];
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  // ── Türetilmiş değerler ───────────────────────────────────────────────────

  const activeRecord = useMemo(
    () => records.find((r) => r.kayitUuid === activeUuid) ?? null,
    [records, activeUuid],
  );

  const lowCellsByUuid = useMemo(
    () => new Map(records.map((r) => [r.kayitUuid, countLowCells(r, isLowConfidence)])),
    [records],
  );
  const rowMetricsById = useMemo(() => {
    const metrics = new Map<string, RowConfidenceMetrics>();
    if (!activeRecord) {
      return metrics;
    }

    for (const row of activeRecord.satirlar) {
      const approvedSet = approvedCells[row.id] ?? EMPTY_APPROVED_FIELDS;
      metrics.set(row.id, getRowConfidenceMetrics(row, approvedSet, confidenceThreshold, isLowConfidence));
    }

    return metrics;
  }, [activeRecord, approvedCells, confidenceThreshold]);
  const {
    handleApproveCell,
    handleApproveAllInRow,
    handleApproveAllInRecord,
    handleApproveLowConfidenceOnly,
    handleNumericCellEdit,
    handleBooleanCellEdit,
  } = usePhase2CellActions({
    activeRecord,
    activeUuid,
    confidenceThreshold,
    isLowConfidence,
    decideCell,
    validateCell,
    setApprovedCells,
    setRowEdits,
    setCellBlockers,
  });

  const { handleRemoveRow, handleRestoreRow, handleGoPhase3 } = usePhase2RecordActions({
    activeRecord,
    activeUuid,
    approvedCells,
    rowEdits,
    load,
    setSaving,
    setErrorMsg,
    setActiveUuid,
    isMountedRef: isMounted,
  });

  const { handleWhatsAppClose, handleMarkError } = usePhase2ErrorActions({
    activeUuid,
    activeRecord,
    errorNote,
    load,
    setSaving,
    setShowErrorModal,
    setErrorNote,
    setWhatsAppDraftText,
    setShowWhatsAppModal,
    setActiveUuid,
    setErrorMsg,
    setWhatsAppCopied,
    pendingNextUuidRef,
    isMountedRef: isMounted,
  });

  usePhase2BboxOverlay({
    selectedField,
    selectedRowId,
    activeRecord,
    confidenceThreshold,
    isPreviewVisible,
    imageRef,
    bboxCanvasRef,
    imageZoom,
    setImageZoom,
    setImagePan,
    colorDanger: COLOR_DANGER,
    colorWarning: COLOR_WARNING,
    colorSuccess: COLOR_SUCCESS,
  });

  // ── Klavye navigasyonu ────────────────────────────────────────────────────

  const focusGridCell = useCallback((rowId: string, fieldIdx: number) => {
    return focusPhase2GridCell(gridScrollRef.current, rowId, fieldIdx);
  }, []);

  const handleCellKeyDown = useCallback(
    (
      e: React.KeyboardEvent<HTMLInputElement>,
      rowId: string,
      fieldIdx: number,
      rowIdx: number,
    ) => {
      handlePhase2GridCellKeyDown({
        event: e,
        rowId,
        fieldIdx,
        rowIdx,
        rows: activeRecord?.satirlar ?? [],
        confidenceThreshold,
        approvedSet: approvedCells[rowId] ?? EMPTY_APPROVED_FIELDS,
        focusCell: focusGridCell,
        setSelectedRowId,
        handleApproveCell,
        getRowFieldScore,
        isLowConfidence,
      });
    },
    [activeRecord, approvedCells, confidenceThreshold, focusGridCell, handleApproveCell],
  );

  // ── Modal ESC ─────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!showErrorModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setShowErrorModal(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [showErrorModal]);

  const {
    canApprove,
    blockerSummary,
    bandSummary,
    selectedBandRow,
    selectedBandReview,
    selectedBandRowNumber,
    selectedBandThickness,
    selectedBandActiveCount,
    selectedBandHasIssue,
  } = usePhase2DerivedState({
    activeRecord,
    approvedCells,
    selectedRowId,
    isLowConfidence,
  });

  usePhase2Hotkeys({
    undoTimeline,
    activeRecord,
    canApprove,
    disableGlobalHotkeys: showErrorModal || showWhatsAppModal,
    undoDecision,
    handleGoPhase3,
    handleApproveAllInRecord,
    handleApproveLowConfidenceOnly,
    setSelectedRowId,
    focusGridCell,
  });

  const phase3DisabledReason = saving
    ? "Kayıt işlemi devam ediyor, faz geçişi beklemeli."
    : !activeRecord
      ? "Aktif kayıt seçilmeden Phase 3'e geçilemez."
      : !canApprove
        ? "Tüm düşük güven hücreleri onaylanmadan Phase 3'e geçilemez."
        : undefined;

  const phase3ActionTitle = phase3DisabledReason ?? "Kaydı Sipariş Kontrol fazına taşı";
  const phase3ActionLabel = saving ? "İşleniyor..." : "Phase 3'e Aktar";
  const blockerDetails = gateStatus?.blockerReasons ?? [];
  const cellBlockerEntries = Object.entries(cellBlockers).filter(([, b]) => b.length > 0);

  const alertContainerStyle = useMemo<CSSProperties>(
    () => ({
      ...alertContainerBaseStyle,
      marginTop: errorMsg || gateError ? 10 : 0,
    }),
    [errorMsg, gateError],
  );

  const emptyStateSplitShellStyle = useMemo<CSSProperties>(
    () => ({
      ...emptyStateSplitShellBaseStyle,
      gridTemplateColumns: isNarrowViewport ? "minmax(0, 1fr)" : "minmax(0, 1fr) minmax(0, 1fr)",
    }),
    [isNarrowViewport],
  );

  const splitShellStyle = useMemo<CSSProperties>(
    () => ({
      ...splitShellBaseStyle,
      gridTemplateColumns: isNarrowViewport ? "minmax(0, 1fr)" : `${leftPanelRatio}fr 10px ${100 - leftPanelRatio}fr`,
      gap: isNarrowViewport ? 12 : 0,
    }),
    [isNarrowViewport, leftPanelRatio],
  );

  const splitSeparatorStyle = useMemo<CSSProperties>(
    () => ({
      ...splitSeparatorBaseStyle,
      display: isNarrowViewport ? "none" : "block",
      width: isNarrowViewport ? 0 : 10,
      cursor: isNarrowViewport ? "default" : "col-resize",
      margin: isNarrowViewport ? 0 : "0 2px",
    }),
    [isNarrowViewport],
  );

  // ── Loading state ─────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="electric-page">
        <TopBar
          title={ORDER_ROUTE_META.workflowReview.title}
          subtitle="OCR Kontrol ekranı hazırlanıyor..."
          breadcrumbs={[ORDER_ROUTE_META.orderList.title, ORDER_ROUTE_META.workflowReview.title]}
        />
        <div className="app-page-container" style={loadingMessageStyle}>
          OCR kontrol kayıtları yükleniyor...
        </div>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="electric-page">
      {/* ── Global Header ─────────────────────────────────────────────────── */}
      <TopBar
        title={ORDER_ROUTE_META.workflowReview.title}
        subtitle="OCR güven skorları doğrulanır; düşük güvenli hücreler operatör onayıyla kabul edilir."
        breadcrumbs={[ORDER_ROUTE_META.orderList.title, ORDER_ROUTE_META.workflowReview.title]}
      />

      <div className="app-page-container" style={pageWorkspaceStyle}>

        {/* ── OCR Kontrol Header Band (spec §5) ────────────────────────────── */}
        <section
          style={headerBandStyle}
        >
          {/* Sol: Başlık + açıklama */}
          <div style={headerTitleGroupStyle}>
            <h2 style={headerTitleStyle}>
              OCR Kontrol
            </h2>
            <p style={headerDescriptionStyle}>
              Doğrulanan alanlar: <strong style={headerCriticalTextStyle}>{CRITICAL_FIELD_TEXT}</strong>
              {" · "}%80 altı güven skoru → turuncu onay bekler
              {" · "}Blocker çözülmeden Phase 3'e geçilemez
            </p>
          </div>
          {/* Sağ: Aksiyonlar */}
          <div style={headerActionsStyle}>
            {/* Confidence Threshold Slider */}
            <div
              style={thresholdBoxStyle}
              title="Düşük güven eşiği (%50-%95 arası)"
            >
              <span style={thresholdLabelStyle}>Eşik:</span>
              <span style={thresholdValueStyle}>%{confidenceThreshold}</span>
              <input
                type="range"
                min={50}
                max={95}
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
                style={thresholdInputStyle}
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={saving}
              style={headerSecondaryBtnStyle}
            >
              Yenile
            </button>
            <button
              type="button"
              onClick={() => setShowErrorModal(true)}
              disabled={saving || !activeRecord}
              title={!activeRecord ? "Aktif kayıt seçilmeden hata kararı verilemez." : "Kaydı hatalı görsel işaretleme ekranını aç"}
              style={headerDangerBtnStyle}
            >
              Hatalı Görsel
            </button>
            <button
              type="button"
              onClick={() => void handleGoPhase3()}
              disabled={saving || !canApprove || !activeRecord}
              title={phase3ActionTitle}
              style={canApprove && activeRecord ? headerPrimaryBtnStyle : headerDisabledBtnStyle}
            >
              {phase3ActionLabel}
            </button>
          </div>
        </section>

        {/* ── Alert alanı ───────────────────────────────────────────────────── */}
        <div style={alertContainerStyle}>
          {(errorMsg || gateError) ? (
            <div
              role="alert"
              style={alertBoxStyle}
            >
              {errorMsg ? <span>{errorMsg}</span> : null}
              {gateError && gateError !== errorMsg ? (
                <span style={alertGateErrorStyle}>Hücre karar hatası: {gateError}</span>
              ) : null}
            </div>
          ) : null}

          {activeRecord && !canApprove ? (
            <BlockerWarningBanner
              pendingCount={blockerSummary?.pendingApprovals ?? 0}
              onApproveLowOnly={handleApproveLowConfidenceOnly}
              colorWarning={COLOR_WARNING}
              colorWarningLight={COLOR_WARNING_LIGHT}
              colorWarningLightest={COLOR_WARNING_LIGHTEST}
              radiusSm={RADIUS.sm}
            />
          ) : null}
        </div>

        {/* ── Ana İçerik ────────────────────────────────────────────────────── */}
        {records.length === 0 ? (
          /* ── Empty State: sabit 2 panel iskelet ───────────────────────── */
          <div style={emptyStateContainerStyle}>
            <div
              data-testid="phase2-fixed-split-shell"
              data-layout-mode={isNarrowViewport ? "stacked" : "split"}
              style={emptyStateSplitShellStyle}
            >
              <section style={cardStyle} aria-label="Belge Önizleme Boş Durum">
                <div style={cardHeaderStyle}>
                  <span style={cardTitleStyle}>Belge Önizleme</span>
                </div>
                <div style={emptyPreviewBodyStyle}>
                  <div style={emptyPreviewTitleRowStyle}>
                    <AlertTriangle size={16} color={COLOR_WARNING} />
                    <strong style={emptyPreviewTitleStyle}>Bekleyen kayıt yok</strong>
                  </div>
                  <span style={emptyPreviewTextStyle}>
                    Sol panel sabittir. Belge seçildiğinde görsel, zoom ve bbox odağı burada açılır.
                  </span>
                </div>
              </section>

              <section style={cardStyle} aria-label="7 Alan Kontrol Boş Durum">
                <div style={cardHeaderStyle}>
                  <span style={cardTitleStyle}>7 Alan Kontrol Paneli</span>
                </div>
                <div style={emptyGridBodyStyle}>
                  <p style={emptyGridDescriptionStyle}>
                    Sağ panel de sabittir; kayıt seçildiğinde doğrulama grid'i ve bant kontrol yüzeyi burada dolar.
                  </p>
                  <ul style={emptyGridListStyle}>
                    <li>Doğrulanan alanlar: <strong style={emptyGridHighlightStyle}>{CRITICAL_FIELD_TEXT}</strong></li>
                    <li>Güven skoru %80 altındaki hücreler turuncu uyarıyla işaretlenir</li>
                    <li>Tüm düşük güvenli hücreler operatör onayı almalıdır</li>
                    <li>Split-screen çalışma alanı her zaman sabittir; kayıt seçildiğinde içerik dolar</li>
                  </ul>
                </div>
              </section>
            </div>

            {/* Footer action bar — empty durumda da göster */}
            <FooterActionBar
              canApprove={false}
              pendingCount={0}
              fileName={null}
              saving={saving}
              phase3Label={phase3ActionLabel}
              phase3Title={phase3ActionTitle}
              onPhase3={() => void handleGoPhase3()}
              radiusSm={RADIUS.sm}
              colorSuccess={COLOR_SUCCESS}
              colorWarning={COLOR_WARNING}
              colorWarningLight={COLOR_WARNING_LIGHT}
              sl200={SL_200}
              sl400={SL_400}
              headerPrimaryBtnStyle={headerPrimaryBtnStyle}
              headerDisabledBtnStyle={headerDisabledBtnStyle}
            />
          </div>
        ) : (
          /* ── Kayıt var: sabit 2 panel workspace ───────────────────── */
          <div style={activeWorkspaceContainerStyle}>
            <div style={activeWorkspaceColumnStyle}>
              {/* ── Üst: Kuyruk listesi ───────────────────────────────────── */}
              <QueuePanel
                records={records}
                activeUuid={activeUuid}
                lowCellsByUuid={lowCellsByUuid}
                onSelect={setActiveUuid}
                cardStyle={cardStyle}
                cardHeaderStyle={cardHeaderStyle}
                cardTitleStyle={cardTitleStyle}
                colorPrimary={COLOR_PRIMARY}
                colorWarning={COLOR_WARNING}
                colorSuccess={COLOR_SUCCESS}
                sl900={SL_900}
                sl700={SL_700}
                sl200={SL_200}
                sl400={SL_400}
              />

              {/* ── Orta: Ana çalışma alanı ──────────────────────────────── */}
              {activeRecord ? (
                <div style={activeRecordWorkspaceStyle}>

                  <Phase2RecordGatePanel
                    activeRecord={activeRecord}
                    gateStatus={gateStatus}
                    gateLoading={gateLoading}
                    blockerDetails={blockerDetails}
                    blockerSummary={blockerSummary}
                    confidenceThreshold={confidenceThreshold}
                    isNarrowViewport={isNarrowViewport}
                    cardStyle={cardStyle}
                    sl200={SL_200}
                    sl400={SL_400}
                    colorSuccess={COLOR_SUCCESS}
                    colorWarning={COLOR_WARNING}
                  />

                  {/* ── Split-Screen Workspace (spec §6) ─────────────────── */}
                  <div
                    ref={splitWrapRef}
                    data-testid="phase2-fixed-split-shell"
                    data-layout-mode={isNarrowViewport ? "stacked" : "split"}
                    style={splitShellStyle}
                  >
                    <Phase2PreviewPanel
                      activeRecord={activeRecord}
                      cardStyle={cardStyle}
                      cardHeaderStyle={cardHeaderStyle}
                      cardTitleStyle={cardTitleStyle}
                      zoomBtnStyle={zoomBtnStyle}
                      previewViewportRef={previewViewportRef}
                      imageRef={imageRef}
                      bboxCanvasRef={bboxCanvasRef}
                      imageZoom={imageZoom}
                      imagePan={imagePan}
                      selectedRowId={selectedRowId}
                      selectedField={selectedField}
                      fieldLabel={FIELD_LABEL}
                      imageObjectUrl={imageObjectUrl}
                      imageLoadError={imageLoadError}
                      isPanningImage={isPanningImageRef.current}
                      onApplyImageZoom={applyImageZoom}
                      onSetImagePan={setImagePan}
                      onPreviewWheel={handlePreviewWheel}
                      onBeginImagePan={beginImagePan}
                      onImageLoad={handleImageLoad}
                      onImageLoadError={() => setImageLoadError(true)}
                      imageZoomStep={IMAGE_ZOOM_STEP}
                      colorBbox={COLOR_BBOX}
                      sl200={SL_200}
                      sl400={SL_400}
                      sl700={SL_700}
                    />

                    {/* Sürüklenebilir ayraç */}
                    <div
                      role="separator"
                      aria-orientation="vertical"
                      aria-label="Panel boyutlandırıcı"
                      tabIndex={isNarrowViewport ? -1 : 0}
                      onKeyDown={handleSplitKeyDown}
                      onPointerDown={beginSplitResize}
                      style={splitSeparatorStyle}
                    />

                    <Phase2GridPanel
                      activeRecord={activeRecord}
                      isNarrowViewport={isNarrowViewport}
                      gridScrollRef={gridScrollRef}
                      confidenceFields={CONFIDENCE_FIELDS}
                      fieldLabel={FIELD_LABEL}
                      approvedCells={approvedCells}
                      rowEdits={rowEdits}
                      rowMetricsById={rowMetricsById}
                      saving={saving}
                      selectedRowId={selectedRowId}
                      tdStyle={tdStyle}
                      thStyle={thStyle}
                      cardStyle={cardStyle}
                      cardHeaderStyle={cardHeaderStyle}
                      cardTitleStyle={cardTitleStyle}
                      rowIndexCellStyle={phase2RowIndexCellStyle}
                      rowIndexInnerStyle={phase2RowIndexInnerStyle}
                      rowApproveBtnStyle={rowApproveBtnStyle}
                      boolLabelStyle={phase2BoolLabelStyle}
                      boolInputStyle={phase2BoolInputStyle}
                      cellInnerStyle={phase2CellInnerStyle}
                      cellFooterStyle={phase2CellFooterStyle}
                      phase2GridMinWidth={PHASE2_GRID_MIN_WIDTH}
                      colNo={COL_NO}
                      colNumeric={COL_NUMERIC}
                      colBool={COL_BOOL}
                      colConf={COL_CONF}
                      colStatus={COL_STATUS}
                      colAction={COL_ACTION}
                      sl200={SL_200}
                      sl400={SL_400}
                      sl700={SL_700}
                      sl750={SL_750}
                      sl800={SL_800}
                      colorPrimary={COLOR_PRIMARY}
                      colorSuccess={COLOR_SUCCESS}
                      colorWarning={COLOR_WARNING}
                      getRowFieldScore={getRowFieldScore}
                      isLowConfidence={isLowConfidence}
                      confidenceColor={confidenceColor}
                      getCellStyle={getPhase2CellStyle}
                      getNumericInputStyle={getPhase2NumericInputStyle}
                      getScoreTextStyle={getPhase2ScoreTextStyle}
                      getApproveButtonStyle={getPhase2ApproveButtonStyle}
                      cellBlockerEntries={cellBlockerEntries}
                      onSelectRow={setSelectedRowId}
                      onSelectField={setSelectedField}
                      onApproveAllInRow={handleApproveAllInRow}
                      onApproveCell={handleApproveCell}
                      onBooleanCellEdit={handleBooleanCellEdit}
                      onNumericCellEdit={handleNumericCellEdit}
                      onCellKeyDown={handleCellKeyDown}
                      onRemoveRow={handleRemoveRow}
                    />
                  </div>

                  {/* Kaldırılan satırlar */}
                  {activeRecord.cikarilanSatirlar.length > 0 ? (
                    <section style={cardStyle}>
                      <div style={cardHeaderStyle}>
                        <span style={removedRowsTitleStyle}>
                          Kaldırılan Satırlar ({activeRecord.cikarilanSatirlar.length})
                        </span>
                      </div>
                      <div style={removedRowsBodyStyle}>
                        {activeRecord.cikarilanSatirlar.map((row, idx) => (
                          <div
                            key={row.id}
                            style={getRemovedRowItemStyle(idx === activeRecord.cikarilanSatirlar.length - 1)}
                          >
                            <span style={removedRowTextStyle}>
                              Satır {idx + 1}: BOY={row.boy ?? "—"} EN={row.en ?? "—"} ADET={row.adet ?? "—"}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => void handleRestoreRow(row.id)}
                              disabled={saving}
                            >
                              Geri Al
                            </Button>
                          </div>
                        ))}
                      </div>
                    </section>
                  ) : null}
                </div>
              ) : (
                <div style={noActiveRecordStyle}>
                  Listeden bir kayıt seçin.
                </div>
              )}

              <Phase2SideRail
                isNarrowViewport={isNarrowViewport}
                cardStyle={cardStyle}
                cardHeaderStyle={cardHeaderStyle}
                cardTitleStyle={cardTitleStyle}
                headerSecondaryBtnStyle={headerSecondaryBtnStyle}
                blockerSummary={blockerSummary}
                bandSummary={bandSummary}
                selectedBandRow={selectedBandRow}
                selectedBandReview={selectedBandReview}
                selectedBandRowNumber={selectedBandRowNumber}
                selectedBandThickness={selectedBandThickness}
                selectedBandActiveCount={selectedBandActiveCount}
                selectedBandHasIssue={selectedBandHasIssue}
                showOperatorHelp={showOperatorHelp}
                setShowOperatorHelp={setShowOperatorHelp}
                operatorShortcutLines={OPERATOR_SHORTCUT_LINES}
                phase2ScopeLines={PHASE2_SCOPE_LINES}
                showDecisionHistory={showDecisionHistory}
                setShowDecisionHistory={setShowDecisionHistory}
                undoTimeline={undoTimeline}
                validateError={validateError}
                processingDecision={processingDecision}
                validateLoading={validateLoading}
                saving={saving}
                hasActiveRecord={Boolean(activeRecord)}
                processingUndo={processingUndo}
                pendingUndoEventId={pendingUndoEventId}
                onUndo={(eventId) => {
                  if (processingUndo) return;
                  setPendingUndoEventId(eventId);
                  void undoDecision(eventId).finally(() => {
                    setPendingUndoEventId((prev) => (prev === eventId ? null : prev));
                  });
                }}
                confidenceColor={confidenceColor}
                colorSuccess={COLOR_SUCCESS}
                colorWarning={COLOR_WARNING}
                colorWarningLight={COLOR_WARNING_LIGHT}
                colorPrimary={COLOR_PRIMARY}
                colorDanger={COLOR_DANGER}
                sl200={SL_200}
                sl400={SL_400}
                sl700={SL_700}
                sl800={SL_800}
                sl900={SL_900}
              />
            </div>

            {/* ── Alt Blocker / Action Bar (spec §15) ─────────────────────── */}
            <FooterActionBar
              canApprove={canApprove}
              pendingCount={blockerSummary?.pendingApprovals ?? 0}
              fileName={activeRecord?.hamDosyaAdi ?? null}
              saving={saving}
              phase3Label={phase3ActionLabel}
              phase3Title={phase3ActionTitle}
              onPhase3={() => void handleGoPhase3()}
              radiusSm={RADIUS.sm}
              colorSuccess={COLOR_SUCCESS}
              colorWarning={COLOR_WARNING}
              colorWarningLight={COLOR_WARNING_LIGHT}
              sl200={SL_200}
              sl400={SL_400}
              headerPrimaryBtnStyle={headerPrimaryBtnStyle}
              headerDisabledBtnStyle={headerDisabledBtnStyle}
            />
          </div>
        )}
      </div>

      <ErrorModal
        show={showErrorModal}
        saving={saving}
        errorNote={errorNote}
        onNoteChange={setErrorNote}
        onCancel={() => setShowErrorModal(false)}
        onConfirm={() => void handleMarkError()}
        modalOverlayStyle={modalOverlayStyle}
        modalPanelStyle={modalPanelStyle}
        sl200={SL_200}
        sl400={SL_400}
        sl700={SL_700}
        sl900={SL_900}
      />

      <WhatsAppModal
        show={showWhatsAppModal}
        draftText={whatsAppDraftText}
        copied={whatsAppCopied}
        onCopy={() => {
          void navigator.clipboard.writeText(whatsAppDraftText).then(() => {
            setWhatsAppCopied(true);
            setTimeout(() => setWhatsAppCopied(false), 2000);
          });
        }}
        onClose={() => void handleWhatsAppClose()}
        modalOverlayStyle={modalOverlayStyle}
        modalPanelStyle={modalPanelStyle}
        sl200={SL_200}
        sl400={SL_400}
        sl700={SL_700}
        sl900={SL_900}
      />
    </div>
  );
}

// ─── Yardımcı bileşenler ──────────────────────────────────────────────────────

// ─── Stil sabitleri ───────────────────────────────────────────────────────────

const cardStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  borderRadius: RADIUS.sm ?? 4,
  border: `1px solid ${SL_700}`,
  background: SL_800,
  overflow: "hidden",
};

const pageWorkspaceStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  padding: 0,
};

const loadingMessageStyle: CSSProperties = {
  color: COLORS.muted,
};

const headerBandStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  borderBottom: `1px solid ${SL_700}`,
  background: SL_800,
  flexWrap: "wrap",
};

const headerTitleGroupStyle: CSSProperties = {
  display: "grid",
  gap: 3,
};

const headerTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 18,
  fontWeight: 700,
  color: SL_200,
  lineHeight: 1.2,
};

const headerDescriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: 11,
  color: SL_400,
  lineHeight: 1.5,
};

const headerCriticalTextStyle: CSSProperties = {
  color: COLOR_WARNING,
};

const headerActionsStyle: CSSProperties = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexShrink: 0,
};

const thresholdBoxStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "4px 12px",
  background: "#1e293b",
  border: "1px solid #334155",
  borderRadius: 6,
};

const thresholdLabelStyle: CSSProperties = {
  fontSize: 11,
  color: SL_400,
};

const thresholdValueStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: COLOR_WARNING,
};

const thresholdInputStyle: CSSProperties = {
  width: 80,
  cursor: "pointer",
};

const alertContainerBaseStyle: CSSProperties = {
  padding: "0 16px",
  display: "grid",
  gap: 8,
};

const alertBoxStyle: CSSProperties = {
  padding: "10px 14px",
  borderRadius: RADIUS.sm ?? 4,
  border: `1px solid ${COLOR_DANGER}`,
  background: `${COLOR_DANGER}12`,
  color: SL_200,
  fontSize: 13,
  display: "grid",
  gap: 4,
};

const alertGateErrorStyle: CSSProperties = {
  color: COLOR_WARNING,
};

const emptyStateContainerStyle: CSSProperties = {
  padding: 16,
  display: "grid",
  gap: 12,
};

const emptyStateSplitShellBaseStyle: CSSProperties = {
  display: "grid",
  gap: 12,
  alignItems: "stretch",
};

const emptyPreviewBodyStyle: CSSProperties = {
  minHeight: 320,
  padding: "20px 22px",
  display: "grid",
  alignContent: "center",
  gap: 10,
  color: SL_400,
  background: "#09101d",
};

const emptyPreviewTitleRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
};

const emptyPreviewTitleStyle: CSSProperties = {
  fontSize: 16,
  color: SL_200,
};

const emptyPreviewTextStyle: CSSProperties = {
  fontSize: 13,
  lineHeight: 1.7,
};

const emptyGridBodyStyle: CSSProperties = {
  minHeight: 320,
  padding: "20px 22px",
  display: "grid",
  gap: 12,
  color: SL_400,
};

const emptyGridDescriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.75,
};

const emptyGridListStyle: CSSProperties = {
  paddingLeft: 18,
  margin: 0,
  fontSize: 13,
  lineHeight: 1.75,
};

const emptyGridHighlightStyle: CSSProperties = {
  color: SL_200,
};

const activeWorkspaceContainerStyle: CSSProperties = {
  padding: "12px 16px",
  display: "grid",
  gap: 12,
};

const activeWorkspaceColumnStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr",
  gap: 12,
  alignItems: "stretch",
};

const activeRecordWorkspaceStyle: CSSProperties = {
  display: "grid",
  gap: 10,
  minWidth: 0,
};

const splitShellBaseStyle: CSSProperties = {
  display: "grid",
  alignItems: "stretch",
  minHeight: 420,
};

const splitSeparatorBaseStyle: CSSProperties = {
  minHeight: 320,
  borderRadius: 4,
  border: `1px solid ${SL_700}`,
  background: SL_800,
  alignSelf: "stretch",
};

const removedRowsBodyStyle: CSSProperties = {
  padding: "8px 16px",
  display: "grid",
  gap: 6,
};

const removedRowItemBaseStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 8,
  padding: "4px 0",
};

const removedRowTextStyle: CSSProperties = {
  fontSize: 12,
  color: SL_400,
};

const noActiveRecordStyle: CSSProperties = {
  padding: "32px 20px",
  color: SL_400,
  fontSize: 13,
  textAlign: "center",
};

const cardHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  padding: "10px 16px",
  borderBottom: `1px solid ${SL_700}`,
  flexWrap: "wrap",
  background: SL_750,
};

const cardTitleStyle: CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  color: SL_200,
};

const removedRowsTitleStyle: CSSProperties = {
  ...cardTitleStyle,
  color: SL_400,
};

function getRemovedRowItemStyle(isLast: boolean): CSSProperties {
  return {
    ...removedRowItemBaseStyle,
    borderBottom: isLast ? "none" : `1px solid ${SL_700}`,
  };
}

const thStyle: CSSProperties = {
  padding: "8px 8px",
  textAlign: "left",
  fontSize: 11,
  fontWeight: 700,
  color: SL_400,
  whiteSpace: "nowrap",
};

const tdStyle: CSSProperties = {
  padding: "6px 8px",
  fontSize: 12,
  color: SL_200,
  verticalAlign: "middle",
};

const zoomBtnStyle: CSSProperties = {
  border: `1px solid ${SL_700}`,
  background: SL_800,
  color: SL_200,
  borderRadius: 3,
  height: 22,
  minWidth: 22,
  padding: "0 5px",
  fontSize: 12,
  lineHeight: 1,
  fontWeight: 700,
  cursor: "pointer",
};

const rowApproveBtnStyle: CSSProperties = {
  padding: "1px 5px",
  borderRadius: 999,
  border: `1px solid ${COLOR_WARNING}`,
  background: `${COLOR_WARNING}${COLOR_WARNING_LIGHT}`,
  color: COLOR_WARNING,
  fontSize: 8,
  fontWeight: 700,
  cursor: "pointer",
};

const phase2RowIndexCellStyle: CSSProperties = {
  ...tdStyle,
  color: SL_400,
  textAlign: "center",
  padding: "6px 4px",
};

const phase2RowIndexInnerStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 3,
};

const phase2CellInnerStyle: CSSProperties = {
  display: "grid",
  gap: 3,
};

const phase2BoolLabelStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 28,
  cursor: "pointer",
};

const phase2BoolInputStyle: CSSProperties = {
  width: 16,
  height: 16,
  accentColor: COLOR_PRIMARY,
};

const phase2NumericInputBaseStyle: CSSProperties = {
  width: "100%",
  minHeight: 28,
  padding: "2px 6px",
  borderRadius: 2,
  background: SL_900,
  color: SL_200,
  fontSize: 12,
  textAlign: "right",
  outline: "none",
};

const phase2CellFooterStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 3,
};

const {
  getPhase2CellStyle,
  getPhase2NumericInputStyle,
  getPhase2ApproveButtonStyle,
  getPhase2ScoreTextStyle,
} = createPhase2GridStyleGetters({
  tdStyle,
  phase2NumericInputBaseStyle,
  sl700: SL_700,
  colorWarning: COLOR_WARNING,
  colorWarningLight: COLOR_WARNING_LIGHT,
  colorSuccess: COLOR_SUCCESS,
});

// Header band butonları
const headerBtnBase: CSSProperties = {
  padding: "5px 14px",
  borderRadius: 3,
  fontSize: 12,
  fontWeight: 700,
  cursor: "pointer",
  border: "1px solid",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
  minHeight: 32,
  minWidth: 44,
};

const headerSecondaryBtnStyle: CSSProperties = {
  ...headerBtnBase,
  border: `1px solid ${SL_700}`,
  background: SL_800,
  color: SL_200,
};

const headerDangerBtnStyle: CSSProperties = {
  ...headerBtnBase,
  border: `1px solid ${COLOR_DANGER}`,
  background: `${COLOR_DANGER}14`,
  color: COLOR_DANGER,
};

const headerPrimaryBtnStyle: CSSProperties = {
  ...headerBtnBase,
  border: `1px solid ${COLOR_PRIMARY}`,
  background: COLOR_PRIMARY,
  color: "#fff",
};

const headerDisabledBtnStyle: CSSProperties = {
  ...headerBtnBase,
  border: `1px solid ${SL_700}`,
  background: `${SL_700}50`,
  color: SL_400,
  cursor: "not-allowed",
  opacity: 0.6,
};

const modalOverlayStyle: CSSProperties = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.6)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

const modalPanelStyle: CSSProperties = {
  background: SL_800,
  borderRadius: RADIUS.sm ?? 4,
  border: `1px solid ${SL_700}`,
  padding: 20,
  width: "min(480px, 90vw)",
  display: "grid",
  gap: 14,
};



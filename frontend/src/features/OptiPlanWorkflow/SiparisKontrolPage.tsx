import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  FileText,
  Layers,
  Loader2,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useLookupCache } from "./useLookupCache";
import { JobDashboardPanel } from "./JobDashboardPanel";
import { SiparisKontrolRibbon, type RibbonTab } from "./SiparisKontrolRibbon";
import {
  type WorkflowBandThickness,
  type WorkflowGrain,
  type WorkflowPlate,
  type WorkflowRecord,
  type WorkflowRow,
} from "../../services/optiplanWorkflowService";
import {
  addScrapNote as addPhase3ScrapNote,
  getPhase3Queue,
  getPhase3RecordDetail,
  lookupCustomers as lookupPhase3Customers,
  lookupStocks as lookupPhase3Stocks,
  matchCustomer as matchPhase3Customer,
  matchStock as matchPhase3Stock,
  mergeRows as mergePhase3Rows,
  moveToPhase4 as movePhase3ToPhase4,
  updatePhase3Draft,
  type Phase3OrderLine,
  type Phase3RecordDetail,
  type Phase3Summary,
  type WorkflowLookupCustomer,
  type WorkflowLookupStock,
} from "../../services/phase3Service";
import type { Phase1QueueRecord } from "../../services/phase1Service";
import { navigateToAppPage } from "../../utils/appNavigation";

import type {
  CariEslesmesi,
  CariMatch,
  DemoScenario,
  Plaka,
  SiparisRow,
  StokMatch,
} from "./siparisKontrolTypes";

import {
  blockerMesaji,
  calcBlocker,
  calcCriticalMergeGroupCount,
  calcCriticalMergeRowNos,
  calcFireMissing,
  calcUnmatched,
  formatDateTime,
  isMergeCompatible,
  mergeBekleyenSayisi,
  recordSelectorSummary,
  recordStatusPriority,
  satirFireAciklamasiZorunluMu,
  totalAdet,
  uniqueMalzeme,
} from "./siparisKontrolUtils";

import {
  CARI_MATCHES,
  SCENARIO_LABELS,
  STOK_MATCHES,
  buildScenarioData,
} from "./siparisKontrolDemoData";

import {
  FireModal,
  InfoChip,
  MergeModal,
  MiniBadge,
  RowDetailPanel,
  SummaryField,
  Td,
  ValidationItem,
} from "./siparisKontrolAtoms";

import { CariSearchDrawer } from "./CariSearchDrawer";
import { StokSearchDrawer } from "./StokSearchDrawer";
import { LookupCacheDebugPanel } from "./LookupCacheDebugPanel";

const DEFAULT_PHASE3_PLATE_BOY_MM = 2800;
const DEFAULT_PHASE3_PLATE_EN_MM = 2100;
const LOOKUP_DEBOUNCE_MS = 250;
const LOOKUP_MIN_QUERY_LENGTH = 3;
type SaveFeedbackTone = "success" | "error" | "warning" | "info";
type LoadLiveDataOptions = {
  successFeedback?: {
    message: string;
    tone: SaveFeedbackTone;
    timeoutMs?: number;
  };
  suppressDefaultSuccess?: boolean;
  preserveGeneralFireAciklamasi?: string;
};
type LookupUiState = "idle" | "loading" | "results" | "empty" | "fallback";
type LookupBusyContext = "cari-search" | "cari-submit" | "stok-search" | "stok-submit" | null;

function toPhase3UiRowNo(rowIndex: number): number {
  return rowIndex + 1;
}

function toPhase3BackendRowIndex(uiRowNo: number): number {
  return Math.max(0, uiRowNo - 1);
}

function toLegacyWorkflowRowFromPhase3Line(line: Phase3OrderLine): WorkflowRow {
  const normalizedYon = (line.yon ?? "").toLocaleLowerCase("tr-TR");
  const grain: WorkflowGrain = normalizedYon.includes("boy") ? 1 : normalizedYon.includes("en") ? 2 : 0;

  return {
    id: `${line.plateId ?? "p"}-${line.rowIndex}`,
    satirSirasi: toPhase3UiRowNo(line.rowIndex),
    malzeme: line.materialText ?? "",
    boy: line.boy ? Number(line.boy) : null,
    en: line.en ? Number(line.en) : null,
    adet: line.adet ?? null,
    grain,
    bilgi: line.aciklama ?? "",
    u1: Boolean(line.bantUst),
    u2: Boolean(line.bantAlt),
    k1: Boolean(line.bantSol),
    k2: Boolean(line.bantSag),
    delik1: line.ilaveAciklama ?? "",
    delik2: line.aciklama1 ?? "",
    satirKaynagi: "OCR",
    plakaRef: line.plateId ?? "P1",
    bantKalinligiOverride: "" as WorkflowBandThickness,
    hucreGuvenSkorlari: {},
    satirGuvenSkorOzeti: {},
    boyOnay: "BEKLEMEDE",
    enOnay: "BEKLEMEDE",
    adetOnay: "BEKLEMEDE",
    boyOperatorDegeri: null,
    enOperatorDegeri: null,
    adetOperatorDegeri: null,
    onaylayanId: null,
    onayZamani: null,
    bboxJson: null,
  };
}

function toUiRowsFromPhase3Detail(detail: Phase3RecordDetail): SiparisRow[] {
  return detail.lines.map((line) => ({
    siraNo: toPhase3UiRowNo(line.rowIndex),
    malzeme: line.materialText ?? "",
    malzemeEslesmeDurumu:
      line.stockMatchStatus === "MATCHED" || line.stockMatchStatus === "MANUAL_MATCHED"
        ? "matched"
        : "unmatched",
    erpStokKodu: line.stockCode ?? null,
    boy: line.boy ? Number(line.boy) : 0,
    en: line.en ? Number(line.en) : 0,
    adet: line.adet ?? 0,
    yon: line.yon ?? "-",
    aciklama: line.aciklama ?? "",
    u1: line.bantUst ? 1 : 0,
    u2: line.bantAlt ? 1 : 0,
    k1: line.bantSol ? 1 : 0,
    k2: line.bantSag ? 1 : 0,
    ilaveAciklama: line.ilaveAciklama ?? "",
    aciklama1: line.aciklama1 ?? "",
    fireAciklamasi: line.scrapNote ?? "",
    merged: false,
    plakaRef: line.plateId ?? "P1",
    satirKaynagi: "OCR",
  }));
}

function toLegacyWorkflowRecordFromPhase3(
  queueRecord: Phase1QueueRecord,
  detail?: Phase3RecordDetail,
  generalFireAciklamasiFallback = "",
): WorkflowRecord {
  const satirlar = detail ? detail.lines.map(toLegacyWorkflowRowFromPhase3Line) : [];
  const headerGeneralFireAciklamasi = detail?.header.fireAciklamasi?.trim() ?? "";
  const detailGeneralFireAciklamasi = detail?.lines.find((line) => (line.scrapNote ?? "").trim())?.scrapNote?.trim() ?? "";
  const generalFireAciklamasi = headerGeneralFireAciklamasi || detailGeneralFireAciklamasi || generalFireAciklamasiFallback;
  const firstMaterial = detail?.lines.find((line) => (line.materialText ?? "").trim())?.materialText ?? "";
  const firstStockCode = detail?.lines.find((line) => (line.stockCode ?? "").trim())?.stockCode ?? "";
  const displayStatus = queueRecord.status === "PHASE3_IN_PROGRESS" ? "SIPARIS_DUZENLEME" : queueRecord.status;

  return {
    kayitUuid: queueRecord.uuid,
    hamDosyaAdi: queueRecord.fileName,
    kaynakKlasor: detail?.header.sourceType ?? queueRecord.folderType,
    gelisTarihi: queueRecord.createdAt,
    dosyaDurumu: displayStatus,
    orijinalDosyaYolu: "",
    dosyaHash: queueRecord.recordId,
    ocrHamJson: null,
    ayristirilmisOcrAlanlari: null,
    okunanCariUnvan: detail?.header.customerName ?? "",
    okunanCariTelefon: detail?.header.customerPhone ?? "",
    aiGuvenSkoruOzeti: null,
    revizyonAdayiUyarisi: "",
    cariUnvan: detail?.header.customerName ?? "",
    cariKodu: detail?.header.customerCode ?? "",
    siparisNo: queueRecord.recordId,
    termin: "",
    teslimTarihi: "",
    teslimatAdresi: "",
    odemeSekli: "",
    malzeme: firstMaterial,
    stokKodu: firstStockCode,
    bantKalinligi: "" as WorkflowBandThickness,
    grainVarsayilan: 0 as WorkflowGrain,
    plakaBoyMm: DEFAULT_PHASE3_PLATE_BOY_MM,
    plakaEnMm: DEFAULT_PHASE3_PLATE_EN_MM,
    fireAciklamasi: generalFireAciklamasi,
    retryNo: queueRecord.retryCount,
    revizyonNo: 0,
    aktifFaz: 3,
    dosyaBoyutu: null,
    islemeKilidi: null,
    kilidZamani: null,
    sonDenemeZamani: null,
    sonrakiDenemeZamani: queueRecord.nextRetryAt,
    sonHataMesaji: queueRecord.lastErrorMessage,
    ocrSaglayici: null,
    ocrIslemSuresiMs: null,
    satirlar,
    cikarilanSatirlar: [],
    auditKayitlari: [],
    plakalar: detail?.plateGroups.map((plate) => ({
      id: plate.plateId,
      plakaRef: plate.plateId,
      etiket: plate.label,
      plakaBoyMm: DEFAULT_PHASE3_PLATE_BOY_MM,
      plakaEnMm: DEFAULT_PHASE3_PLATE_EN_MM,
      genelListedeMi: false,
    })) ?? [],
    exportKayitlari: [],
    hataKayitlari: [],
    imageUrl: "",
    sonGuncelleme: queueRecord.updatedAt,
    duplicateFlag: queueRecord.duplicateFlag,
    kaynakKlasorTipi: queueRecord.sourceType,
  };
}

// Ana sayfa bileşeni

export function SiparisKontrolPage() {
  const [activeScenario, setActiveScenario] = useState<DemoScenario>("A");
  const [dataMode, setDataMode] = useState<"live" | "demo">("live");
  const isDevBuild = import.meta.env.DEV;
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeRecord, setActiveRecord] = useState<WorkflowRecord | null>(null);
  const [recordsList, setRecordsList] = useState<WorkflowRecord[]>([]);
  const [selectedRecordUuid, setSelectedRecordUuid] = useState("");
  const [activeRecordId, setActiveRecordId] = useState("");
  const [activeOperatorName, setActiveOperatorName] = useState<string | null>(null);
  const [serviceRows, setServiceRows] = useState<WorkflowRow[]>([]);
  const [liveSummary, setLiveSummary] = useState<Phase3Summary | null>(null);
  const [cariMatches, setCariMatches] = useState<CariMatch[]>(CARI_MATCHES);
  const [stokMatches, setStokMatches] = useState<StokMatch[]>(STOK_MATCHES);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupBusyContext, setLookupBusyContext] = useState<LookupBusyContext>(null);
  const [cariLookupState, setCariLookupState] = useState<LookupUiState>("idle");
  const [stokLookupState, setStokLookupState] = useState<LookupUiState>("idle");
  const [cariLookupRetryKey, setCariLookupRetryKey] = useState(0);
  const [stokLookupRetryKey, setStokLookupRetryKey] = useState(0);

  const initData = buildScenarioData("A");
  const [rows, setRows] = useState<SiparisRow[]>(initData.rows);
  const [cari, setCari] = useState<CariEslesmesi>(initData.cari);
  const [plates, setPlates] = useState<Plaka[]>(initData.plates);
  const [activePlateRef, setActivePlateRef] = useState("P1");

  // Seçim state
  const [selectedRowNos, setSelectedRowNos] = useState<Set<number>>(new Set());
  const [activeRowNo, setActiveRowNo] = useState<number | null>(null);

  // Modal state
  const [showCariModal, setShowCariModal] = useState(false);
  const [showStokDrawer, setShowStokDrawer] = useState(false);
  const [showFireModal, setShowFireModal] = useState(false);
  const [generalFireAciklamasi, setGeneralFireAciklamasi] = useState("");
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showRowDetail, setShowRowDetail] = useState(false);

  // Arama state
  const [cariSearch, setCariSearch] = useState("");
  const [stokSearch, setStokSearch] = useState("");
  const [stokTargetRowNo, setStokTargetRowNo] = useState<number | null>(null);

  // UI state
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>("KAYIT");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const [saveTone, setSaveTone] = useState<SaveFeedbackTone>("info");
  const [lastOperatorAction, setLastOperatorAction] = useState("Sistem: İlk yükleme");
  const [mergeHistory, setMergeHistory] = useState<string[]>([]);

  // Refs
  const cariSearchRef = useRef<HTMLInputElement>(null);
  const stokSearchRef = useRef<HTMLInputElement>(null);
  const fireInputRef = useRef<HTMLTextAreaElement>(null);
  const saveMsgTimerRef = useRef<number | null>(null);

  // Cached lookup functions (30s TTL) with statistics tracking
  // Cache clears when retry key changes (e.g., user clicks retry button)
  const { lookup: cachedLookupCustomers, stats: cariCacheStats } = useLookupCache(
    lookupPhase3Customers,
    30000,
    cariLookupRetryKey,
    "cari",
  );
  const { lookup: cachedLookupStocks, stats: stokCacheStats } = useLookupCache(
    lookupPhase3Stocks,
    30000,
    stokLookupRetryKey,
    "stok",
  );

  // Türetilmiş değerler

  const blocker = calcBlocker(cari, rows, generalFireAciklamasi);
  const unmatchedN = calcUnmatched(rows);
  const selectedRows = rows.filter((r) => selectedRowNos.has(r.siraNo));
  const activeRow = activeRowNo !== null ? (rows.find((r) => r.siraNo === activeRowNo) ?? null) : null;
  const fireMissing = calcFireMissing(rows, generalFireAciklamasi);
  const criticalMergeGroups = calcCriticalMergeGroupCount(rows);
  const criticalMergeRows = calcCriticalMergeRowNos(rows);
  const mergeBlocker = !isMergeCompatible(selectedRows);
  const mergeBekleyen = mergeBekleyenSayisi(rows);
  const satirlarAktifPlaka = rows.filter((r) => r.plakaRef === activePlateRef);
  const visibleRows = satirlarAktifPlaka.length > 0 ? satirlarAktifPlaka : rows;
  const effectiveCustomerBlocker = dataMode === "live" && liveSummary ? liveSummary.customerBlocker : cari.durum === "unmatched";
  const effectiveUnmatchedN = dataMode === "live" && liveSummary ? liveSummary.stockBlockerCount : unmatchedN;
  const effectiveFireMissing = dataMode === "live" && liveSummary ? liveSummary.scrapNoteMissingCount : fireMissing;
  const effectiveMergeBekleyen = dataMode === "live" && liveSummary ? liveSummary.mergePendingCount : mergeBekleyen;
  const effectiveBlocker = dataMode === "live" && liveSummary ? !liveSummary.phase4Ready : blocker;
  const saveActionBlocked = saving || !activeRecord;
  const missingLiveRecordContext = dataMode === "live" && (!activeRecord || !activeRecordId);
  const phase4ActionBlocked = saving || effectiveBlocker || missingLiveRecordContext;
  const effectiveMatchedN = Math.max(0, rows.length - effectiveUnmatchedN);
  const exportBlockerReasons = [
    effectiveCustomerBlocker ? "Cari eşleşmesi eksik" : "",
    effectiveUnmatchedN > 0 ? `${effectiveUnmatchedN} satırda stok eşleşmesi eksik` : "",
    effectiveFireMissing > 0 ? `Genel fire açıklaması eksik (${effectiveFireMissing} satır etkileniyor)` : "",
    effectiveMergeBekleyen > 0 ? `${effectiveMergeBekleyen} kritik merge grubu bekliyor` : "",
  ].filter(Boolean);
  const blockerResolutionSteps = [
    effectiveCustomerBlocker ? "Cari eşleştirmesini tamamla" : "",
    effectiveUnmatchedN > 0 ? `${effectiveUnmatchedN} satır için stok eşleşmesi yap` : "",
    effectiveFireMissing > 0 ? "Genel fire açıklamasını doldur" : "",
    effectiveMergeBekleyen > 0 ? "Kritik merge gruplarını kapat" : "",
  ].filter(Boolean);

  function showSaveFeedback(message: string, tone: SaveFeedbackTone, timeoutMs = 2500) {
    if (saveMsgTimerRef.current !== null) {
      window.clearTimeout(saveMsgTimerRef.current);
    }
    setSaveMsg(message);
    setSaveTone(tone);
    if (timeoutMs > 0) {
      saveMsgTimerRef.current = window.setTimeout(() => {
        setSaveMsg("");
        setSaveTone("info");
        saveMsgTimerRef.current = null;
      }, timeoutMs);
      return;
    }
    saveMsgTimerRef.current = null;
  }

  function closeCariDrawer() {
    setShowCariModal(false);
    setCariSearch("");
    setCariMatches(CARI_MATCHES);
    setCariLookupState("idle");
    setLookupLoading(false);
    setLookupBusyContext((current) =>
      current === "cari-search" || current === "cari-submit" ? null : current,
    );
  }

  function closeStokDrawer() {
    setShowStokDrawer(false);
    setStokSearch("");
    setStokTargetRowNo(null);
    setStokMatches(STOK_MATCHES);
    setStokLookupState("idle");
    setLookupLoading(false);
    setLookupBusyContext((current) =>
      current === "stok-search" || current === "stok-submit" ? null : current,
    );
  }

  function retryCariLookup() {
    if (!showCariModal || !cariSearch.trim() || lookupLoading || lookupBusyContext === "cari-submit") return;
    setCariLookupRetryKey((current) => current + 1);
  }

  function retryStokLookup() {
    if (!showStokDrawer || !stokSearch.trim() || lookupLoading || lookupBusyContext === "stok-submit") return;
    setStokLookupRetryKey((current) => current + 1);
  }

  const normalizedCariSearch = useMemo(() => cariSearch.toLowerCase(), [cariSearch]);
  const normalizedStokSearch = useMemo(() => stokSearch.toLowerCase(), [stokSearch]);

  const filteredCari = useMemo(() => {
    if (!cariSearch) return cariMatches;
    return cariMatches.filter(
      (m) =>
        m.cariKodu.toLowerCase().includes(normalizedCariSearch) ||
        m.cariUnvan.toLowerCase().includes(normalizedCariSearch),
    );
  }, [cariMatches, cariSearch, normalizedCariSearch]);

  const filteredStok = useMemo(() => {
    if (!stokSearch) return stokMatches;
    return stokMatches.filter(
      (m) =>
        m.stokKodu.toLowerCase().includes(normalizedStokSearch) ||
        m.stokAdi.toLowerCase().includes(normalizedStokSearch),
    );
  }, [stokMatches, stokSearch, normalizedStokSearch]);

  const uygunStoklar = useMemo(() => {
    if (!stokSearch) return filteredStok;
    return filteredStok.filter((m) =>
      m.stokKodu.toLowerCase().startsWith(normalizedStokSearch) ||
      m.stokAdi.toLowerCase().startsWith(normalizedStokSearch)
    );
  }, [filteredStok, stokSearch, normalizedStokSearch]);

  const benzerStoklar = useMemo(() => filteredStok.filter((m) => !uygunStoklar.includes(m)), [filteredStok, uygunStoklar]);
  const sortedLiveRecords = [...recordsList].sort((left, right) => {
    const statusDiff = recordStatusPriority(left.dosyaDurumu) - recordStatusPriority(right.dosyaDurumu);
    if (statusDiff !== 0) return statusDiff;
    const leftTs = new Date(left.gelisTarihi ?? 0).getTime();
    const rightTs = new Date(right.gelisTarihi ?? 0).getTime();
    return rightTs - leftTs;
  });
  const activeRecordSummary = activeRecord ? recordSelectorSummary(activeRecord) : null;
  const activeHealthTone = activeRecordSummary
    ? activeRecordSummary.eksikStok > 0 || activeRecordSummary.fireEksik > 0
      ? "risk"
      : "ok"
    : "neutral";
  const SaveFeedbackIcon =
    saveTone === "error" || saveTone === "warning"
      ? AlertTriangle
      : saveTone === "success"
      ? CheckCircle2
      : FileText;
  const saveFeedbackIconClassName =
    saveTone === "error"
      ? "text-red-400"
      : saveTone === "warning"
      ? "text-amber-400"
      : saveTone === "success"
      ? "text-emerald-400"
      : "text-blue-400";
  const saveFeedbackTextClassName =
    saveTone === "error"
      ? "text-xs font-medium text-red-400"
      : saveTone === "warning"
      ? "text-xs font-medium text-amber-400"
      : saveTone === "success"
      ? "text-xs font-medium text-emerald-400"
      : "text-xs font-medium text-blue-300";

  // Canlı veri yükleme

  async function loadLiveData(targetRecordUuid?: string, options: LoadLiveDataOptions = {}): Promise<Phase3RecordDetail | null> {
    setLoading(true);
    setLoadError("");
    try {
      const queue = await getPhase3Queue();
      const queueItems = queue.items ?? [];
      if (queueItems.length === 0) {
        setDataMode("live");
        setRecordsList([]);
        setSelectedRecordUuid("");
        setActiveRecordId("");
        setActiveRecord(null);
        setServiceRows([]);
        setRows([]);
        setLiveSummary(null);
        setActiveOperatorName(null);
        setCari({ durum: "unmatched", cariKodu: null, cariUnvan: null, telefon: null });
        setPlates([]);
        setActivePlateRef("P1");
        setGeneralFireAciklamasi("");
        setSelectedRowNos(new Set());
        setActiveRowNo(null);
        setLoadError("Phase 3 kuyruğunda kayıt bulunamadı");
        return null;
      }
      setRecordsList(queueItems.map((item) => toLegacyWorkflowRecordFromPhase3(item)));

      const target =
        queueItems.find((item) => item.uuid === targetRecordUuid) ??
        queueItems.find((item) => item.uuid === selectedRecordUuid) ??
        queueItems.find((item) => item.status === "PHASE3_IN_PROGRESS") ??
        queueItems[0];
      const detail = await getPhase3RecordDetail(target.recordId);
      const full = toLegacyWorkflowRecordFromPhase3(target, detail, options.preserveGeneralFireAciklamasi ?? "");
      const uiRows = toUiRowsFromPhase3Detail(detail);

      setDataMode("live");
      setSelectedRecordUuid(target.uuid);
      setActiveRecordId(target.recordId);
      setActiveRecord(full);
      setServiceRows(full.satirlar ?? []);
      setRows(uiRows);
      setLiveSummary(detail.summary);
      setActiveOperatorName(detail.header.operatorName ?? null);
      setCari({
        durum: detail.header.customerCode?.trim() ? "matched" : "unmatched",
        cariKodu: detail.header.customerCode || null,
        cariUnvan: detail.header.customerName || null,
        telefon: detail.header.customerPhone || null,
      });
      setPlates(
        detail.plateGroups.map((plate) => ({
          plakaRef: plate.plateId,
          etiket: plate.label,
          satirSayisi: plate.lineCount,
          hasBlocker: plate.blockerCount > 0,
        })),
      );
      setActivePlateRef(detail.plateGroups[0]?.plateId ?? "P1");
      setGeneralFireAciklamasi(full.fireAciklamasi ?? "");
      setLastOperatorAction(`Canlı kayıt açıldı (${target.recordId.slice(0, 8)})`);
      if (options.successFeedback) {
        showSaveFeedback(
          options.successFeedback.message,
          options.successFeedback.tone,
          options.successFeedback.timeoutMs ?? 2500,
        );
      } else if (!options.suppressDefaultSuccess) {
        showSaveFeedback(`Canlı kayıt yüklendi: ${target.recordId.slice(0, 8)}`, "info", 2000);
      }
      return detail;
    } catch (error) {
      if (isDevBuild) {
        const fallback = buildScenarioData("A");
        setDataMode("demo");
        setRecordsList([]);
        setSelectedRecordUuid("");
        setActiveRecordId("");
        setActiveRecord(null);
        setServiceRows([]);
        setLiveSummary(null);
        setActiveOperatorName(null);
        setRows(fallback.rows);
        setCari(fallback.cari);
        setPlates(fallback.plates);
        setGeneralFireAciklamasi("");
        setLoadError("");
        showSaveFeedback(
            error instanceof Error
              ? `Canlı veri alınamadı (${error.message}). Yedek veri gösteriliyor.`
              : "Canlı veri alınamadı. Yedek veri gösteriliyor.",
            "warning",
            3500,
          );
      } else {
        setLoadError(
          error instanceof Error
            ? `Canlı veri alınamadı: ${error.message}`
            : "Canlı veri alınamadı.",
        );
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLiveData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Senaryo değişimi

  useEffect(() => {
    if (dataMode !== "demo") return;
    const data = buildScenarioData(activeScenario);
    setActiveRecord(null);
    setServiceRows([]);
    setLiveSummary(null);
    setActiveOperatorName(null);
    setRows(data.rows);
    setCari(data.cari);
    setPlates(data.plates);
    setGeneralFireAciklamasi("");
    setSelectedRowNos(new Set());
    setActiveRowNo(null);
    setShowCariModal(false);
    setShowStokDrawer(false);
    setShowFireModal(false);
    setShowMergeModal(false);
    setShowRowDetail(false);
    setCariSearch("");
    setStokSearch("");
    setMergeHistory([]);
    setLastOperatorAction(`Demo senaryo değişti (${activeScenario})`);
  }, [activeScenario, dataMode]);

  useEffect(() => {
    if (dataMode !== "live") return;
    if (!selectedRecordUuid) return;
    if (activeRecord?.kayitUuid === selectedRecordUuid) return;
    void loadLiveData(selectedRecordUuid, { suppressDefaultSuccess: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRecordUuid, dataMode, activeRecord?.kayitUuid]);

  useEffect(() => {
    return () => {
      if (saveMsgTimerRef.current !== null) {
        window.clearTimeout(saveMsgTimerRef.current);
      }
    };
  }, []);

  // Klavye: Escape ile modal kapatma

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (showCariModal) {
        if (lookupBusyContext !== "cari-submit") closeCariDrawer();
        return;
      }
      if (showStokDrawer) {
        if (lookupBusyContext !== "stok-submit") closeStokDrawer();
        return;
      }
      if (showFireModal) { setShowFireModal(false); return; }
      if (showMergeModal) { setShowMergeModal(false); return; }
      if (showRowDetail) { setShowRowDetail(false); return; }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [showCariModal, showStokDrawer, showFireModal, showMergeModal, showRowDetail, lookupBusyContext]);

  // Modal auto-focus

  useEffect(() => {
    if (showCariModal) setTimeout(() => cariSearchRef.current?.focus(), 50);
  }, [showCariModal]);
  useEffect(() => {
    if (showStokDrawer) setTimeout(() => stokSearchRef.current?.focus(), 50);
  }, [showStokDrawer]);
  useEffect(() => {
    if (showFireModal) setTimeout(() => fireInputRef.current?.focus(), 50);
  }, [showFireModal]);

  useEffect(() => {
    if (!showCariModal) return;
    const normalizedCariSearch = cariSearch.trim();
    if (!normalizedCariSearch) {
      setCariMatches(CARI_MATCHES);
      setCariLookupState("idle");
      setLookupLoading(false);
      setLookupBusyContext(null);
      return;
    }
    if (normalizedCariSearch.length < LOOKUP_MIN_QUERY_LENGTH) {
      setCariLookupState("idle");
      setLookupLoading(false);
      setLookupBusyContext(null);
      return;
    }
    if (dataMode !== "live") {
      setLookupLoading(false);
      setLookupBusyContext(null);
      setCariLookupState("idle");
      return;
    }
    setLookupLoading(true);
    setLookupBusyContext("cari-search");
    setCariLookupState("loading");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const items = await cachedLookupCustomers(normalizedCariSearch);
        if (cancelled) return;
        if (items.length > 0) {
          setCariMatches(
            items.map((item: WorkflowLookupCustomer) => ({
              cariKodu: item.cariKodu,
              cariUnvan: item.cariUnvan,
              telefon: item.telefon,
            })),
          );
          setCariLookupState("results");
        } else {
          setCariMatches([]);
          setCariLookupState("empty");
        }
      } catch {
        if (cancelled) return;
        setCariMatches(CARI_MATCHES);
        setCariLookupState("fallback");
      } finally {
        if (!cancelled) {
          setLookupLoading(false);
          setLookupBusyContext(null);
        }
      }
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showCariModal, cariSearch, dataMode, cariLookupRetryKey]);

  useEffect(() => {
    if (!showStokDrawer) return;
    const normalizedStokSearch = stokSearch.trim();
    if (!normalizedStokSearch) {
      setStokMatches(STOK_MATCHES);
      setStokLookupState("idle");
      setLookupLoading(false);
      setLookupBusyContext(null);
      return;
    }
    if (normalizedStokSearch.length < LOOKUP_MIN_QUERY_LENGTH) {
      setStokLookupState("idle");
      setLookupLoading(false);
      setLookupBusyContext(null);
      return;
    }
    if (dataMode !== "live") {
      setLookupLoading(false);
      setLookupBusyContext(null);
      setStokLookupState("idle");
      return;
    }
    setLookupLoading(true);
    setLookupBusyContext("stok-search");
    setStokLookupState("loading");
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const items = await cachedLookupStocks(normalizedStokSearch);
        if (cancelled) return;
        if (items.length > 0) {
          setStokMatches(
            items.map((item: WorkflowLookupStock) => ({
              stokKodu: item.stokKodu,
              stokAdi: item.stokAdi,
              kategori: "ERP",
              olcuKalinlik: "ERP / ölçü bilgisi",
            })),
          );
          setStokLookupState("results");
        } else {
          setStokMatches([]);
          setStokLookupState("empty");
        }
      } catch {
        if (cancelled) return;
        setStokMatches(STOK_MATCHES);
        setStokLookupState("fallback");
      } finally {
        if (!cancelled) {
          setLookupLoading(false);
          setLookupBusyContext(null);
        }
      }
    }, LOOKUP_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [showStokDrawer, stokSearch, dataMode, stokLookupRetryKey]);

  // Handler'lar

  function toggleRowSelect(siraNo: number) {
    setSelectedRowNos((prev) => {
      const next = new Set(prev);
      if (next.has(siraNo)) next.delete(siraNo);
      else next.add(siraNo);
      return next;
    });
    setActiveRowNo(siraNo);
  }

  async function selectCari(match: CariMatch) {
    if (dataMode === "live" && activeRecordId) {
      try {
        setLookupLoading(true);
        setLookupBusyContext("cari-submit");
        await matchPhase3Customer(activeRecordId, match.cariKodu);
        setLastOperatorAction(`Cari bağlandı: ${match.cariKodu}`);
        closeCariDrawer();
        await loadLiveData(selectedRecordUuid || undefined, {
          successFeedback: {
            message: `Cari bağlandı: ${match.cariKodu}`,
            tone: "success",
          },
          preserveGeneralFireAciklamasi: generalFireAciklamasi,
        });
      } catch (error) {
        showSaveFeedback(error instanceof Error ? `Cari eşleştirme hatası: ${error.message}` : "Cari eşleştirme hatası", "error", 2500);
      } finally {
        setLookupLoading(false);
        setLookupBusyContext(null);
      }
      return;
    }

    setCari({ durum: "matched", cariKodu: match.cariKodu, cariUnvan: match.cariUnvan, telefon: match.telefon });
    setLastOperatorAction(`Cari bağlandı: ${match.cariKodu}`);
    closeCariDrawer();
  }

  function openStokDrawer(siraNo: number) {
    setStokTargetRowNo(siraNo);
    setStokSearch("");
    setShowStokDrawer(true);
  }

  async function selectStok(match: StokMatch) {
    if (stokTargetRowNo === null) return;

    if (dataMode === "live" && activeRecordId) {
      try {
        setLookupLoading(true);
        setLookupBusyContext("stok-submit");
        await matchPhase3Stock(activeRecordId, toPhase3BackendRowIndex(stokTargetRowNo), match.stokKodu);
        setLastOperatorAction(`Satır #${stokTargetRowNo} stok eşleşti: ${match.stokKodu}`);
        closeStokDrawer();
        await loadLiveData(selectedRecordUuid || undefined, {
          successFeedback: {
            message: `Satır #${stokTargetRowNo} stok eşleşti: ${match.stokKodu}`,
            tone: "success",
          },
          preserveGeneralFireAciklamasi: generalFireAciklamasi,
        });
      } catch (error) {
        showSaveFeedback(error instanceof Error ? `Stok eşleştirme hatası: ${error.message}` : "Stok eşleştirme hatası", "error", 2500);
      } finally {
        setLookupLoading(false);
        setLookupBusyContext(null);
      }
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        r.siraNo === stokTargetRowNo
          ? { ...r, malzeme: match.stokAdi, erpStokKodu: match.stokKodu, malzemeEslesmeDurumu: "matched" }
          : r,
      ),
    );
    setLastOperatorAction(`Satır #${stokTargetRowNo} stok eşleşti: ${match.stokKodu}`);
    closeStokDrawer();
  }

  async function saveGeneralFireAciklamasi(aciklama: string) {
    if (dataMode === "live" && activeRecordId) {
      try {
        setSaving(true);
        await addPhase3ScrapNote(activeRecordId, aciklama);
        setGeneralFireAciklamasi(aciklama);
        setLastOperatorAction("Genel fire açıklaması güncellendi");
        setShowFireModal(false);
        await loadLiveData(selectedRecordUuid || undefined, {
          successFeedback: {
            message: "Genel fire açıklaması güncellendi",
            tone: "success",
          },
          preserveGeneralFireAciklamasi: aciklama,
        });
      } catch (error) {
        showSaveFeedback(error instanceof Error ? `Fire açıklaması kaydedilemedi: ${error.message}` : "Fire açıklaması kaydedilemedi", "error", 2500);
      } finally {
        setSaving(false);
      }
      return;
    }

    setGeneralFireAciklamasi(aciklama);
    setLastOperatorAction("Genel fire açıklaması güncellendi");
    setShowFireModal(false);
  }

  async function handleMergeConfirmWithNote(operatorNotu: string) {
    const mergedCount = selectedRowNos.size;

    if (dataMode === "live" && activeRecordId) {
      try {
        setSaving(true);
        await mergePhase3Rows(
          activeRecordId,
          selectedRows.map((row) => toPhase3BackendRowIndex(row.siraNo)),
        );
        setMergeHistory((prev) => [
          `${new Date().toLocaleString("tr-TR")}: ${mergedCount} satır birleştirildi${operatorNotu.trim() ? ` (${operatorNotu.trim()})` : ""}`,
          ...prev,
        ]);
        setLastOperatorAction(`${mergedCount} satır birleştirildi`);
        setSelectedRowNos(new Set());
        setShowMergeModal(false);
        await loadLiveData(selectedRecordUuid || undefined, {
          successFeedback: {
            message: `${mergedCount} satır birleştirildi`,
            tone: "success",
          },
          preserveGeneralFireAciklamasi: generalFireAciklamasi,
        });
      } catch (error) {
        showSaveFeedback(error instanceof Error ? `Birleştirme hatası: ${error.message}` : "Birleştirme hatası", "error", 2500);
      } finally {
        setSaving(false);
      }
      return;
    }

    setRows((prev) =>
      prev.map((r) =>
        selectedRowNos.has(r.siraNo)
          ? {
              ...r,
              merged: true,
              ilaveAciklama: operatorNotu.trim()
                ? `Merge Notu: ${operatorNotu.trim()}`
                : r.ilaveAciklama,
            }
          : r,
      ),
    );
    setMergeHistory((prev) => [
      `${new Date().toLocaleString("tr-TR")}: ${mergedCount} satır birleştirildi${operatorNotu.trim() ? ` (${operatorNotu.trim()})` : ""}`,
      ...prev,
    ]);
    setLastOperatorAction(`${mergedCount} satır birleştirildi`);
    setSelectedRowNos(new Set());
    setShowMergeModal(false);
  }

  async function handleSave() {
    if (!activeRecord) {
      showSaveFeedback("Yedek veri modunda kaydetme yapılamaz", "warning", 2000);
      return;
    }

    setSaving(true);
    try {
      const rowMap = new Map(serviceRows.map((row) => [row.satirSirasi, row]));
      const payloadRows: WorkflowRow[] = rows.map((row, index) => {
        const source = rowMap.get(row.siraNo);
        const grain: WorkflowGrain = row.yon === "Boy" ? 1 : row.yon === "En" ? 2 : 0;

        return {
          id: source?.id ?? `ui-${row.siraNo}`,
          satirSirasi: row.siraNo || index + 1,
          malzeme: row.malzeme,
          boy: row.boy,
          en: row.en,
          adet: row.adet,
          grain,
          bilgi: row.aciklama,
          u1: Boolean(row.u1),
          u2: Boolean(row.u2),
          k1: Boolean(row.k1),
          k2: Boolean(row.k2),
          delik1: row.ilaveAciklama,
          delik2: row.aciklama1,
          satirKaynagi: row.satirKaynagi,
          plakaRef: row.plakaRef,
          bantKalinligiOverride: (source?.bantKalinligiOverride ?? "") as WorkflowBandThickness,
          hucreGuvenSkorlari: source?.hucreGuvenSkorlari ?? {},
          satirGuvenSkorOzeti: source?.satirGuvenSkorOzeti ?? {},
          boyOnay: source?.boyOnay ?? "BEKLEMEDE",
          enOnay: source?.enOnay ?? "BEKLEMEDE",
          adetOnay: source?.adetOnay ?? "BEKLEMEDE",
          boyOperatorDegeri: source?.boyOperatorDegeri ?? null,
          enOperatorDegeri: source?.enOperatorDegeri ?? null,
          adetOperatorDegeri: source?.adetOperatorDegeri ?? null,
          onaylayanId: source?.onaylayanId ?? null,
          onayZamani: source?.onayZamani ?? null,
          bboxJson: source?.bboxJson ?? null,
        };
      });

      const payloadPlates: WorkflowPlate[] = plates.map((plate) => ({
        id: plate.plakaRef,
        plakaRef: plate.plakaRef,
        etiket: plate.etiket,
        plakaBoyMm: activeRecord.plakaBoyMm ?? 2800,
        plakaEnMm: activeRecord.plakaEnMm ?? 2100,
        genelListedeMi: false,
      }));

      const updated = await updatePhase3Draft(activeRecord.kayitUuid, {
        cariUnvan: cari.cariUnvan ?? "",
        cariKodu: cari.cariKodu ?? "",
        siparisNo: activeRecord.siparisNo ?? "",
        termin: activeRecord.termin ?? "",
        teslimTarihi: activeRecord.teslimTarihi ?? "",
        teslimatAdresi: activeRecord.teslimatAdresi ?? "",
        odemeSekli: activeRecord.odemeSekli ?? "",
        malzeme: activeRecord.malzeme ?? "",
        stokKodu: activeRecord.stokKodu ?? "",
        bantKalinligi: (activeRecord.bantKalinligi ?? "") as WorkflowBandThickness,
        grainVarsayilan: (activeRecord.grainVarsayilan ?? 0) as WorkflowGrain,
        plakaBoyMm: activeRecord.plakaBoyMm ?? null,
        plakaEnMm: activeRecord.plakaEnMm ?? null,
        fireAciklamasi: generalFireAciklamasi,
        rows: payloadRows,
        plates: payloadPlates,
      });

      setActiveRecord(updated);
      setServiceRows(updated.satirlar ?? []);
      const refreshedDetail = await loadLiveData(selectedRecordUuid || undefined, {
        suppressDefaultSuccess: true,
        preserveGeneralFireAciklamasi: generalFireAciklamasi,
      });
      const nextBlocker = refreshedDetail ? !refreshedDetail.summary.phase4Ready : effectiveBlocker;
      showSaveFeedback(
        nextBlocker ? "Taslak kaydedildi; blockerlar devam ediyor" : "Taslak kaydedildi; blocker görünmüyor",
        nextBlocker ? "warning" : "success",
        3000,
      );
    } catch (error) {
      showSaveFeedback(error instanceof Error ? `Kaydetme hatası: ${error.message}` : "Kaydetme hatası", "error", 3000);
    } finally {
      setSaving(false);

    }
  }

  async function handleGoPhase4() {
    if (saving) return;
    if (missingLiveRecordContext) {
      showSaveFeedback("Aktif canlı kayıt yüklenmeden Phase 4'e geçilemez", "warning", 2500);
      return;
    }
    if (effectiveBlocker) {
      showSaveFeedback(
        `Hard blocker çözülmeden export yapılamaz: ${exportBlockerReasons.join(" ⬢ ") || "Eksik doğrulamalar"}`,
        "warning",
        2500,
      );
      return;
    }

    if (dataMode === "live" && activeRecordId) {
      try {
        setSaving(true);
        const result = await movePhase3ToPhase4(activeRecordId);
        if (!result.ok) {
          showSaveFeedback(result.message ?? "Phase 4 geçişi backend tarafından reddedildi", "warning", 2500);
          return;
        }
        navigateToAppPage("optiplan-job");
      } catch (error) {
        showSaveFeedback(error instanceof Error ? `Phase 4 geçiş hatası: ${error.message}` : "Phase 4 geçiş hatası", "error", 2500);
      } finally {
        setSaving(false);
      }
      return;
    }

    // Önce mevcut durumu kaydet, ardından Phase 4 sayfasına geç
    await handleSave();
    navigateToAppPage("optiplan-job");
  }

  async function handleRefresh() {
    setLoadError("");
    await loadLiveData(undefined, {
      successFeedback: {
        message: "Canlı kayıt yenilendi",
        tone: "info",
        timeoutMs: 2000,
      },
      preserveGeneralFireAciklamasi: generalFireAciklamasi,
    });
  }

  function handleResetSelectedRows() {
    if (selectedRowNos.size === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        selectedRowNos.has(r.siraNo)
          ? {
              ...r,
              merged: false,
              fireAciklamasi: "",
              ilaveAciklama: "",
              aciklama1: "",
            }
          : r,
      ),
    );
    setLastOperatorAction(`${selectedRowNos.size} satır sıfırlandı`);
    showSaveFeedback(`${selectedRowNos.size} satır sıfırlandı`, "info", 2000);
  }

  // Loading state

  if (loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 text-slate-400 gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
        <span className="text-sm">Sipariş verileri yükleniyor⬦</span>
      </div>
    );
  }

  // Error state

  if (loadError) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-slate-900 gap-3">
        <div className="flex items-center gap-3 border border-red-700/60 bg-red-900/30 px-6 py-4">
          <AlertTriangle className="h-5 w-5 text-red-400 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-400">Veri alınırken hata oluştu</p>
            <p className="text-xs text-red-400/70 mt-0.5">{loadError}</p>
          </div>
          <button
            type="button"
            onClick={() => void handleRefresh()}
            className="ml-4 border border-red-700 px-3 py-1 text-xs text-red-400 hover:bg-red-900/40 transition-colors"
          >
            Yeniden Dene
          </button>
        </div>
      </div>
    );
  }

  // Render

  return (
    <div className="h-full flex flex-col bg-slate-900 text-slate-200 text-sm select-none">

      {/* Dev araçları - yalnızca geliştirme ortamında */}
      {isDevBuild && (
        <div className="shrink-0 border-b border-slate-700/60 bg-slate-950/80 px-4 py-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-semibold uppercase text-slate-600 tracking-wider mr-1">DEV:</span>
            <button
              type="button"
              onClick={() => {
                setDataMode("live");
                void loadLiveData(selectedRecordUuid || undefined, {
                  preserveGeneralFireAciklamasi: generalFireAciklamasi,
                });
              }}
              className={`border px-2 py-0.5 text-[10px] font-semibold ${
                dataMode === "live"
                  ? "border-emerald-600/70 bg-emerald-900/30 text-emerald-300"
                  : "border-slate-700 bg-slate-800 text-slate-500"
              }`}
            >
              Canlı
            </button>
            <button
              type="button"
              onClick={() => setDataMode("demo")}
              className={`border px-2 py-0.5 text-[10px] font-semibold ${
                dataMode === "demo"
                  ? "border-blue-500 bg-blue-600/30 text-blue-300"
                  : "border-slate-700 bg-slate-800 text-slate-500"
              }`}
            >
              Demo
            </button>
            {dataMode === "demo" && (
              <>
                <span className="ml-2 text-[10px] font-semibold uppercase text-slate-600 tracking-wider mr-1">
                  Senaryo:
                </span>
                {(["A", "B", "C", "D", "E"] as DemoScenario[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setActiveScenario(s)}
                    title={SCENARIO_LABELS[s]}
                    className={`border px-2.5 py-0.5 text-[10px] font-semibold transition-colors ${
                      activeScenario === s
                        ? "border-blue-500 bg-blue-600/30 text-blue-300"
                        : "border-slate-700 bg-slate-800 text-slate-500 hover:border-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {s}
                  </button>
                ))}
                <span className="ml-1 text-[10px] text-slate-600">{SCENARIO_LABELS[activeScenario]}</span>
                <button
                  type="button"
                  onClick={() => setLoadError("Bağlantı zaman aşımına uğradı (demo)")}
                  title="Hata state'ini tetikle"
                  className="ml-auto border border-slate-700 px-2 py-0.5 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
                >
                  Hata Tetikle
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <header className="shrink-0 border-b border-slate-700 bg-slate-800 px-4 py-2.5">
        <div className="flex items-center justify-between gap-4">
          {/* Sol: Başlık + Kayıt Seçici */}
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
            <h1 className="text-sm font-bold text-slate-100 tracking-tight whitespace-nowrap">
              Sipariş Kontrol &amp; ERP Eşleştirme
            </h1>
            {/* Aktif kayıt seçici — her zaman görünür */}
            {sortedLiveRecords.length > 0 && dataMode === "live" && (
              <select
                value={selectedRecordUuid}
                onChange={(e) => setSelectedRecordUuid(e.target.value)}
                aria-label="Aktif kayıt seç"
                className="border border-slate-600 bg-slate-700 px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-blue-500 max-w-[260px]"
              >
                {sortedLiveRecords.map((record) => {
                  const summary = recordSelectorSummary(record);
                  return (
                    <option key={record.kayitUuid} value={record.kayitUuid}>
                      {record.siparisNo || record.hamDosyaAdi} ⬢ S:{summary.eksikStok} F:{summary.fireEksik}
                    </option>
                  );
                })}
              </select>
            )}
            {activeRecord && (
              <span
                className={`border px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${
                  activeHealthTone === "ok"
                    ? "border-emerald-600/60 bg-emerald-900/25 text-emerald-300"
                    : activeHealthTone === "risk"
                    ? "border-red-700/60 bg-red-900/20 text-red-300"
                    : "border-slate-600 bg-slate-800 text-slate-400"
                }`}
                title={`Durum: ${activeRecord.dosyaDurumu} | Faz: ${activeRecord.aktifFaz}`}
              >
                {activeRecord.dosyaDurumu} ⬢ F{activeRecord.aktifFaz}
              </span>
            )}
          </div>

          {/* Sağ: Mikro Cari Eşleşmesi kartı */}
          <button
            type="button"
            onClick={() => setShowCariModal(true)}
            aria-label={`Cari eşleşmesi: ${cari.durum === "matched" ? cari.cariKodu ?? "" : "Eşleşme yok"}. Değiştirmek için tıkla.`}
            title="Cari eşleşmesini değiştir"
            className={`flex items-center gap-2.5 border px-3 py-1.5 transition-colors hover:opacity-90 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
              cari.durum === "matched"
                ? "border-emerald-500/50 bg-emerald-900/30"
                : "border-red-500/50 bg-red-900/40"
            }`}
          >
            {cari.durum === "matched" ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" aria-hidden="true" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" aria-hidden="true" />
            )}
            <div className="flex flex-col items-start leading-tight">
              <span className="text-xs text-slate-400">Mikro Cari Eşleşmesi</span>
              {cari.durum === "matched" ? (
                <span className="text-xs font-semibold text-emerald-300">{cari.cariKodu}</span>
              ) : (
                <span className="text-xs font-semibold text-red-300">Eşleşme Yok</span>
              )}
            </div>
            {cari.durum === "matched" && (
              <MiniBadge label="Cari OK" variant="emerald" />
            )}
            <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </header>

      {/* Ribbon — 5 sekme: KAYIT, CARİ, SATIR, KONTROL, İŞ EMRİ */}
      <SiparisKontrolRibbon
        activeTab={ribbonTab}
        onTabChange={setRibbonTab}
        saving={saving}
        selectedCount={selectedRowNos.size}
        disabledActions={new Set([
          ...(saveActionBlocked ? ["save"] : []),
          ...(activeRowNo === null && selectedRowNos.size === 0 ? ["stokSearch"] : []),
          ...(mergeBlocker ? ["merge"] : []),
          ...(activeRowNo === null ? ["detail"] : []),
          ...(phase4ActionBlocked ? ["goPhase4"] : []),
        ])}
        onAction={(key) => {
          switch (key) {
            case "save": void handleSave(); break;
            case "refresh": handleRefresh(); break;
            case "revision":
              setRibbonTab("KAYIT");
              setShowRowDetail(true);
              showSaveFeedback("Revizyon/detay paneli açıldı.", "info", 1800);
              break;
            case "history":
              setShowRowDetail(true);
              showSaveFeedback("Satır detay paneli açıldı.", "info", 1500);
              break;
            case "cariSearch": setShowCariModal(true); break;
            case "cariMatch":
              setShowCariModal(true);
              showSaveFeedback("Cari eşleştirme için listeden bir cari seçin.", "info");
              break;
            case "cariNew":
              setShowCariModal(true);
              showSaveFeedback("Yeni cari oluşturma bu ekranda desteklenmiyor; ERP'de kart açıp tekrar eşleştirin.", "warning", 4000);
              break;
            case "stokSearch": {
              const target = activeRowNo ?? selectedRows[0]?.siraNo ?? null;
              if (target !== null) openStokDrawer(target);
              break;
            }
            case "merge": setShowMergeModal(true); break;
            case "reset": handleResetSelectedRows(); break;
            case "detail": if (activeRowNo !== null) setShowRowDetail(true); break;
            case "addRow": {
              const nextSiraNo = rows.length > 0 ? Math.max(...rows.map((row) => row.siraNo)) + 1 : 1;
              const nextRow: SiparisRow = {
                siraNo: nextSiraNo,
                malzeme: "",
                malzemeEslesmeDurumu: "unmatched",
                erpStokKodu: null,
                boy: 0,
                en: 0,
                adet: 1,
                yon: "Boy",
                aciklama: "",
                u1: 0,
                u2: 0,
                k1: 0,
                k2: 0,
                ilaveAciklama: "",
                aciklama1: "",
                fireAciklamasi: "",
                merged: false,
                plakaRef: activePlateRef,
                satirKaynagi: "MANUAL",
              };
              setRows((prev) => [...prev, nextRow]);
              setActiveRowNo(nextSiraNo);
              setSelectedRowNos(new Set([nextSiraNo]));
              setLastOperatorAction("Yeni satır eklendi");
              showSaveFeedback("Yeni satır eklendi.", "success", 2200);
              break;
            }
            case "validate":
              if (effectiveBlocker) {
                showSaveFeedback(
                  `Doğrulama başarısız: ${exportBlockerReasons.join(" ⬢ ") || "Eksik doğrulamalar"}`,
                  "warning",
                  4500,
                );
              } else {
                showSaveFeedback("Doğrulama başarılı: Phase 4 geçiş koşulları sağlandı.", "success", 2500);
              }
              break;
            case "fire": setShowFireModal(true); break;
            case "goPhase4": if (!phase4ActionBlocked) void handleGoPhase4(); break;
            case "preview":
              if (ribbonTab === "IS_EMRI") {
                navigateToAppPage("optiplan-job");
                showSaveFeedback("Önizleme için iş emri ekranına yönlendirildi.", "info", 2200);
              } else {
                setRibbonTab("IS_EMRI");
                showSaveFeedback("İş emri paneli açıldı. Önizleme için kayıt satırındaki göz ikonunu kullanın.", "info", 3000);
              }
              break;
            case "export":
              if (!phase4ActionBlocked) {
                void handleGoPhase4();
              } else {
                showSaveFeedback(
                  `Export başlatılamadı: ${exportBlockerReasons.join(" ⬢ ") || "Eksik doğrulamalar"}`,
                  "warning",
                  4500,
                );
              }
              break;
            case "retry":
              if (ribbonTab === "IS_EMRI") {
                navigateToAppPage("optiplan-job");
                showSaveFeedback("Retry için iş emri ekranına yönlendirildi.", "info", 2200);
              } else {
                setRibbonTab("IS_EMRI");
                showSaveFeedback("Retry için İş Emri panelini açtım; ilgili kayıtta tekrar dene aksiyonunu kullanın.", "info", 3000);
              }
              break;
            case "manifest":
              navigateToAppPage("optiplan-job");
              showSaveFeedback("Manifest ekranına yönlendirildi.", "info", 2000);
              break;
            case "jobStatus":
              navigateToAppPage("optiplan-job");
              showSaveFeedback("İş emri durum ekranına yönlendirildi.", "info", 2000);
              break;
            default:
              showSaveFeedback(`Aksiyon tanımsız: ${key}`, "warning", 2500);
              break;
          }
        }}
      />

      {/* InfoChip bandı */}
      <div className="shrink-0 border-b border-slate-700 bg-slate-800/80 px-4 py-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <InfoChip label="Sipariş No" value={activeRecord?.siparisNo || "SIP-2026-001"} />
          <InfoChip label="Kaynak" value={activeRecord?.hamDosyaAdi || "BELGE-123"} />
          <InfoChip label="Plaka" value={plates.length} />
          <InfoChip label="Satır" value={rows.length} />
          {unmatchedN > 0 && (
            <span
              className="border border-red-700/60 bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-400"
              title={`${unmatchedN} adet stok eşleşmesi eksik`}
            >
              {unmatchedN} Eşleşmemiş
            </span>
          )}
          {fireMissing > 0 && (
            <span
              className="border border-amber-700/60 bg-amber-900/20 px-2 py-0.5 text-xs font-medium text-amber-400"
              title={`Genel fire açıklaması eksik (${fireMissing} satır etkileniyor)`}
            >
              {fireMissing} Genel Fire Eksik
            </span>
          )}
          {selectedRowNos.size > 0 && (
            <span
              className="border border-blue-700/60 bg-blue-900/30 px-2 py-0.5 text-xs font-semibold text-blue-300"
              title="Seçili satır sayısı — toplu işlem aktif"
            >
              {selectedRowNos.size} seçildi
            </span>
          )}
        </div>
      </div>

      {/* Sipariş özeti / validasyon bandı */}
      <div className="shrink-0 border-b border-slate-700 bg-slate-800/50 px-4 py-2">
        <div className="flex items-start gap-6 flex-wrap">
          {/* Sipariş özeti */}
          <div className="flex items-center gap-4 flex-wrap">
            <SummaryField label="Mikro Cari Kodu" value={cari.cariKodu ?? "—"} />
            <SummaryField label="Cari Ünvanı" value={cari.cariUnvan ?? "Eşleşme bekleniyor"} />
            {(activeRecord?.okunanCariTelefon || cari.telefon) && (
              <SummaryField label="Telefon" value={activeRecord?.okunanCariTelefon || cari.telefon || "—"} />
            )}
            {activeOperatorName && <SummaryField label="Operatör" value={activeOperatorName} />}
            <SummaryField label="Toplam Kalem" value={rows.length} />
            <SummaryField label="Toplam Adet" value={totalAdet(rows)} />
            <SummaryField label="Farklı Malzeme" value={uniqueMalzeme(rows)} />
            <SummaryField label="OCR Kaynağı" value={activeRecord?.kaynakKlasor || "—"} />
            <SummaryField label="Son Güncelleme" value={formatDateTime(activeRecord?.sonGuncelleme || activeRecord?.gelisTarihi)} />
          </div>

          {/* Validation kutusu */}
          <div className="ml-auto border border-slate-600 bg-slate-800 px-3 py-2 min-w-[230px]">
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-slate-500">
              <SlidersHorizontal className="h-3 w-3" aria-hidden="true" />
              Validasyon Özeti
            </div>
            <div className="space-y-1">
              <ValidationItem
                label="Cari eşleşmesi"
                ok={!effectiveCustomerBlocker}
                value={effectiveCustomerBlocker ? "Eksik" : "Tamam"}
              />
              <ValidationItem
                label="Stok eşleşmeleri"
                ok={effectiveUnmatchedN === 0}
                value={`${effectiveMatchedN} tamam / ${effectiveUnmatchedN} eksik`}
              />
              <ValidationItem
                label="Genel fire"
                ok={effectiveFireMissing === 0}
                value={effectiveFireMissing > 0 ? String(effectiveFireMissing) : "—"}
              />
              <ValidationItem
                label="Export hazır"
                ok={!effectiveBlocker}
                value={effectiveBlocker ? "Hayır" : "Evet"}
              />
            </div>
            <ValidationItem
                label="Merge bekleyen"
                ok={effectiveMergeBekleyen === 0}
                value={effectiveMergeBekleyen > 0 ? String(effectiveMergeBekleyen) : "—"}
              />
            {blockerResolutionSteps.length > 0 && (
              <div className="mt-2 border border-amber-700/40 bg-amber-900/20 px-2 py-1.5">
                <div className="mb-1 text-[10px] font-semibold uppercase text-amber-300">Çözüm Sırası</div>
                <ol className="list-decimal space-y-0.5 pl-4 text-[11px] text-amber-200">
                  {blockerResolutionSteps.slice(0, 3).map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Çoklu plaka şeridi */}
      <div className="shrink-0 border-b border-slate-700 bg-slate-800/30 px-4 py-1.5">
        <div className="flex items-center gap-1.5" role="tablist" aria-label="Plaka seçimi">
          <Layers className="h-3.5 w-3.5 text-slate-500 shrink-0" aria-hidden="true" />
          <span className="text-[10px] text-slate-500 mr-1">Plakalar:</span>
          {plates.map((plate) => (
            <button
              key={plate.plakaRef}
              type="button"
              role="tab"
              aria-selected={activePlateRef === plate.plakaRef}
              onClick={() => setActivePlateRef(plate.plakaRef)}
              title={plate.hasBlocker ? `${plate.etiket} — Blocker var` : plate.etiket}
              className={`inline-flex items-center gap-1.5 border px-2 py-0.5 text-xs transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                activePlateRef === plate.plakaRef
                  ? "border-slate-400 bg-slate-700 font-medium text-white"
                  : plate.hasBlocker
                  ? "border-red-700/60 bg-red-900/20 text-red-400 hover:bg-red-900/30"
                  : "border-emerald-700/60 bg-emerald-900/20 text-emerald-400 hover:bg-emerald-900/30"
              }`}
            >
              {plate.hasBlocker ? (
                <AlertTriangle className="h-3 w-3" aria-label="Blocker var" />
              ) : (
                <CheckCircle2 className="h-3 w-3" aria-label="Sorunsuz" />
              )}
              <span>{plate.etiket}</span>
              <span className="text-[10px] opacity-60">({plate.satirSayisi})</span>
            </button>
          ))}
        </div>
      </div>

      {/* İŞ EMRİ sekmesi aktifken JobDashboardPanel göster */}
      {ribbonTab === "IS_EMRI" ? (
        <main className="flex-1 overflow-auto" aria-label="Is emri dashboard">
          <JobDashboardPanel
            preferredRecordId={selectedRecordUuid || null}
            compact
          />
        </main>
      ) : null}

      {/* Ana grid — IS_EMRI disindaki sekmelerde gorunur */}
      {ribbonTab !== "IS_EMRI" ? (
      <main className="flex-1 overflow-auto" aria-label="Sipariş satırları grid">
        <table className="w-full border-collapse whitespace-nowrap text-left">
          <thead className="sticky top-0 z-10 bg-slate-800">
            <tr>
              {[
                { key: "#", label: "#", cls: "w-10 text-center" },
                { key: "malzeme", label: "Malzeme / Material", cls: "min-w-[220px] text-left" },
                { key: "boy", label: "Boy", cls: "w-20 text-right" },
                { key: "en", label: "En", cls: "w-20 text-right" },
                { key: "adet", label: "Adet", cls: "w-16 text-right" },
                { key: "yon", label: "Yön", cls: "w-16 text-center" },
                { key: "aciklama", label: "Açıklama", cls: "min-w-[140px] text-left" },
                { key: "u1", label: "U1", cls: "w-16 text-right" },
                { key: "u2", label: "U2", cls: "w-16 text-right" },
                { key: "k1", label: "K1", cls: "w-16 text-right" },
                { key: "k2", label: "K2", cls: "w-16 text-right" },
                { key: "ilave", label: "İlave Açıklama", cls: "min-w-[130px] text-left" },
                { key: "aciklama1", label: "Açıklama 1", cls: "min-w-[100px] text-left" },
                { key: "durum", label: "Durum", cls: "w-28 text-center" },
              ].map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={`border-b border-r border-slate-700 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 ${col.cls}`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {visibleRows.length === 0 && (
              <tr>
                <td colSpan={14} className="px-4 py-8 text-center text-sm text-slate-500">
                  Gösterilecek sipariş satırı bulunamadı
                </td>
              </tr>
            )}

            {visibleRows.map((row) => {
              const isUnmatched = row.malzemeEslesmeDurumu === "unmatched";
              const isSelected = selectedRowNos.has(row.siraNo);
              const isActive = activeRowNo === row.siraNo;
              const fireRequired = satirFireAciklamasiZorunluMu(row) && !generalFireAciklamasi.trim();
              const isMerged = row.merged;
              const hasCriticalMerge = criticalMergeRows.has(row.siraNo);

              return (
                <tr
                  key={row.siraNo}
                  onClick={() => toggleRowSelect(row.siraNo)}
                  onDoubleClick={() => {
                    setActiveRowNo(row.siraNo);
                    setShowRowDetail(true);
                  }}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && toggleRowSelect(row.siraNo)}
                  aria-selected={isSelected}
                  role="row"
                  className={`cursor-pointer transition-colors focus:outline-none focus:ring-1 focus:ring-inset focus:ring-blue-500 ${
                    isSelected
                      ? "bg-blue-900/30 hover:bg-blue-900/40"
                      : isActive
                      ? "bg-slate-700/40"
                      : hasCriticalMerge
                      ? "bg-red-900/20 hover:bg-red-900/30"
                      : isMerged
                      ? "bg-purple-900/10 hover:bg-purple-900/20"
                      : isUnmatched
                      ? "bg-red-900/10 hover:bg-red-900/20"
                      : "hover:bg-slate-800/50"
                  }`}
                >
                  {/* # */}
                  <td className="border-b border-r border-slate-700 px-3 py-1 text-center text-slate-500 tabular-nums text-xs">
                    {isSelected ? (
                      <CheckCircle2 className="mx-auto h-3.5 w-3.5 text-blue-400" aria-label="Seçili" />
                    ) : (
                      row.siraNo
                    )}
                  </td>

                  {/* Malzeme */}
                  <td
                    className={`border-b border-r px-3 py-1 ${
                      isUnmatched ? "border-red-900/50 bg-red-900/20" : "border-slate-700"
                    }`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {isUnmatched ? (
                        <>
                          <span className="font-bold text-red-400">{row.malzeme}</span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openStokDrawer(row.siraNo); }}
                            className="p-0.5 text-red-400 hover:bg-red-900/40 hover:text-red-300 transition-colors focus:outline-none focus:ring-1 focus:ring-red-500"
                            title="Bu satır için stok eşleştir"
                            aria-label="Stok eşleştir"
                          >
                            <Search className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="text-emerald-400">{row.malzeme}</span>
                          {row.erpStokKodu && (
                            <span className="text-[10px] text-slate-500" title="ERP Stok Kodu">
                              [{row.erpStokKodu}]
                            </span>
                          )}
                        </>
                      )}
                      {row.merged && <MiniBadge label="Merge" variant="purple" />}
                      {hasCriticalMerge && <MiniBadge label="Merge Kritik" variant="red" />}
                      {generalFireAciklamasi.trim() && satirFireAciklamasiZorunluMu(row) && <MiniBadge label="Genel Fire" variant="amber" />}
                      {row.satirKaynagi === "MANUEL" && <MiniBadge label="Manuel" variant="blue" />}
                    </div>
                  </td>

                  {/* Sayısal kolonlar */}
                  <Td right>{row.boy}</Td>
                  <Td right>{row.en}</Td>
                  <Td right>{row.adet}</Td>

                  {/* Yön */}
                  <td className="border-b border-r border-slate-700 px-3 py-1 text-center text-slate-300 text-xs">
                    {row.yon}
                  </td>

                  {/* Açıklama */}
                  <td className="border-b border-r border-slate-700 px-3 py-1 text-slate-300 text-xs">
                    {row.aciklama}
                  </td>

                  {/* Bant değerleri */}
                  <Td right dim>{row.u1 || "—"}</Td>
                  <Td right dim>{row.u2 || "—"}</Td>
                  <Td right dim>{row.k1 || "—"}</Td>
                  <Td right dim>{row.k2 || "—"}</Td>

                  {/* İlave + Açıklama 1 */}
                  <td className={`border-b border-r px-3 py-1 text-xs ${fireRequired ? "border-amber-700/60 bg-amber-900/20 text-amber-300" : "border-slate-700 text-slate-400"}`}>
                    {row.ilaveAciklama || "—"}
                  </td>
                  <td className={`border-b border-r px-3 py-1 text-xs ${fireRequired ? "border-amber-700/60 bg-amber-900/20 text-amber-300" : "border-slate-700 text-slate-400"}`}>
                    {row.aciklama1}
                  </td>

                  {/* Durum mini rozetler */}
                  <td className="border-b border-r border-slate-700 px-3 py-1">
                    <div className="flex items-center justify-center gap-1.5 flex-wrap">
                      {isUnmatched ? (
                        <>
                          <AlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0" aria-label="Stok eksik" />
                          <MiniBadge label="Stok Eksik" variant="red" />
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" aria-label="ERP eşleşmesi tamam" />
                          <MiniBadge label="ERP OK" variant="emerald" />
                        </>
                      )}
                      {fireRequired && <MiniBadge label="Genel Fire Eksik" variant="amber" />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </main>
      ) : null}

      {/* Footer */}
      <footer className="shrink-0 border-t border-slate-700 bg-slate-800 px-4 py-2.5" role="contentinfo">
        <div className="flex items-center justify-between gap-4">
          {/* Sol: Dinamik mesaj */}
          <div className="flex items-center gap-3" aria-live="polite" aria-atomic="true">
            <div className="flex items-center gap-2">
              {saveMsg ? (
                <>
                  <SaveFeedbackIcon className={`h-4 w-4 shrink-0 ${saveFeedbackIconClassName}`} aria-hidden="true" />
                  <span className={saveFeedbackTextClassName}>{saveMsg}</span>
                </>
              ) : effectiveBlocker ? (
                <>
                  <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-red-400">
                    {exportBlockerReasons.join(" ⬢ ") || blockerMesaji(cari, unmatchedN, fireMissing, criticalMergeGroups)}
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" aria-hidden="true" />
                  <span className="text-xs font-medium text-emerald-400">
                    Tüm zorunlu eşleşmeler tamamlandı
                  </span>
                </>
              )}
            </div>
            <span className="text-xs text-slate-500">Seçili: <span className="text-slate-300">{selectedRowNos.size}</span></span>
            <span className="text-xs text-slate-500">
              Son Güncelleme:{" "}
              <span className="text-slate-300">
                {(activeRecord?.sonGuncelleme ?? activeRecord?.gelisTarihi)
                  ? new Date(activeRecord!.sonGuncelleme ?? activeRecord!.gelisTarihi!).toLocaleString("tr-TR", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            </span>
          </div>

          {/* Orta: Metrikler */}
          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span>
              Kalem: <span className="text-slate-300">{rows.length}</span>
            </span>
            <span>
              Adet: <span className="text-slate-300">{totalAdet(rows)}</span>
            </span>
            <span>
              Merge Bekleyen: <span className={effectiveMergeBekleyen > 0 ? "text-amber-400" : "text-slate-300"}>{effectiveMergeBekleyen}</span>
            </span>
            <span>
              Fire Eksik: <span className={effectiveFireMissing > 0 ? "text-amber-400" : "text-slate-300"}>{effectiveFireMissing}</span>
            </span>
            {effectiveUnmatchedN > 0 && (
              <span className="text-red-400">Eşleşmemiş: {effectiveUnmatchedN}</span>
            )}
          </div>

          {/* Sağ: Export aksiyonları */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saveActionBlocked}
              aria-disabled={saveActionBlocked}
              title={!activeRecord ? "Canlı kayıt olmadan taslak kaydetme yapılamaz" : "Taslağı kaydet"}
              className="border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-600 transition-colors disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              Taslak Kaydet
            </button>
            <button
              type="button"
              disabled={phase4ActionBlocked}
              aria-disabled={phase4ActionBlocked}
              onClick={() => void handleGoPhase4()}
              title={
                missingLiveRecordContext
                  ? "Aktif canlı kayıt yüklenmeden Phase 4'e geçilemez"
                  : effectiveBlocker
                  ? `Hard blocker çözülmeden export yapılamaz: ${exportBlockerReasons.join(" ⬢ ") || "Eksik doğrulamalar"}`
                  : "Phase 4 - Excel üret"
              }
              className={`inline-flex items-center gap-2 border px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                phase4ActionBlocked
                  ? "border-slate-600 bg-slate-700 text-slate-500 cursor-not-allowed"
                  : "border-blue-600 bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700"
              }`}
            >
              Phase 4'e Aktar (Excel üret)
              <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          </div>
        </div>
      </footer>

      {/* Modals */}

      {/* Cari Arama / Cari Bağlama Drawer'ı */}
      {showCariModal && (
        <CariSearchDrawer
          cari={cari}
          cariSearch={cariSearch}
          setCariSearch={setCariSearch}
          filteredCari={filteredCari}
          lookupLoading={lookupLoading}
          lookupState={cariLookupState}
          lookupStatusLabel={lookupBusyContext === "cari-submit" ? "Cari eşleştirmesi uygulanıyor…" : "Cari sonuçları güncelleniyor…"}
          interactionLocked={lookupBusyContext === "cari-submit"}
          onRetryLookup={retryCariLookup}
          onSelect={selectCari}
          onClose={closeCariDrawer}
          inputRef={cariSearchRef}
        />
      )}

      {/* Stok Arama / ERP Eşleştirme Drawer */}
      {showStokDrawer && (
        <StokSearchDrawer
          stokTargetRowNo={stokTargetRowNo}
          stokSearch={stokSearch}
          setStokSearch={setStokSearch}
          filteredStok={filteredStok}
          uygunStoklar={uygunStoklar}
          benzerStoklar={benzerStoklar}
          lookupLoading={lookupLoading}
          lookupState={stokLookupState}
          lookupStatusLabel={lookupBusyContext === "stok-submit" ? "Stok eşleştirmesi uygulanıyor…" : "Stok sonuçları güncelleniyor…"}
          interactionLocked={lookupBusyContext === "stok-submit"}
          onRetryLookup={retryStokLookup}
          onSelect={selectStok}
          onClose={closeStokDrawer}
          inputRef={stokSearchRef}
        />
      )}

      {/* Fire Açıklaması Modalı */}
      {showFireModal && (
        <FireModal
          initialValue={generalFireAciklamasi}
          contextLabel={selectedRowNos.size > 0 ? `${selectedRowNos.size} seçili satır için tek genel not kullanılacak.` : undefined}
          onSave={saveGeneralFireAciklamasi}
          onClose={() => setShowFireModal(false)}
          inputRef={fireInputRef}
        />
      )}

      {/* Satır Birleştirme Önizleme */}
      {showMergeModal && (
        <MergeModal
          selectedRows={selectedRows}
          onConfirm={handleMergeConfirmWithNote}
          onClose={() => setShowMergeModal(false)}
        />
      )}

      {/* Satır Detay Paneli */}
      {showRowDetail && activeRow && (
        <RowDetailPanel
          row={activeRow}
          sonMudahale={lastOperatorAction}
          mergeGecmisi={mergeHistory}
          generalFireAciklamasi={generalFireAciklamasi}
          onClose={() => setShowRowDetail(false)}
        />
      )}

      {/* Lookup Cache Debug Panel - dev only */}
      <LookupCacheDebugPanel cariStats={cariCacheStats} stokStats={stokCacheStats} />
    </div>
  );
}




































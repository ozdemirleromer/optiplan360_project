import { useCallback, useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { AlertTriangle, Clock3, FileText, GitBranch, Layers3, RefreshCcw, ShoppingCart } from "lucide-react";

import { Badge, Button, Card, Input, Modal, Select, IntegrationReadonlyPanel } from "../../components/Shared";
import type { IntegrationReadinessProfile } from "../../components/Shared/integrationReadiness";
import { notificationHelpers } from "../../stores/notificationStore";
import { COLORS, RADIUS, primaryRgba } from "../../components/Shared/constants";
import {
  crmService,
  type CRMAccount,
  type CRMQuote,
  type CRMQuoteLine,
  QuoteStatus,
  type QuoteLineInput,
  type QuoteInput,
} from "../../services/crmService";

interface DraftQuoteLineForm {
  description: string;
  quantity: string;
  unit: string;
  unit_price: string;
  discount_rate: string;
  material_name: string;
  color: string;
  thickness_mm: string;
  dimensions: string;
  grain_direction: string;
  band_included: boolean;
  drilling_included: boolean;
  notes: string;
}

interface DraftQuoteForm {
  account_id: string;
  title: string;
  description: string;
  tax_rate: number;
  discount_rate: number;
  valid_until: string;
  currency: string;
  terms: string;
  notes: string;
  lines: DraftQuoteLineForm[];
}

function createEmptyQuoteLine(): DraftQuoteLineForm {
  return {
    description: "",
    quantity: "",
    unit: "ADET",
    unit_price: "",
    discount_rate: "0",
    material_name: "",
    color: "",
    thickness_mm: "",
    dimensions: "",
    grain_direction: "",
    band_included: false,
    drilling_included: false,
    notes: "",
  };
}

function createInitialQuoteForm(): DraftQuoteForm {
  return {
    account_id: "",
    title: "",
    description: "",
    tax_rate: 20,
    discount_rate: 0,
    valid_until: "",
    currency: "TRY",
    terms: "",
    notes: "",
    lines: [createEmptyQuoteLine()],
  };
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: COLORS.muted,
  SENT: COLORS.primary,
  ACCEPTED: COLORS.success,
  REJECTED: COLORS.danger,
  EXPIRED: COLORS.warning,
  REVISED: "#8B5CF6",
};

type QuoteStatusFilter = "" | QuoteStatus;

const QUOTE_STATUS_FILTER_OPTIONS: Array<{ value: QuoteStatusFilter; label: string }> = [
  { value: "", label: "Tum Durumlar" },
  { value: QuoteStatus.DRAFT, label: QuoteStatus.DRAFT },
  { value: QuoteStatus.SENT, label: QuoteStatus.SENT },
  { value: QuoteStatus.ACCEPTED, label: QuoteStatus.ACCEPTED },
  { value: QuoteStatus.REJECTED, label: QuoteStatus.REJECTED },
  { value: QuoteStatus.EXPIRED, label: QuoteStatus.EXPIRED },
  { value: QuoteStatus.REVISED, label: QuoteStatus.REVISED },
];

function formatCurrency(amount: number | undefined, currency = "TRY") {
  const value = Number.isFinite(amount) ? Number(amount) : 0;

  try {
    return new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

function formatDate(value?: string) {
  if (!value) return "Belirtilmedi";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR");
}

function formatDateTime(value?: string) {
  if (!value) return "Belirtilmedi";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("tr-TR");
}

function hasDraftLineInput(line: DraftQuoteLineForm) {
  return Boolean(
    line.description.trim() ||
      line.quantity.trim() ||
      line.unit_price.trim() ||
      line.material_name.trim() ||
      line.color.trim() ||
      line.thickness_mm.trim() ||
      line.dimensions.trim() ||
      line.grain_direction.trim() ||
      line.notes.trim() ||
      line.band_included ||
      line.drilling_included,
  );
}

function buildQuoteLines(lines: DraftQuoteLineForm[], headerTaxRate: number) {
  const payload: QuoteLineInput[] = [];
  const taxRate = Number(headerTaxRate);

  if (!Number.isFinite(taxRate) || taxRate < 0) {
    return { error: "KDV orani negatif olamaz.", payload: [] };
  }

  for (const [index, line] of lines.entries()) {
    if (!hasDraftLineInput(line)) {
      continue;
    }

    const description = line.description.trim();
    const unit = line.unit.trim() || "ADET";
    const quantity = Number(line.quantity);
    const unitPrice = Number(line.unit_price);
    const discountRate = line.discount_rate.trim() ? Number(line.discount_rate) : 0;
    const thickness = line.thickness_mm.trim() ? Number(line.thickness_mm) : undefined;

    if (!description) {
      return { error: `Satir ${index + 1} aciklamasi zorunludur.`, payload: [] };
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      return { error: `Satir ${index + 1} miktari 0'dan buyuk olmalidir.`, payload: [] };
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      return { error: `Satir ${index + 1} birim fiyati 0'dan buyuk olmalidir.`, payload: [] };
    }

    if (!Number.isFinite(discountRate) || discountRate < 0) {
      return { error: `Satir ${index + 1} iskonto orani negatif olamaz.`, payload: [] };
    }

    if (thickness !== undefined && (!Number.isFinite(thickness) || thickness < 0)) {
      return { error: `Satir ${index + 1} kalinlik alani gecersiz.`, payload: [] };
    }

    payload.push({
      description,
      quantity,
      unit,
      unit_price: unitPrice,
      discount_rate: discountRate,
      tax_rate: taxRate,
      material_name: line.material_name.trim() || undefined,
      color: line.color.trim() || undefined,
      thickness_mm: thickness,
      dimensions: line.dimensions.trim() || undefined,
      grain_direction: line.grain_direction.trim() || undefined,
      band_included: line.band_included,
      drilling_included: line.drilling_included,
      notes: line.notes.trim() || undefined,
    });
  }

  return { payload, error: null as string | null };
}

function buildQuotePayload(form: DraftQuoteForm) {
  const accountId = form.account_id.trim();
  if (!accountId) {
    return { payload: null, error: "Cari hesap secimi zorunludur." };
  }

  const title = form.title.trim();
  if (!title) {
    return { payload: null, error: "Teklif basligi zorunludur." };
  }

  const taxRate = Number(form.tax_rate);
  if (!Number.isFinite(taxRate) || taxRate < 0) {
    return { payload: null, error: "KDV orani negatif olamaz." };
  }

  const discountRate = Number(form.discount_rate);
  if (!Number.isFinite(discountRate) || discountRate < 0) {
    return { payload: null, error: "Iskonto orani negatif olamaz." };
  }

  const { payload: lines, error: lineError } = buildQuoteLines(form.lines, taxRate);
  if (lineError) {
    return { payload: null, error: lineError };
  }

  const optionalString = (value: string) => {
    const trimmed = value.trim();
    return trimmed || undefined;
  };

  const payload: QuoteInput = {
    account_id: accountId,
    title,
    description: optionalString(form.description),
    tax_rate: taxRate,
    discount_rate: discountRate,
    valid_until: optionalString(form.valid_until),
    currency: form.currency || "TRY",
    terms: optionalString(form.terms),
    notes: optionalString(form.notes),
    lines,
  };

  return { payload, error: null as string | null };
}

function calculateLineTotal(line: DraftQuoteLineForm) {
  const quantity = Number(line.quantity);
  const unitPrice = Number(line.unit_price);
  const discountRate = line.discount_rate.trim() ? Number(line.discount_rate) : 0;

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return 0;
  }

  if (!Number.isFinite(discountRate) || discountRate < 0) {
    return 0;
  }

  return quantity * unitPrice * (1 - discountRate / 100);
}

function hasLineDetails(line: CRMQuoteLine) {
  return Boolean(
    line.materialName ||
      line.color ||
      line.thicknessMm != null ||
      line.dimensions ||
      line.grainDirection ||
      line.bandIncluded ||
      line.drillingIncluded,
  );
}

function buildDetailWarnings(
  quote: CRMQuote | null,
  account: CRMAccount | undefined,
  lineCount: number,
) {
  if (!quote) {
    return [];
  }

  return [
    !quote.validUntil ? "Gecerlilik tarihi tanimli degil." : null,
    lineCount === 0
      ? "Satir grid bos. Bu teklif kaydi satirsiz acilmis; yeni create akisi dogrulanmis satir alanlarini topluyor."
      : null,
    !account?.mikroCariKod
      ? "Cari esleme eksik. Secili cari hesapta mikro_cari_kod bulunmadigi icin teknik aktarim baslatilamaz."
      : null,
  ].filter(Boolean) as string[];
}

function buildDraftWarnings(
  form: DraftQuoteForm,
  account: CRMAccount | undefined,
  populatedLineCount: number,
) {
  return [
    !form.valid_until.trim()
      ? "Gecerlilik tarihi secilmedi. Teklif kaydi olusabilir; ancak belge uyarisi acik kalir."
      : null,
    populatedLineCount === 0
      ? "Bos satir listesi ile ilerliyorsunuz. Dokumanda bu durum gorunur uyari olarak isaretlenir."
      : null,
    form.account_id.trim() && !account?.mikroCariKod
      ? "Secili cari hesapta mikro_cari_kod yok. Teknik aktarim hazirligi tamamlanmamis olacak."
      : null,
  ].filter(Boolean) as string[];
}

function buildQuoteReadinessProfile(
  quote: CRMQuote | null,
  account: CRMAccount | undefined,
): IntegrationReadinessProfile | null {
  if (!quote) {
    return null;
  }

  const lines = quote.lines ?? [];
  const accountId = quote.accountId.trim();
  const validUntil = quote.validUntil?.trim() ?? "";
  const mikroCariKod = account?.mikroCariKod?.trim() ?? "";
  const readyStockCount = lines.filter((line) => Boolean(line.mikroStokKod?.trim())).length;
  const totalLineCount = lines.length;

  const fields = [
    {
      key: "accountId",
      label: "Cari Hesap",
      owner: "Header / CRM",
      ready: Boolean(accountId),
      value: accountId || "Eksik",
      note: "Teklif kaydi secili cari hesapla acilmalidir.",
      blockingCode: "E_QUOTE_ACCOUNT_REQUIRED",
      blockingCount: accountId ? 0 : 1,
    },
    {
      key: "validUntil",
      label: "Gecerlilik Tarihi",
      owner: "Header / Ticari",
      ready: Boolean(validUntil),
      value: validUntil || "Eksik",
      note: "Quote-to-order hatti icin onayli gecerlilik tarihi gerekir.",
      blockingCode: "E_QUOTE_VALID_UNTIL_REQUIRED",
      blockingCount: validUntil ? 0 : 1,
    },
    {
      key: "accountMikroCariKod",
      label: "Cari Mikro Kodu",
      owner: "Header / Master Data",
      ready: Boolean(mikroCariKod),
      value: mikroCariKod || "Eksik",
      note: "Secili cari hesap Mikro cari kodu ile eslenmelidir.",
      blockingCode: "E_QUOTE_ACCOUNT_MIKRO_REQUIRED",
      blockingCount: mikroCariKod ? 0 : 1,
    },
    {
      key: "quoteLines",
      label: "Teklif Satirlari",
      owner: "Satir / Belge",
      ready: totalLineCount > 0,
      value: totalLineCount > 0 ? `${totalLineCount} satir hazir` : "Eksik",
      note: "Siparise donusum icin en az bir satir gerekir.",
      blockingCode: "E_QUOTE_LINES_REQUIRED",
      blockingCount: totalLineCount > 0 ? 0 : 1,
    },
    {
      key: "stockReferences",
      label: "Satir Stok Referansi",
      owner: "Satir / Stok Master",
      ready: totalLineCount > 0 && readyStockCount === totalLineCount,
      value: `${readyStockCount} / ${totalLineCount} hazir satir`,
      note: "Her satir Mikro stok kodu ile kapanmadan quote-to-order acilmamali.",
      blockingCode: "E_QUOTE_STOCK_REFERENCE_REQUIRED",
      blockingCount: Math.max(totalLineCount - readyStockCount, 0),
    },
  ];

  const blockingCodes = fields
    .filter((field) => !field.ready && field.blockingCode)
    .map((field) => field.blockingCode as string);
  const readyFields = fields.filter((field) => field.ready).length;
  const masterDataSummary = !accountId
    ? "Cari hesap secilmedi."
    : !mikroCariKod
      ? "Cari secili ancak mikro_cari_kod eksik."
      : `Mikro cari kodu hazir: ${mikroCariKod}`;

  return {
    scope: "QUOTE",
    scopeLabel: "Teklif Teknik Hazirlik",
    sourceSystem: "MIKRO",
    readyFields,
    totalFields: fields.length,
    blockingCodes,
    fields,
    masterDataStatus: accountId && mikroCariKod ? "READY" : "BLOCKED",
    masterDataSummary,
    accountMikroCariKod: mikroCariKod || null,
    entityMapStatus: blockingCodes.length === 0 ? "READY_FOR_ORDER" : "BLOCKED",
    entityMapExternalId: null,
    outboxStatus: blockingCodes.length === 0 ? "READY" : "BLOCKED",
    outboxRetryCount: null,
    outboxMaxRetries: null,
    lastSyncedAt: null,
    lastErrorAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
  };
}

function renderLineReferences(line: CRMQuoteLine) {
  const refs = [
    line.productCode ? `Urun: ${line.productCode}` : null,
    line.mikroStokKod ? `Mikro stok: ${line.mikroStokKod}` : null,
  ].filter(Boolean);

  return refs.length > 0 ? refs.join(" | ") : "Referans bekleniyor";
}

function Field({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontSize: 13, color: COLORS.text }}>{value}</span>
    </div>
  );
}

function DetailPanel({
  title,
  subtitle,
  accent = false,
  children,
}: {
  title: string;
  subtitle?: string;
  accent?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: 12,
        padding: "16px",
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        background: accent ? primaryRgba(0.05) : COLORS.bg.surface,
      }}
    >
      <div style={{ display: "grid", gap: 4 }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{title}</span>
        {subtitle ? <span style={{ fontSize: 12, color: COLORS.muted }}>{subtitle}</span> : null}
      </div>
      {children}
    </div>
  );
}

export default function TeklifWorkspace() {
  const [quotes, setQuotes] = useState<CRMQuote[]>([]);
  const [accounts, setAccounts] = useState<CRMAccount[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<CRMQuote | null>(null);
  const [statusFilter, setStatusFilter] = useState<QuoteStatusFilter>("");
  const [quoteNumberFilter, setQuoteNumberFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [revisionHistory, setRevisionHistory] = useState<CRMQuote[]>([]);
  const [, setLoadingHistory] = useState(false);
  const [revising, setRevising] = useState(false);
  const [converting, setConverting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [newQuote, setNewQuote] = useState<DraftQuoteForm>(() => createInitialQuoteForm());

  const accountsById = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );
  const draftCount = useMemo(
    () => quotes.filter((quote) => quote.status === "DRAFT").length,
    [quotes],
  );
  const revisedCount = useMemo(
    () => quotes.filter((quote) => quote.revision > 1 || quote.status === "REVISED").length,
    [quotes],
  );
  const populatedDraftLineCount = useMemo(
    () => newQuote.lines.filter((line) => hasDraftLineInput(line)).length,
    [newQuote.lines],
  );
  const draftSubtotal = useMemo(
    () =>
      newQuote.lines.reduce((sum, line) => sum + calculateLineTotal(line), 0),
    [newQuote.lines],
  );
  const draftDiscountAmount = useMemo(
    () => draftSubtotal * ((Number.isFinite(newQuote.discount_rate) ? newQuote.discount_rate : 0) / 100),
    [draftSubtotal, newQuote.discount_rate],
  );
  const draftTaxableTotal = useMemo(
    () => draftSubtotal - draftDiscountAmount,
    [draftSubtotal, draftDiscountAmount],
  );
  const draftTaxAmount = useMemo(
    () => draftTaxableTotal * ((Number.isFinite(newQuote.tax_rate) ? newQuote.tax_rate : 0) / 100),
    [draftTaxableTotal, newQuote.tax_rate],
  );
  const draftGrandTotal = useMemo(
    () => draftTaxableTotal + draftTaxAmount,
    [draftTaxableTotal, draftTaxAmount],
  );
  const listScopeTitle = statusFilter ? "Filtreli Teklif" : "Toplam Teklif";
  const listScopeDetail = statusFilter ? `${statusFilter} filtresine gore liste daraltildi` : "Bagimsiz modul liste gorunumu";

  const loadQuotes = useCallback(async (preferredQuoteId?: string) => {
    try {
      setLoading(true);
      setActionError(null);
      const params: { status?: string; quote_number?: string } = {};
      if (statusFilter) params.status = statusFilter;
      if (quoteNumberFilter.trim()) params.quote_number = quoteNumberFilter.trim();
      
      const data = await crmService.listQuotes(params);
      setQuotes(data);
      if (preferredQuoteId) {
        setSelectedQuoteId(preferredQuoteId);
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Teklifler yuklenemedi.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, quoteNumberFilter]);

  const loadAccounts = useCallback(async () => {
    try {
      setAccountsLoading(true);
      const data = await crmService.listAccounts({ is_active: true });
      setAccounts(data);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Cari listesi yuklenemedi.");
    } finally {
      setAccountsLoading(false);
    }
  }, []);

  const loadQuoteDetail = useCallback(async (quoteId: string) => {
    try {
      setDetailLoading(true);
      setActionError(null);
      const detail = await crmService.getQuote(quoteId);
      setSelectedQuote(detail);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Teklif detayi yuklenemedi.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  useEffect(() => {
    void loadAccounts();
  }, [loadAccounts]);

  useEffect(() => {
    if (quotes.length === 0) {
      setSelectedQuoteId(null);
      setSelectedQuote(null);
      return;
    }

    if (!selectedQuoteId || !quotes.some((quote) => quote.id === selectedQuoteId)) {
      setSelectedQuoteId(quotes[0].id);
    }
  }, [quotes, selectedQuoteId]);

  useEffect(() => {
    if (!selectedQuoteId) return;
    void loadQuoteDetail(selectedQuoteId);

    // Fetch revision history
    const quote = quotes.find(q => q.id === selectedQuoteId);
    if (quote?.quoteNumber) {
      setLoadingHistory(true);
      crmService.listQuotes({ quote_number: quote.quoteNumber })
        .then(res => setRevisionHistory(res.filter(r => r.id !== selectedQuoteId)))
        .catch(err => console.error("History error:", err))
        .finally(() => setLoadingHistory(false));
    } else {
      setRevisionHistory([]);
    }
  }, [selectedQuoteId, quotes, loadQuoteDetail]);

  async function handleCreateQuote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const { payload, error } = buildQuotePayload(newQuote);
    if (error || !payload) {
      setCreateError(error ?? "Teklif olusturulamadi.");
      return;
    }

    setCreating(true);
    setCreateError(null);

    try {
      const created = await crmService.createQuote(payload);
      setCreateOpen(false);
      setNewQuote(createInitialQuoteForm());
      await loadQuotes(created.id);
      setSelectedQuoteId(created.id);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Teklif olusturulamadi.");
    } finally {
      setCreating(false);
    }
  }

  function patchDraftLine(
    index: number,
    field: keyof DraftQuoteLineForm,
    value: string | boolean,
  ) {
    setNewQuote((prev) => ({
      ...prev,
      lines: prev.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    }));
  }

  function addDraftLine() {
    setNewQuote((prev) => ({
      ...prev,
      lines: [...prev.lines, createEmptyQuoteLine()],
    }));
  }

  function removeDraftLine(index: number) {
    setNewQuote((prev) => ({
      ...prev,
      lines:
        prev.lines.length === 1
          ? [createEmptyQuoteLine()]
          : prev.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  
  async function handleConvertToOrder() {
    if (!selectedQuote) return;
    if (!window.confirm("Bu teklifi siparişe dönüştürmek istediğinize emin misiniz?")) return;

    try {
      setConverting(true);
      const result = await crmService.convertQuoteToOrder(selectedQuote.id);
      if (result.ok) {
        notificationHelpers.success(`Sipariş başarıyla oluşturuldu: ${result.order_number}`);
        await loadQuotes(selectedQuote.id);
      } else {
        notificationHelpers.error(result.message || "Dönüştürme başarısız.");
      }
    } catch (error) {
       console.error("Conversion error:", error);
       notificationHelpers.error("Siparişe dönüştürülürken bir hata oluştu.");
    } finally {
      setConverting(false);
    }
  }

  async function handleReviseQuote() {
    if (!selectedQuote) return;

    try {
      setRevising(true);
      setActionError(null);
      const revised = await crmService.reviseQuote(selectedQuote.id);
      await loadQuotes(revised.id);
      setSelectedQuoteId(revised.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Teklif revizyonu olusturulamadi.");
    } finally {
      setRevising(false);
    }
  }

  function closeCreateModal() {
    setCreateOpen(false);
    setCreateError(null);
    setNewQuote(createInitialQuoteForm());
  }

  const selectedAccountName = selectedQuote
    ? selectedQuote.accountName ?? accountsById.get(selectedQuote.accountId)?.companyName ?? selectedQuote.accountId
    : "Cari secilmedi";
  const selectedAccount = selectedQuote ? accountsById.get(selectedQuote.accountId) : undefined;
  const draftAccount = newQuote.account_id ? accountsById.get(newQuote.account_id) : undefined;
  const lines = selectedQuote?.lines ?? [];
  const warnings = buildDetailWarnings(selectedQuote, selectedAccount, lines.length);
  const draftWarnings = buildDraftWarnings(newQuote, draftAccount, populatedDraftLineCount);
  const quoteReadinessProfile = useMemo(
    () => buildQuoteReadinessProfile(selectedQuote, selectedAccount),
    [selectedAccount, selectedQuote],
  );
  const activeStatusMessage = statusFilter ? `${statusFilter} filtre aktif` : "Tum durumlar listeleniyor";

  return (
    <div style={{ display: "grid", gap: 18 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14 }}>
        <Card style={{ borderRadius: RADIUS.lg }}>
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>{listScopeTitle}</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: COLORS.text }}>{quotes.length}</span>
            <span style={{ fontSize: 12, color: COLORS.muted }}>{listScopeDetail}</span>
          </div>
        </Card>
        <Card style={{ borderRadius: RADIUS.lg }}>
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>Taslaklar</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: COLORS.primary }}>{draftCount}</span>
            <span style={{ fontSize: 12, color: COLORS.muted }}>Durum ekseni tek sozlukte izlenir</span>
          </div>
        </Card>
        <Card style={{ borderRadius: RADIUS.lg }}>
          <div style={{ display: "grid", gap: 8 }}>
            <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>Revizyonlar</span>
            <span style={{ fontSize: 28, fontWeight: 800, color: "#8B5CF6" }}>{revisedCount}</span>
            <span style={{ fontSize: 12, color: COLORS.muted }}>Teklif kapama yerine revizyon akisinda tutulur</span>
          </div>
        </Card>
      </div>

      {actionError ? (
        <div
          role="alert"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "12px 14px",
            borderRadius: RADIUS.md,
            border: `1px solid ${COLORS.danger}`,
            background: `${COLORS.danger}10`,
            color: COLORS.danger,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <AlertTriangle size={16} />
          <span>{actionError}</span>
        </div>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 18 }}>
        <Card
          title="Teklif Listesi"
          subtitle={`${quotes.length} teklif kaydi${statusFilter ? ` / ${statusFilter}` : ""}`}
          actions={
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="button" variant="ghost" onClick={() => { setStatusFilter(""); setQuoteNumberFilter(""); }}>
                Temizle
              </Button>
              <Button type="button" variant="ghost" onClick={() => void loadQuotes(selectedQuoteId ?? undefined)}>
                <RefreshCcw size={14} />
                Yenile
              </Button>
              <Button type="button" onClick={() => setCreateOpen(true)} disabled={accountsLoading}>
                + Yeni Teklif
              </Button>
            </div>
          }
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              flexWrap: "wrap",
              alignItems: "flex-end",
              marginBottom: 14,
            }}
          >
            <div style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 12, color: COLORS.muted, fontWeight: 600 }}>Durum Sozlugu</span>
              <span style={{ fontSize: 12, color: COLORS.muted }}>{activeStatusMessage}</span>
            </div>
            <div style={{ flex: "1 1 220px", maxWidth: 280 }}>
              <Input
                label="Teklif No Ara"
                value={quoteNumberFilter}
                onChange={(event) => setQuoteNumberFilter(event.target.value)}
                placeholder="PRO-2024-XXXX"
              />
            </div>
            <div style={{ minWidth: 220, flex: "1 1 220px", maxWidth: 280 }}>
              <Select
                label="Durum Filtresi"
                value={statusFilter}
                onChange={(value: string | number) => setStatusFilter(String(value) as QuoteStatusFilter)}
                options={QUOTE_STATUS_FILTER_OPTIONS}
              />
            </div>
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: "center", color: COLORS.muted }}>Yukleniyor...</div>
          ) : quotes.length === 0 ? (
            <div style={{ padding: 24, color: COLORS.muted, display: "grid", gap: 8 }}>
              <span>{statusFilter ? "Secili durum filtresi icin teklif bulunmuyor." : "Henuz teklif bulunmuyor."}</span>
              {statusFilter ? <span style={{ fontSize: 12 }}>Aktif filtre: {statusFilter}</span> : null}
              <span style={{ fontSize: 12 }}>
                Yeni create akisinda dogrulanmis satir grid alanlari acik. Stok referansi ise tekillestirme karari cikana kadar ayrik tutuluyor.
              </span>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {quotes.map((quote) => {
                const active = quote.id === selectedQuoteId;
                const statusColor = STATUS_COLORS[quote.status] ?? COLORS.muted;
                const accountName = quote.accountName ?? accountsById.get(quote.accountId)?.companyName ?? quote.accountId;

                return (
                  <button
                    key={quote.id}
                    type="button"
                    onClick={() => setSelectedQuoteId(quote.id)}
                    style={{
                      width: "100%",
                      display: "grid",
                      gap: 8,
                      padding: "14px 16px",
                      textAlign: "left",
                      cursor: "pointer",
                      borderRadius: RADIUS.lg,
                      borderStyle: "solid",
                      borderTopWidth: 1,
                      borderRightWidth: 1,
                      borderBottomWidth: 1,
                      borderLeftWidth: 4,
                      borderTopColor: active ? COLORS.primary : COLORS.border,
                      borderRightColor: active ? COLORS.primary : COLORS.border,
                      borderBottomColor: active ? COLORS.primary : COLORS.border,
                      borderLeftColor: statusColor,
                      background: active ? primaryRgba(0.1) : COLORS.bg.elevated ?? COLORS.bg.surface,
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>{quote.quoteNumber}</span>
                        <span style={{ fontSize: 13, color: COLORS.text }}>{quote.title}</span>
                        <span style={{ fontSize: 12, color: COLORS.muted }}>{accountName}</span>
                      </div>
                      <Badge style={{ background: statusColor }}>{quote.status}</Badge>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", fontSize: 12 }}>
                      <span style={{ color: COLORS.muted }}>Revizyon {quote.revision}</span>
                      <span style={{ color: COLORS.muted }}>Gecerlilik {formatDate(quote.validUntil)}</span>
                      <span style={{ fontWeight: 700, color: COLORS.primary }}>
                        {formatCurrency(quote.total, quote.currency ?? "TRY")}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        <Card
          title={selectedQuote ? "Teklif Detayi" : "Teklif Detayi Bekleniyor"}
          subtitle={selectedQuote ? `${selectedQuote.quoteNumber} / ${selectedAccountName}` : "Listeden bir teklif secin"}
          actions={
            selectedQuote ? (
              <div style={{ display: "flex", gap: 8 }}>
                <Button type="button" variant="ghost" onClick={() => void loadQuoteDetail(selectedQuote.id)} disabled={detailLoading}>
                  <RefreshCcw size={14} />
                  Tazele
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleConvertToOrder()}
                  disabled={converting || selectedQuote.status === 'ACCEPTED' || selectedQuote.status === 'REJECTED'}
                  style={{ background: COLORS.success }}
                >
                  <ShoppingCart size={14} />
                  {converting ? "Donusturuluyor..." : "Siparişe Dönüştür"}
                </Button>
                <Button type="button" onClick={() => void handleReviseQuote()} disabled={revising}>
                  <GitBranch size={14} />
                  {revising ? "Olusturuluyor..." : "Revizyon Olustur"}
                </Button>
              </div>
            ) : undefined
          }
        >
          {detailLoading ? (
            <div style={{ padding: 24, textAlign: "center", color: COLORS.muted }}>Teklif detayi yukleniyor...</div>
          ) : !selectedQuote ? (
            <div style={{ padding: 24, color: COLORS.muted }}>Detay icin soldan bir teklif secin.</div>
          ) : (
            <div style={{ display: "grid", gap: 18 }}>
              {warnings.length > 0 ? (
                <div style={{ display: "grid", gap: 8 }}>
                  {warnings.map((warning) => (
                    <div
                      key={warning}
                      role="alert"
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 10,
                        padding: "12px 14px",
                        borderRadius: RADIUS.md,
                        border: `1px solid ${COLORS.warning}`,
                        background: `${COLORS.warning}12`,
                        color: COLORS.text,
                        fontSize: 13,
                      }}
                    >
                      <AlertTriangle size={16} style={{ color: COLORS.warning, flexShrink: 0, marginTop: 1 }} />
                      <span>{warning}</span>
                    </div>
                  ))}
                </div>
              ) : null}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))", gap: 14 }}>
                <DetailPanel title="Header Bilgileri" subtitle="Teklif basligi ve ust alan ozeti">
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 18, fontWeight: 800, color: COLORS.text }}>{selectedQuote.title}</span>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>{selectedAccountName}</span>
                    </div>
                    <Badge style={{ background: STATUS_COLORS[selectedQuote.status] ?? COLORS.muted }}>{selectedQuote.status}</Badge>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    <Field label="Teklif No" value={selectedQuote.quoteNumber} />
                    <Field label="Gecerlilik" value={formatDate(selectedQuote.validUntil)} />
                    <Field label="Cari Hesap" value={selectedAccountName} />
                    <Field label="Para Birimi" value={selectedQuote.currency ?? "TRY"} />
                  </div>
                </DetailPanel>

                <DetailPanel title="Readonly Bilgiler" subtitle="Kayit ve revizyon izleri">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                    <Field label="Revizyon" value={String(selectedQuote.revision)} />
                    <Field label="Olusturma" value={formatDateTime(selectedQuote.createdAt)} />
                    <Field label="Guncelleme" value={formatDateTime(selectedQuote.updatedAt)} />
                  </div>
                </DetailPanel>

                <DetailPanel title="Evrak Ozeti" subtitle="Toplam, iskonto ve vergi alanlari" accent>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.text }}>
                    <Layers3 size={16} />
                    <span style={{ fontSize: 14, fontWeight: 700 }}>Evrak Ozeti</span>
                  </div>
                  <div style={{ display: "grid", gap: 10 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: COLORS.muted }}>Ara Toplam</span>
                      <strong style={{ color: COLORS.text }}>{formatCurrency(selectedQuote.subtotal, selectedQuote.currency)}</strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: COLORS.muted }}>KDV</span>
                      <strong style={{ color: COLORS.text }}>
                        %{selectedQuote.taxRate} / {formatCurrency(selectedQuote.taxAmount, selectedQuote.currency)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: COLORS.muted }}>Iskonto</span>
                      <strong style={{ color: COLORS.text }}>
                        %{selectedQuote.discountRate} / {formatCurrency(selectedQuote.discountAmount, selectedQuote.currency)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, paddingTop: 10, borderTop: `1px solid ${COLORS.border}` }}>
                      <span style={{ color: COLORS.text, fontWeight: 700 }}>Genel Toplam</span>
                      <strong style={{ color: COLORS.primary, fontSize: 18 }}>{formatCurrency(selectedQuote.total, selectedQuote.currency)}</strong>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, color: COLORS.muted, fontSize: 12 }}>
                    <Clock3 size={14} />
                    <span>Olusturma: {formatDateTime(selectedQuote.createdAt)}</span>
                  </div>
                </DetailPanel>

                <DetailPanel title="Aciklama ve Sartlar" subtitle="Metinsel alanlar ve belge kosullari">
                  <Field label="Aciklama" value={selectedQuote.description || "Belirtilmedi"} />
                  <Field label="Notlar" value={selectedQuote.notes || "Belirtilmedi"} />
                  <Field label="Sartlar" value={selectedQuote.terms || "Belirtilmedi"} />
                </DetailPanel>

                {revisionHistory.length > 0 && (
                  <DetailPanel title="Revizyon Gecmisi" subtitle="Onceki versiyonlar">
                    <div style={{ display: "grid", gap: 8 }}>
                      {revisionHistory.map((rev) => (
                        <div 
                          key={rev.id} 
                          onClick={() => setSelectedQuoteId(rev.id)}
                          style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            padding: "8px 10px", 
                            borderRadius: RADIUS.md, 
                            background: COLORS.bg.elevated,
                            border: `1px solid ${COLORS.border}`,
                            cursor: "pointer",
                            fontSize: 12
                          }}
                        >
                          <div style={{ display: "grid" }}>
                            <span style={{ fontWeight: 600 }}>Revizyon {rev.revision}</span>
                            <span style={{ color: COLORS.muted }}>{formatDate(rev.createdAt)}</span>
                          </div>
                          <Badge style={{ background: STATUS_COLORS[rev.status] ?? COLORS.muted }}>{rev.status}</Badge>
                        </div>
                      ))}
                    </div>
                  </DetailPanel>
                )}
              </div>

              <IntegrationReadonlyPanel
                entityType="QUOTE"
                entityId={selectedQuote.id}
                title="Teknik Aktarim Paneli"
                readinessProfile={quoteReadinessProfile}
              />

              <div style={{ display: "grid", gap: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileText size={16} color={COLORS.primary} />
                  <h3 style={{ margin: 0, fontSize: 15, color: COLORS.text }}>Satirlar</h3>
                </div>

                {lines.length === 0 ? (
                  <div style={{ padding: 18, borderRadius: RADIUS.lg, border: `1px dashed ${COLORS.border}`, color: COLORS.muted, background: COLORS.bg.surface }}>
                    Satir grid bu kayitta bos. Yeni create akisinda satir ticari ve detay alanlari acik; referans alanlari ise tekillestirme karari sonrasina birakildi.
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 10 }}>
                    {lines.map((line) => (
                      <div key={line.id} style={{ display: "grid", gap: 10, padding: "14px 16px", borderRadius: RADIUS.lg, border: `1px solid ${COLORS.border}`, background: COLORS.bg.surface }}>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
                          <Field label="Satir" value={`#${line.lineNumber}`} />
                          <Field label="Aciklama" value={line.description} />
                          <Field label="Referanslar" value={renderLineReferences(line)} />
                          <div style={{ display: "grid", gap: 4 }}>
                            <span style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>Ticari Alanlar</span>
                            <span style={{ color: COLORS.text, fontSize: 13 }}>
                              {line.quantity} {line.unit} x {formatCurrency(line.unitPrice, selectedQuote.currency)}
                            </span>
                            <span style={{ color: COLORS.muted, fontSize: 12 }}>
                              Iskonto %{line.discountRate} | Toplam {formatCurrency(line.lineTotal, selectedQuote.currency)}
                            </span>
                          </div>
                        </div>

                        {hasLineDetails(line) ? (
                          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                            {line.materialName ? <Badge variant="info">Malzeme: {line.materialName}</Badge> : null}
                            {line.color ? <Badge variant="secondary">Renk: {line.color}</Badge> : null}
                            {line.thicknessMm != null ? <Badge variant="secondary">Kalinlik: {line.thicknessMm} mm</Badge> : null}
                            {line.dimensions ? <Badge variant="secondary">Olcu: {line.dimensions}</Badge> : null}
                            {line.grainDirection ? <Badge variant="secondary">Damar: {line.grainDirection}</Badge> : null}
                            {line.bandIncluded ? <Badge variant="success">Bant dahil</Badge> : null}
                            {line.drillingIncluded ? <Badge variant="success">Delik dahil</Badge> : null}
                          </div>
                        ) : null}

                        {line.notes ? (
                          <div style={{ fontSize: 12, color: COLORS.muted }}>
                            <strong style={{ color: COLORS.text }}>Satir notu:</strong> {line.notes}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>
      </div>

      <Modal open={createOpen} onClose={closeCreateModal} title="Yeni Teklif Olustur">
        <form onSubmit={handleCreateQuote} style={{ display: "grid", gap: 16 }}>
          <DetailPanel title="Header Alanlari" subtitle="Teklif basligi ve ust alan girdileri">
            <Input
              label="Teklif Basligi"
              value={newQuote.title}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setNewQuote((prev) => ({ ...prev, title: event.target.value }))}
              required
            />
            <Select
              label="Cari Hesap"
              value={newQuote.account_id}
              onChange={(value: string | number) => setNewQuote((prev) => ({ ...prev, account_id: String(value) }))}
              options={accounts.map((account) => ({
                value: account.id,
                label: account.companyName,
              }))}
              required
              disabled={accountsLoading}
            />
            <Input
              label="Aciklama"
              value={newQuote.description}
              onChange={(event: ChangeEvent<HTMLInputElement>) => setNewQuote((prev) => ({ ...prev, description: event.target.value }))}
              placeholder="Teklif kapsam ozeti"
            />
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input
                label="KDV Orani (%)"
                type="number"
                value={newQuote.tax_rate}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setNewQuote((prev) => ({ ...prev, tax_rate: Number(event.target.value) }))}
              />
              <Input
                label="Iskonto Orani (%)"
                type="number"
                value={newQuote.discount_rate}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setNewQuote((prev) => ({ ...prev, discount_rate: Number(event.target.value) }))}
              />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Input
                label="Gecerlilik Tarihi"
                type="date"
                value={newQuote.valid_until}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setNewQuote((prev) => ({ ...prev, valid_until: event.target.value }))}
              />
              <Select
                label="Para Birimi"
                value={newQuote.currency}
                onChange={(value: string | number) => setNewQuote((prev) => ({ ...prev, currency: String(value) }))}
                options={[
                  { value: "TRY", label: "TRY — Türk Lirası" },
                  { value: "USD", label: "USD — Amerikan Doları" },
                  { value: "EUR", label: "EUR — Euro" },
                ]}
              />
            </div>
            {draftWarnings.length > 0 ? (
              <div style={{ display: "grid", gap: 8 }}>
                {draftWarnings.map((warning) => (
                  <div
                    key={warning}
                    role="alert"
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: RADIUS.md,
                      border: `1px solid ${COLORS.warning}`,
                      background: `${COLORS.warning}12`,
                      color: COLORS.text,
                      fontSize: 13,
                    }}
                  >
                    <AlertTriangle size={16} style={{ color: COLORS.warning, flexShrink: 0, marginTop: 1 }} />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </DetailPanel>
          <DetailPanel title="Satir Gridi" subtitle="Dogrulanmis satir ticari ve detay alanlari" accent>
            <div style={{ display: "grid", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Satir Ozeti</span>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>
                    {populatedDraftLineCount} satir dolu, referans alanlari ise bilerek kapali.
                  </span>
                </div>
                <Button type="button" variant="secondary" onClick={addDraftLine}>
                  + Satir Ekle
                </Button>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
                <Field label="Ara Toplam" value={formatCurrency(draftSubtotal)} />
                <Field label="Genel Iskonto" value={`%${newQuote.discount_rate} / ${formatCurrency(draftDiscountAmount)}`} />
                <Field label="KDV" value={`%${newQuote.tax_rate} / ${formatCurrency(draftTaxAmount)}`} />
                <Field label="Genel Toplam" value={formatCurrency(draftGrandTotal)} />
              </div>
            </div>
            <div style={{ display: "grid", gap: 12 }}>
              {newQuote.lines.map((line, index) => (
                <div
                  key={`draft-line-${index}`}
                  style={{
                    display: "grid",
                    gap: 12,
                    padding: "14px 16px",
                    borderRadius: RADIUS.lg,
                    border: `1px solid ${COLORS.border}`,
                    background: COLORS.bg.surface,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                    <div style={{ display: "grid", gap: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>Satir {index + 1}</span>
                      <span style={{ fontSize: 12, color: COLORS.muted }}>
                        Stok referansi tekillestirme karari bekledigi icin yalniz dogrulanmis ticari ve detay alanlari acik.
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge variant="secondary">{formatCurrency(calculateLineTotal(line))}</Badge>
                      <Button type="button" variant="ghost" onClick={() => removeDraftLine(index)}>
                        Satiri Sil
                      </Button>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 2fr) repeat(4, minmax(0, 1fr))", gap: 12 }}>
                    <Input
                      label={`Satir Aciklamasi ${index + 1}`}
                      value={line.description}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "description", event.target.value)}
                      placeholder="Orn: Alt dolap govde seti"
                    />
                    <Input
                      label={`Miktar ${index + 1}`}
                      type="number"
                      value={line.quantity}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "quantity", event.target.value)}
                      placeholder="1"
                    />
                    <Input
                      label={`Birim ${index + 1}`}
                      value={line.unit}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "unit", event.target.value)}
                      placeholder="ADET"
                    />
                    <Input
                      label={`Birim Fiyat ${index + 1}`}
                      type="number"
                      value={line.unit_price}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "unit_price", event.target.value)}
                      placeholder="0.00"
                    />
                    <Input
                      label={`Iskonto ${index + 1}`}
                      type="number"
                      value={line.discount_rate}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "discount_rate", event.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                    <Input
                      label={`Malzeme ${index + 1}`}
                      value={line.material_name}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "material_name", event.target.value)}
                      placeholder="Suntalam"
                    />
                    <Input
                      label={`Renk ${index + 1}`}
                      value={line.color}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "color", event.target.value)}
                      placeholder="Beyaz"
                    />
                    <Input
                      label={`Kalinlik ${index + 1}`}
                      type="number"
                      value={line.thickness_mm}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "thickness_mm", event.target.value)}
                      placeholder="18"
                    />
                    <Input
                      label={`Olcu ${index + 1}`}
                      value={line.dimensions}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "dimensions", event.target.value)}
                      placeholder="600x2400"
                    />
                    <Input
                      label={`Damar Yonu ${index + 1}`}
                      value={line.grain_direction}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => patchDraftLine(index, "grain_direction", event.target.value)}
                      placeholder="Boyuna"
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, alignItems: "end" }}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Satir Notu</span>
                      <textarea
                        value={line.notes}
                        onChange={(event) => patchDraftLine(index, "notes", event.target.value)}
                        rows={2}
                        placeholder="Uretim veya teklif notu"
                        style={{
                          width: "100%",
                          borderRadius: RADIUS.md,
                          border: `1px solid ${COLORS.border}`,
                          padding: "10px 12px",
                          background: COLORS.bg.surface,
                          color: COLORS.text,
                          resize: "vertical",
                        }}
                      />
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: COLORS.text }}>
                      <input
                        type="checkbox"
                        checked={line.band_included}
                        onChange={(event) => patchDraftLine(index, "band_included", event.target.checked)}
                      />
                      Bant dahil
                    </label>
                    <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, color: COLORS.text }}>
                      <input
                        type="checkbox"
                        checked={line.drilling_included}
                        onChange={(event) => patchDraftLine(index, "drilling_included", event.target.checked)}
                      />
                      Delik dahil
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </DetailPanel>
          <DetailPanel title="Aciklama ve Sartlar" subtitle="Belge metinleri ve ek notlar">
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Sartlar</span>
              <textarea
                value={newQuote.terms}
                onChange={(event) => setNewQuote((prev) => ({ ...prev, terms: event.target.value }))}
                rows={3}
                placeholder="Teklif sartlari"
                style={{ width: "100%", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, padding: "10px 12px", background: COLORS.bg.surface, color: COLORS.text, resize: "vertical" }}
              />
            </label>
            <label style={{ display: "grid", gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>Notlar</span>
              <textarea
                value={newQuote.notes}
                onChange={(event) => setNewQuote((prev) => ({ ...prev, notes: event.target.value }))}
                rows={3}
                placeholder="Teklif notlari"
                style={{ width: "100%", borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, padding: "10px 12px", background: COLORS.bg.surface, color: COLORS.text, resize: "vertical" }}
              />
            </label>
          </DetailPanel>

          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 10,
              padding: "12px 14px",
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.warning}`,
              background: `${COLORS.warning}10`,
              color: COLORS.text,
              fontSize: 13,
            }}
          >
            <AlertTriangle size={16} style={{ color: COLORS.warning, flexShrink: 0, marginTop: 1 }} />
            <span>
              `product_code` ve `mikro_stok_kod` alanlari ayni amaca hizmet ettigi icin kullanici girdisine birlikte acilmadi.
              Stok referansi tekillestirme karari netlestiginde satir referansi ayni modalde tek alana indirgenecek.
            </span>
          </div>

          {createError ? <div style={{ color: COLORS.danger, fontSize: 13 }}>{createError}</div> : null}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <Button type="button" variant="ghost" onClick={closeCreateModal}>
              Vazgec
            </Button>
            <Button type="submit" disabled={creating}>
              {creating ? "Kaydediliyor..." : "Teklif Olustur"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

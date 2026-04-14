import type { ReactNode } from "react";
import { Button, Card, Input, COLORS } from "../../components/Shared";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";
import type { WorkflowExportRunResult } from "../../services/optiplanWorkflowService";
import { DataTable, type TableColumn } from "../../components/Shared/DataTable";
import {
  buildWorkflowCommercialFieldProfile,
  exportStatusTone,
  formatAuditTimestamp,
  parseNumericInput,
  sortAuditEntriesDesc,
  statusLabel,
  workflowStatusTone,
  type ConfidenceField,
  type WorkflowAuditEntry,
  type WorkflowCommercialFieldProfile,
  type WorkflowErrorStatus,
  type WorkflowTransferBlockingIssue,
} from "./workflowWorkspaceUtils";
import type { WorkflowBandThickness, WorkflowPlate, WorkflowPreviewRow, WorkflowRecord, WorkflowRow } from "./optiplanWorkflowTypes";

interface PhaseNavProps {
  phase: 1 | 2 | 3 | 4;
  canGoPhase3: boolean;
  canGoPhase4: boolean;
  saving: boolean;
  onPhase1: () => void;
  onPhase2: () => void;
  onPhase3: () => void;
  onPhase4: () => void;
}

const PHASE_ITEMS = [
  { phase: 1 as const, label: ORDER_ROUTE_META.workflowInbox.title, actionLabel: ORDER_ROUTE_META.workflowInbox.navLabel },
  { phase: 2 as const, label: "OCR Kontrol", actionLabel: ORDER_ROUTE_META.workflowReview.navLabel },
  { phase: 3 as const, label: ORDER_ROUTE_META.workflowEditing.title, actionLabel: ORDER_ROUTE_META.workflowEditing.navLabel },
  { phase: 4 as const, label: ORDER_ROUTE_META.workflowExport.title, actionLabel: ORDER_ROUTE_META.workflowExport.navLabel },
];

export function PhaseNav({
  phase,
  canGoPhase3,
  canGoPhase4,
  saving,
  onPhase1,
  onPhase2,
  onPhase3,
  onPhase4,
}: PhaseNavProps) {
  const handlers: Record<1 | 2 | 3 | 4, () => void> = {
    1: onPhase1,
    2: onPhase2,
    3: onPhase3,
    4: onPhase4,
  };

  const isDisabled = (phaseId: 1 | 2 | 3 | 4) =>
    (phaseId === 3 && (!canGoPhase3 || saving)) ||
    (phaseId === 4 && (!canGoPhase4 || saving));

  const disabledReason = (phaseId: 1 | 2 | 3 | 4): string | undefined => {
    if (!isDisabled(phaseId)) {
      return undefined;
    }
    if (saving) {
      return "Kayıt işlemi devam ediyor, faz değişikliği geçici olarak kilitlendi.";
    }
    if (phaseId === 3) {
      return "Phase 3 için OCR kontrol onayı tamamlanmalı.";
    }
    if (phaseId === 4) {
      return "Phase 4 için cari/stok eşleşmesi ve satır validasyonları tamamlanmalı.";
    }
    return undefined;
  };

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {PHASE_ITEMS.map((item) => {
        const active = phase === item.phase;
        return (
          <Button
            key={item.phase}
            aria-label={item.actionLabel}
            aria-pressed={active}
            title={disabledReason(item.phase) ?? `${item.label} fazına geç`}
            variant={active ? "secondary" : "ghost"}
            onClick={handlers[item.phase]}
            disabled={isDisabled(item.phase)}
            style={{
              minWidth: 140,
              justifyContent: "flex-start",
              borderColor: active ? "rgba(var(--primary-rgb), 0.35)" : undefined,
            }}
          >
            {item.label}
          </Button>
        );
      })}
    </div>
  );
}

interface FolderStatCardProps {
  title: string;
  count: number;
}

export function FolderStatCard({ title, count }: FolderStatCardProps) {
  return (
    <Card>
      <strong>{title}</strong>
      <div>{count}</div>
    </Card>
  );
}

interface WorkflowStatusBadgeProps {
  label: string;
}

export function WorkflowStatusBadge({ label }: WorkflowStatusBadgeProps) {
  const tone = workflowStatusTone(label);
  return <span style={{ background: tone, padding: "3px 10px", borderRadius: 6 }}>{label}</span>;
}

interface WorkflowRecordSummaryCardProps {
  fileName: string;
  statusText: string;
  retryNo: number;
  revizyonNo: number;
  kaynakKlasor?: string;
  ocrEngine?: string | null;
  reviewRequired?: boolean;
}

export function WorkflowRecordSummaryCard({
  fileName,
  statusText,
  retryNo,
  revizyonNo,
  kaynakKlasor,
  ocrEngine,
  reviewRequired = false,
}: WorkflowRecordSummaryCardProps) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 6 }}>
        <div>{`Aktif kayıt: ${fileName}`}</div>
        <div>{`Aktif durum: ${statusText}`}</div>
        <div>Retry: {retryNo} | Revizyon: {revizyonNo}</div>
        <div>Kaynak: {kaynakKlasor || "—"} | OCR: {ocrEngine || "—"}</div>
        <div>İnceleme: {reviewRequired ? "Operatör onayı gerekli" : "Otomatik kabul sınırında"}</div>
      </div>
    </Card>
  );
}

interface WorkflowOcrSummaryPanelProps {
  record: WorkflowRecord;
}

function formatMetric(value?: number | null): string {
  if (value == null || Number.isNaN(value)) {
    return "—";
  }
  return `${value.toFixed(0)}`;
}

export function WorkflowOcrSummaryPanel({ record }: WorkflowOcrSummaryPanelProps) {
  const details = [
    { label: "OCR Motoru", value: record.ocrEngine || "—" },
    { label: "OCR Durumu", value: record.ocrDurumu || "—" },
    { label: "Belge Türü", value: record.ocrBelgeTuru || "—" },
    { label: "OCR Satırı", value: String(record.ocrSatirSayisi ?? record.rows.length ?? 0) },
    { label: "Ort. Güven", value: formatMetric(record.ocrOrtGuven) },
    { label: "Min. Güven", value: formatMetric(record.ocrMinGuven) },
    { label: "Okunan Cari", value: record.okunanCariUnvan || "—" },
    { label: "Okunan Telefon", value: record.okunanCariTelefon || "—" },
    { label: "Malzeme", value: record.malzeme || "—" },
  ];

  return (
    <Card title="OCR Özeti">
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <WorkflowStatusBadge label={record.ocrReviewRequired ? "Manuel Kontrol" : "OCR Kabul"} />
          {record.revizyonAdayiUyarisi?.trim() ? <WorkflowStatusBadge label="Revizyon Uyarısı" /> : null}
        </div>
        <div style={{ fontSize: 13 }}>{record.aiGuvenSkoruOzeti || "OCR güven özeti bulunamadı."}</div>
        {record.revizyonAdayiUyarisi?.trim() ? (
          <div style={{ border: `1px solid ${COLORS.warning}`, borderRadius: 8, padding: 8, background: `${COLORS.warning}14` }}>
            {record.revizyonAdayiUyarisi}
          </div>
        ) : null}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(140px, 1fr))", gap: 8 }}>
          {details.map((item) => (
            <div key={item.label} style={{ border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: 8, display: "grid", gap: 4 }}>
              <strong style={{ fontSize: 12 }}>{item.label}</strong>
              <span style={{ fontSize: 13 }}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

interface ExportPreviewTableProps {
  rows: WorkflowPreviewRow[];
  fireAciklamasi: string;
}

export function ExportPreviewTable({ rows, fireAciklamasi }: ExportPreviewTableProps) {
  return (
    <table>
      <thead>
        <tr>
          <th>[P_CODE_MAT]</th>
          <th>P_LENGTH</th>
          <th>P_WIDTH</th>
          <th>Fire_Aciklamasi</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id}>
            <td>{row.pCodeMat === "[P_CODE_MAT]" ? "P_CODE_MAT_VALUE" : row.pCodeMat}</td>
            <td>{row.pLength}</td>
            <td>{row.pWidth}</td>
            <td>{fireAciklamasi || "-"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface SectionCardProps {
  title?: string;
  children: ReactNode;
}

export function SectionCard({ title, children }: SectionCardProps) {
  return (
    <Card title={title}>
      <div style={{ display: "grid", gap: 8 }}>{children}</div>
    </Card>
  );
}

interface RecordSelectorItem {
  kayitUuid: string;
  hamDosyaAdi: string;
  dosyaDurumu?: WorkflowRecord["dosyaDurumu"];
  kaynakKlasor?: WorkflowRecord["kaynakKlasor"];
  gelisTarihi?: string;
  retryNo?: number;
  revizyonNo?: number;
}

interface RecordSelectorProps {
  records: RecordSelectorItem[];
  selectedId: string;
  onSelect: (id: string) => void;
}

export function RecordSelector({ records, selectedId, onSelect }: RecordSelectorProps) {
  return (
    <Card title="İş Kuyruğu">
      <div style={{ display: "grid", gap: 8, maxHeight: 720, overflowY: "auto", paddingRight: 4 }}>
        {records.map((record) => {
          const badgeLabel =
            record.dosyaDurumu === "EXPORT_ONIZLEME"
              ? "Önizleme"
              : statusLabel(record.dosyaDurumu ?? "OCR_HAVUZU");

          return (
            <button
              key={record.kayitUuid}
              type="button"
              aria-label={`Kayıt: ${record.hamDosyaAdi}`}
              aria-pressed={selectedId === record.kayitUuid}
              onClick={() => onSelect(record.kayitUuid)}
              style={{
                display: "grid",
                gap: 6,
                width: "100%",
                textAlign: "left",
                padding: "10px 12px",
                borderRadius: 10,
                border: selectedId === record.kayitUuid ? "1px solid rgba(var(--primary-rgb), 0.4)" : `1px solid ${COLORS.border}`,
                background: selectedId === record.kayitUuid ? "rgba(var(--primary-rgb), 0.10)" : COLORS.bg.surface,
                cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                <strong style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.4 }}>{record.hamDosyaAdi}</strong>
                <WorkflowStatusBadge label={badgeLabel} />
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Kaynak: {record.kaynakKlasor ?? "—"}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Gelis: {record.gelisTarihi ? new Date(record.gelisTarihi).toLocaleString("tr-TR") : "—"}
              </div>
              <div style={{ fontSize: 12, color: COLORS.muted }}>
                Retry: {record.retryNo ?? 0} · Revizyon: {record.revizyonNo ?? 0}
              </div>
            </button>
          );
        })}
      </div>
    </Card>
  );
}

interface RemovedRowItem {
  id: string;
  malzeme?: string;
  boy?: number | "";
  en?: number | "";
  adet?: number | "";
}

interface RemovedRowsPanelProps {
  rows: RemovedRowItem[];
  onRestore: (id: string) => void;
}

export function RemovedRowsPanel({ rows, onRestore }: RemovedRowsPanelProps) {
  return (
    <Card title="Pasif Satır Deposu">
      <div style={{ display: "grid", gap: 6 }}>
        {rows.length === 0
          ? <div>Pasif satır yok</div>
          : rows.map((row) => (
            <div key={row.id} style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <span>{row.id}</span>
              <span>{row.malzeme || "Malzeme yok"}</span>
              <span>{`${row.boy ?? "?"}x${row.en ?? "?"} / ${row.adet ?? "?"}`}</span>
              <Button onClick={() => onRestore(row.id)}>Geri Al</Button>
            </div>
          ))}
      </div>
    </Card>
  );
}

interface WorkflowCommercialReadinessPanelProps {
  record: WorkflowRecord;
  blockers: WorkflowTransferBlockingIssue[];
}

function CommercialFieldRow({ item }: { item: WorkflowCommercialFieldProfile }) {
  return (
    <div
      style={{
        border: `1px solid ${COLORS.border}`,
        borderRadius: 8,
        padding: 10,
        display: "grid",
        gap: 4,
        background: item.ready ? `${COLORS.success}0f` : `${COLORS.danger}0f`,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
        <strong style={{ fontSize: 13 }}>{item.label}</strong>
        <span style={{ fontSize: 12 }}>{item.ready ? "Hazır" : "Eksik"}</span>
      </div>
      <span style={{ fontSize: 12, color: COLORS.muted }}>{item.owner}</span>
      <span style={{ fontSize: 13 }}>{item.value}</span>
      <span style={{ fontSize: 12, color: COLORS.muted }}>{item.note}</span>
    </div>
  );
}

export function WorkflowCommercialReadinessPanel({ record, blockers }: WorkflowCommercialReadinessPanelProps) {
  const profile = buildWorkflowCommercialFieldProfile(record);

  return (
    <Card title="Ticari Hazır Oluş">
      <div style={{ display: "grid", gap: 10 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(180px, 1fr))", gap: 8 }}>
          {profile.map((item) => <CommercialFieldRow key={item.key} item={item} />)}
        </div>
        {blockers.length > 0 ? (
          <div style={{ border: `1px solid ${COLORS.danger}`, borderRadius: 8, padding: 10, display: "grid", gap: 6 }}>
            <strong>Canlıya Geçiş Blokajları</strong>
            {blockers.map((item) => (
              <div key={item.code}>{item.message}</div>
            ))}
          </div>
        ) : (
          <div style={{ border: `1px solid ${COLORS.success}`, borderRadius: 8, padding: 10 }}>
            Teknik aktarım için zorunlu ticari alanlar tamam.
          </div>
        )}
      </div>
    </Card>
  );
}

interface AuditTrailPanelProps {
  entries: WorkflowAuditEntry[];
}

export function AuditTrailPanel({ entries }: AuditTrailPanelProps) {
  const sortedEntries = sortAuditEntriesDesc(entries);

  return (
    <Card title="Audit">
      <div style={{ display: "grid", gap: 6 }}>
        {sortedEntries.length === 0
          ? <div>Kayıt yok</div>
          : sortedEntries.map((entry) => (
             <div key={entry.id}>
               <span style={{ color: "var(--text-dim, #71717a)", fontSize: 11, fontFamily: "var(--font-mono)" }}>
                   {formatAuditTimestamp(entry.createdAt)}
               </span>{" "}
               - {entry.text}
             </div>
           ))}
      </div>
    </Card>
  );
}

interface ExportResultPanelProps {
  result: WorkflowExportRunResult;
  xlsxEnabled: boolean;
}

export function ExportResultPanel({ result, xlsxEnabled }: ExportResultPanelProps) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 6 }}>
        <strong style={{ background: exportStatusTone(result.durum), padding: "3px 10px", borderRadius: 6, width: "fit-content" }}>Durum: {result.durum}</strong>
        <span>{result.message}</span>
        <div>XLSX: {xlsxEnabled ? "AKTIF" : "PASIF"}</div>
        {result.exportManifest && (
          <div>
            <strong>Manifest</strong>
            <div>Export ID: {result.exportManifest.exportId}</div>
          </div>
        )}
        {result.generatedFileDetails.length > 0 && (
          <div>
            <strong>Dosya Artifactleri</strong>
            {result.generatedFileDetails.map((file) => (
              <div key={file.filePath}>
                <span>{file.fileName}</span>{" "}
                <a href={file.downloadPath}>İndir</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

interface ErrorRetryCardProps {
  status: WorkflowErrorStatus;
  retryNo: number;
  operatorNote: string;
}

export function ErrorRetryCard({ status, retryNo, operatorNote }: ErrorRetryCardProps) {
  return (
    <Card title="Hata / Retry Kartı">
      <div style={{ display: "grid", gap: 6 }}>
        <div>Kayıt durumu: {status}</div>
        <div>Retry sayısı: {retryNo}</div>
        <div>Operatör notu: {operatorNote || "Yok"}</div>
      </div>
    </Card>
  );
}

interface MatchPickerPanelOption {
  code: string;
  title?: string;
  detail?: string;
}

interface MatchPickerPanelProps {
  filterLabel: string;
  filterPlaceholder: string;
  query: string;
  onQueryChange: (value: string) => void;
  options: MatchPickerPanelOption[];
  onSelect: (code: string) => void;
  emptyText: string;
}

export function MatchPickerPanel({
  filterLabel,
  filterPlaceholder,
  query,
  onQueryChange,
  options,
  onSelect,
  emptyText,
}: MatchPickerPanelProps) {
  return (
    <Card>
      <div style={{ display: "grid", gap: 8 }}>
        <Input
          label={filterLabel}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={filterPlaceholder}
        />
        {options.map((item) => (
          <button
            key={item.code}
            type="button"
            onClick={() => onSelect(item.code)}
            style={{
              display: "grid",
              gap: 4,
              textAlign: "left",
              padding: "10px 12px",
              borderRadius: 8,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bg.surface,
            }}
          >
            <strong>{item.code}</strong>
            {item.title ? <span style={{ fontSize: 13, color: COLORS.text }}>{item.title}</span> : null}
            {item.detail ? <span style={{ fontSize: 12, color: COLORS.muted }}>{item.detail}</span> : null}
          </button>
        ))}
        {options.length === 0 && <div>{emptyText}</div>}
      </div>
    </Card>
  );
}

interface OcrRowsTableProps {
  rows: WorkflowRow[];
  isLowConfidence: (row: WorkflowRow, field: ConfidenceField) => boolean;
  onEdit?: (rowId: string, field: ConfidenceField, value: number | "") => void;
  onApprove: (rowId: string, field: ConfidenceField) => void;
}

export function OcrRowsTable({ rows, isLowConfidence, onEdit, onApprove }: OcrRowsTableProps) {
  const columns: TableColumn<WorkflowRow>[] = [
    {
      key: "boy",
      label: "Boy",
      render: (_value, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLowConfidence(row, "boy") && !row.confidenceApproved.boy ? (
            <input
              data-testid="low-confidence-boy"
              aria-label="boy input"
              value={String(row.boy ?? "")}
              onChange={(event) => onEdit?.(row.id, "boy", parseNumericInput(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onApprove(row.id, "boy");
                }
              }}
              style={{ border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", minWidth: 110, background: `${COLORS.warning}28` }}
            />
          ) : (
            <span data-testid="low-confidence-boy" style={{ background: isLowConfidence(row, "boy") ? `${COLORS.warning}28` : "transparent", padding: "2px 8px", borderRadius: 6 }}>
              boy: {row.boy} ({row.confidence.boy})
            </span>
          )}
          {!row.confidenceApproved.boy && isLowConfidence(row, "boy") && (
            <Button onClick={() => onApprove(row.id, "boy")}>Onayla</Button>
          )}
        </div>
      ),
    },
    {
      key: "en",
      label: "En",
      render: (_value, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLowConfidence(row, "en") && !row.confidenceApproved.en ? (
            <input
              data-testid="low-confidence-en"
              aria-label="en input"
              value={String(row.en ?? "")}
              onChange={(event) => onEdit?.(row.id, "en", parseNumericInput(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onApprove(row.id, "en");
                }
              }}
              style={{ border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", minWidth: 110, background: `${COLORS.warning}28` }}
            />
          ) : (
            <span data-testid="low-confidence-en" style={{ background: isLowConfidence(row, "en") ? `${COLORS.warning}28` : "transparent", padding: "2px 8px", borderRadius: 6 }}>
              en: {row.en} ({row.confidence.en})
            </span>
          )}
          {!row.confidenceApproved.en && isLowConfidence(row, "en") && (
            <Button onClick={() => onApprove(row.id, "en")}>Onayla</Button>
          )}
        </div>
      ),
    },
    {
      key: "adet",
      label: "Adet",
      render: (_value, row) => (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isLowConfidence(row, "adet") && !row.confidenceApproved.adet ? (
            <input
              data-testid="low-confidence-adet"
              aria-label="adet input"
              value={String(row.adet ?? "")}
              onChange={(event) => onEdit?.(row.id, "adet", parseNumericInput(event.target.value))}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onApprove(row.id, "adet");
                }
              }}
              style={{ border: `1px solid ${COLORS.border}`, borderRadius: 6, padding: "4px 8px", minWidth: 110, background: `${COLORS.warning}28` }}
            />
          ) : (
            <span data-testid="low-confidence-adet" style={{ background: isLowConfidence(row, "adet") ? `${COLORS.warning}28` : "transparent", padding: "2px 8px", borderRadius: 6 }}>
              adet: {row.adet} ({row.confidence.adet})
            </span>
          )}
          {!row.confidenceApproved.adet && isLowConfidence(row, "adet") && (
            <Button onClick={() => onApprove(row.id, "adet")}>Onayla</Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Card title="OCR Satırları">
      <DataTable columns={columns} data={rows} paginated={false} striped={false} hoverable={false} compact searchable={false} />
    </Card>
  );
}

interface PlateSelectorPanelProps {
  plates: WorkflowPlate[];
  activePlateRef: string;
  onChangeActive: (plateRef: string) => void;
  onAddPlate: () => void;
}

export function PlateSelectorPanel({ plates, activePlateRef, onChangeActive, onAddPlate }: PlateSelectorPanelProps) {
  return (
    <Card title="Plaka Yönetimi" actions={<Button onClick={onAddPlate}>Plaka Ekle</Button>}>
      <div style={{ display: "grid", gap: 6 }}>
        {plates.map((plate) => (
          <label key={plate.plakaRef} style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              type="radio"
              name="plate"
              aria-label={plate.etiket}
              checked={activePlateRef === plate.plakaRef}
              onChange={() => onChangeActive(plate.plakaRef)}
            />
            {plate.etiket}
          </label>
        ))}
      </div>
    </Card>
  );
}

interface Phase3RowsEditorTableProps {
  rows: WorkflowRow[];
  plates: WorkflowPlate[];
  onRowChange: (rowId: string, mutator: (row: WorkflowRow) => WorkflowRow) => void;
  onRemoveRow: (rowId: string) => void;
}

export function Phase3RowsEditorTable({ rows, plates, onRowChange, onRemoveRow }: Phase3RowsEditorTableProps) {
  const inputStyle = {
    width: "100%",
    minWidth: 0,
    border: `1px solid ${COLORS.border}`,
    borderRadius: 6,
    padding: "5px 6px",
    fontSize: 12,
    background: COLORS.bg.surface,
  };
  const checkboxStyle = {
    width: 16,
    height: 16,
  };
  const columns: TableColumn<WorkflowRow>[] = [
    {
      key: "satirKaynagi",
      label: "Kaynak",
      width: "88px",
      render: (_value, row) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 58,
            padding: "4px 8px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            background: row.satirKaynagi === "MANUEL" ? "rgba(14,165,233,.12)" : "rgba(15,23,42,.08)",
            color: row.satirKaynagi === "MANUEL" ? COLORS.accent : COLORS.text,
          }}
        >
          {row.satirKaynagi}
        </span>
      ),
    },
    {
      key: "boy",
      label: "Boy",
      width: "88px",
      render: (_value, row) => (
        <input
          aria-label={`Boy ${row.id}`}
          style={inputStyle}
          value={String(row.boy)}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, boy: parseNumericInput(event.target.value) }))}
        />
      ),
    },
    {
      key: "en",
      label: "En",
      width: "88px",
      render: (_value, row) => (
        <input
          aria-label={`En ${row.id}`}
          style={inputStyle}
          value={String(row.en)}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, en: parseNumericInput(event.target.value) }))}
        />
      ),
    },
    {
      key: "adet",
      label: "Adet",
      width: "88px",
      render: (_value, row) => (
        <input
          aria-label={`Adet ${row.id}`}
          style={inputStyle}
          value={String(row.adet)}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, adet: parseNumericInput(event.target.value) }))}
        />
      ),
    },
    {
      key: "grain",
      label: "Gr",
      width: "80px",
      render: (_value, row) => (
        <select
          aria-label={`Grain ${row.id}`}
          style={inputStyle}
          value={row.grain}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, grain: Number(event.target.value) as WorkflowRow["grain"] }))}
        >
          <option value={0}>0</option>
          <option value={1}>1</option>
          <option value={2}>2</option>
          <option value={3}>3</option>
        </select>
      ),
    },
    {
      key: "u1",
      label: "U1",
      width: "56px",
      align: "center",
      render: (_value, row) => (
        <input
          aria-label={`U1 ${row.id}`}
          type="checkbox"
          style={checkboxStyle}
          checked={row.u1}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, u1: event.target.checked }))}
        />
      ),
    },
    {
      key: "u2",
      label: "U2",
      width: "56px",
      align: "center",
      render: (_value, row) => (
        <input
          aria-label={`U2 ${row.id}`}
          type="checkbox"
          style={checkboxStyle}
          checked={row.u2}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, u2: event.target.checked }))}
        />
      ),
    },
    {
      key: "k1",
      label: "K1",
      width: "56px",
      align: "center",
      render: (_value, row) => (
        <input
          aria-label={`K1 ${row.id}`}
          type="checkbox"
          style={checkboxStyle}
          checked={row.k1}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, k1: event.target.checked }))}
        />
      ),
    },
    {
      key: "k2",
      label: "K2",
      width: "56px",
      align: "center",
      render: (_value, row) => (
        <input
          aria-label={`K2 ${row.id}`}
          type="checkbox"
          style={checkboxStyle}
          checked={row.k2}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, k2: event.target.checked }))}
        />
      ),
    },
    {
      key: "bilgi",
      label: "Bilgi",
      width: "180px",
      render: (_value, row) => (
        <input
          aria-label={`Bilgi ${row.id}`}
          style={inputStyle}
          value={row.bilgi}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, bilgi: event.target.value }))}
        />
      ),
    },
    {
      key: "delik1",
      label: "Delik-1",
      width: "102px",
      render: (_value, row) => (
        <input
          aria-label={`Delik-1 ${row.id}`}
          style={inputStyle}
          value={row.delik1}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, delik1: event.target.value }))}
        />
      ),
    },
    {
      key: "delik2",
      label: "Delik-2",
      width: "102px",
      render: (_value, row) => (
        <input
          aria-label={`Delik-2 ${row.id}`}
          style={inputStyle}
          value={row.delik2}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, delik2: event.target.value }))}
        />
      ),
    },
    {
      key: "bantKalinligiOverride",
      label: "Bant",
      width: "118px",
      render: (_value, row) => (
        <select
          aria-label={`Bant ${row.id}`}
          style={inputStyle}
          value={row.bantKalinligiOverride || ""}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, bantKalinligiOverride: (event.target.value as WorkflowBandThickness) || "" }))}
        >
          <option value="">Varsayılan</option>
          <option value="0.40 MM">0.40 MM</option>
          <option value="1 MM">1 MM</option>
          <option value="2 MM">2 MM</option>
        </select>
      ),
    },
    {
      key: "plakaRef",
      label: "Plaka",
      width: "170px",
      render: (_value, row) => (
        <select
          aria-label={`Plaka ${row.id}`}
          style={inputStyle}
          value={row.plakaRef}
          onChange={(event) => onRowChange(row.id, (item) => ({ ...item, plakaRef: event.target.value }))}
        >
          {plates.map((plate) => (
            <option key={plate.plakaRef} value={plate.plakaRef}>{plate.etiket}</option>
          ))}
        </select>
      ),
    },
    {
      key: "actions",
      label: "İşlem",
      width: "96px",
      render: (_value, row) => <Button variant="ghost" onClick={() => onRemoveRow(row.id)}>Sil</Button>,
    },
  ];

  return (
    <Card title="Satır Editörü">
      <div style={{ display: "grid", gap: 8 }}>
        <div style={{ overflowX: "auto" }}>
          <DataTable columns={columns} data={rows} paginated={false} striped={false} hoverable={false} compact searchable={false} />
        </div>
      </div>
    </Card>
  );
}

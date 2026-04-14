import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";

import {
  integrationService,
  type EntityMap,
  type IntegrationAudit,
  type IntegrationError,
  type OutboxItem,
} from "../../services/integrationService";
import type { IntegrationReadinessProfile } from "./integrationReadiness";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { Card } from "./Card";
import { COLORS, RADIUS, primaryRgba } from "./constants";

interface IntegrationReadonlyPanelProps {
  entityType: string;
  entityId?: string | null;
  title?: string;
  fallbackExternalId?: string | null;
  fallbackExternalSystem?: string | null;
  fallbackLastSyncedAt?: string | null;
  localIssues?: Array<{ code?: string | null; message: string }>;
  readinessProfile?: IntegrationReadinessProfile | null;
}

function formatDateTime(value?: string | null) {
  if (!value) return "Kayıt yok";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString("tr-TR");
}

function compareByNewest<T extends { createdAt?: string; processedAt?: string; lastSyncedAt?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const leftValue = left.processedAt ?? left.lastSyncedAt ?? left.createdAt ?? "";
    const rightValue = right.processedAt ?? right.lastSyncedAt ?? right.createdAt ?? "";
    return new Date(rightValue).getTime() - new Date(leftValue).getTime();
  });
}

function statusVariant(status?: string) {
  switch ((status ?? "").toUpperCase()) {
    case "SUCCESS":
      return "success";
    case "FAILED":
      return "danger";
    case "RUNNING":
      return "info";
    case "QUEUED":
    case "PARTIAL":
      return "warning";
    default:
      return "secondary";
  }
}

function formatPlainValue(value?: string | null, emptyLabel = "Kayit yok") {
  return value && value.trim() ? value : emptyLabel;
}

function formatRetryValue(retryCount?: number | null, maxRetries?: number | null) {
  if (retryCount == null || maxRetries == null) {
    return "Kayit yok";
  }
  return `${retryCount} / ${maxRetries}`;
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "grid", gap: 4 }}>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: COLORS.muted,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 13, color: COLORS.text, lineHeight: 1.6 }}>{value}</span>
    </div>
  );
}

export function IntegrationReadonlyPanel({
  entityType,
  entityId,
  title = "Teknik Aktarım",
  fallbackExternalId,
  fallbackExternalSystem = "MIKRO",
  fallbackLastSyncedAt,
  localIssues = [],
  readinessProfile = null,
}: IntegrationReadonlyPanelProps) {
  const [entityMaps, setEntityMaps] = useState<EntityMap[]>([]);
  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([]);
  const [errors, setErrors] = useState<IntegrationError[]>([]);
  const [audits, setAudits] = useState<IntegrationAudit[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  const normalizedEntityType = entityType.trim().toUpperCase();

  const loadPanel = useCallback(async () => {
    if (!entityId) {
      requestIdRef.current += 1;
      setEntityMaps([]);
      setOutboxItems([]);
      setErrors([]);
      setAudits([]);
      setLoadError(null);
      setLoading(false);
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    try {
      setLoading(true);
      setLoadError(null);

      const [maps, outbox, errorItems, auditItems] = await Promise.all([
        integrationService.listEntityMaps({ entity_type: normalizedEntityType, internal_id: entityId }),
        integrationService.listOutbox({ entity_type: normalizedEntityType, entity_id: entityId }),
        integrationService.listErrors({
          is_resolved: false,
          entity_type: normalizedEntityType,
          entity_id: entityId,
        }),
        integrationService.listAudit({ entity_type: normalizedEntityType, entity_id: entityId }),
      ]);

      if (requestId !== requestIdRef.current) return;
      setEntityMaps(maps);
      setOutboxItems(outbox);
      setErrors(errorItems);
      setAudits(auditItems);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setLoadError(error instanceof Error ? error.message : "Teknik aktarım verileri yüklenemedi.");
    } finally {
      if (requestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [entityId, normalizedEntityType]);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  const entityMap = useMemo(() => {
    if (!entityId) return null;
    return compareByNewest(
      entityMaps.filter((item) => item.internalId === entityId && item.isActive !== false),
    )[0] ?? null;
  }, [entityId, entityMaps]);

  const latestOutbox = useMemo(() => {
    if (!entityId) return null;
    return compareByNewest(outboxItems.filter((item) => item.entityId === entityId))[0] ?? null;
  }, [entityId, outboxItems]);

  const latestError = useMemo(() => compareByNewest(errors)[0] ?? null, [errors]);
  const latestAudit = useMemo(() => compareByNewest(audits)[0] ?? null, [audits]);

  const profileExternalId = readinessProfile?.entityMapExternalId ?? null;
  const externalIdentity =
    entityMap?.externalId || profileExternalId || fallbackExternalId
      ? `${entityMap?.externalSystem ?? readinessProfile?.sourceSystem ?? fallbackExternalSystem} / ${entityMap?.externalId ?? profileExternalId ?? fallbackExternalId}`
      : "Eşleme kaydı yok";

  const lastSyncedAt =
    entityMap?.lastSyncedAt ??
    latestOutbox?.processedAt ??
    readinessProfile?.lastSyncedAt ??
    fallbackLastSyncedAt ??
    null;
  const outboxStatus = latestOutbox?.status ?? readinessProfile?.outboxStatus ?? "Outbox kaydı yok";
  const retryValue = latestOutbox
    ? `${latestOutbox.retryCount} / ${latestOutbox.maxRetries}`
    : formatRetryValue(readinessProfile?.outboxRetryCount, readinessProfile?.outboxMaxRetries);
  const nextRetryValue = latestOutbox?.nextRetryAt ? formatDateTime(latestOutbox.nextRetryAt) : "Planlı değil";
  const errorCodeValue = latestError?.errorCode ?? readinessProfile?.lastErrorCode ?? "Aktif hata kodu yok";
  const errorSummary =
    latestError?.errorMessage ?? latestOutbox?.errorMessage ?? readinessProfile?.lastErrorMessage ?? "Aktif hata yok";
  const latestAuditSummary = latestAudit
    ? `${latestAudit.action} / ${formatDateTime(latestAudit.createdAt)}`
    : "Kayıt yok";
  const blockingCodes = Array.from(
    new Set([
      ...(readinessProfile?.blockingCodes ?? []),
      ...localIssues.map((issue) => issue.code).filter((issue): issue is string => Boolean(issue)),
    ]),
  );
  const readinessBlockingCodeSet = new Set(readinessProfile?.blockingCodes ?? []);
  const readinessScopeLabel = formatPlainValue(readinessProfile?.scopeLabel, "Belge Hazirligi");

  return (
    <Card
      style={{
        borderRadius: RADIUS.lg,
        border: `1px solid ${COLORS.border}`,
        background: `linear-gradient(180deg, ${primaryRgba(0.05)}, ${COLORS.bg.elevated ?? COLORS.bg.surface})`,
      }}
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div style={{ display: "grid", gap: 4 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: COLORS.text }}>{title}</span>
            <span style={{ fontSize: 12, color: COLORS.muted }}>
              Dış sistem kimliği, sync izi ve hata özeti ortak entegrasyon omurgasından okunur.
            </span>
          </div>
          <Button type="button" variant="ghost" onClick={() => void loadPanel()} disabled={!entityId || loading}>
            <RefreshCcw size={14} />
            {loading ? "Yükleniyor..." : "Yenile"}
          </Button>
        </div>

        {!entityId ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "12px 14px",
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
              background: COLORS.bg.surface,
              color: COLORS.muted,
              fontSize: 13,
            }}
          >
            Teknik kayıt bağlamı henüz seçilmedi.
          </div>
        ) : null}

        {loadError ? (
          <div
            role="alert"
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
            <span>{loadError}</span>
          </div>
        ) : null}

        {readinessProfile ? (
          <div
            role="region"
            aria-label="ERP Handoff Profili"
            style={{
              display: "grid",
              gap: 12,
              padding: "14px 16px",
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.border}`,
              background: primaryRgba(0.06),
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  ERP Handoff Profili
                </span>
                <span style={{ fontSize: 13, color: COLORS.text }}>
                  {readinessScopeLabel} readiness, master data ve teknik aktarim blokajlari ayni panelde izlenir.
                </span>
              </div>
              <Badge variant={blockingCodes.length === 0 ? "success" : "warning"}>
                {readinessProfile.readyFields} / {readinessProfile.totalFields} hazir alan
              </Badge>
            </div>

            {blockingCodes.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {blockingCodes.map((code) => (
                  <Badge key={code} variant="warning">
                    {code}
                  </Badge>
                ))}
              </div>
            ) : null}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 10 }}>
              {readinessProfile.fields.map((field) => (
                <div
                  key={field.key}
                  style={{
                    display: "grid",
                    gap: 6,
                    padding: 12,
                    borderRadius: RADIUS.md,
                    border: `1px solid ${field.ready ? `${COLORS.success}40` : `${COLORS.warning}40`}`,
                    background: field.ready ? `${COLORS.success}10` : `${COLORS.warning}10`,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ fontSize: 13, color: COLORS.text }}>{field.label}</strong>
                    <Badge variant={field.ready ? "success" : "warning"}>
                      {field.ready ? "Hazir" : "Eksik"}
                    </Badge>
                  </div>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>{field.owner}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: COLORS.text }}>{field.value}</span>
                  <span style={{ fontSize: 12, color: COLORS.muted }}>{field.note}</span>
                  {field.blockingCode ? (
                    <span style={{ fontSize: 11, color: COLORS.muted }}>
                      Blokaj Kodu: {field.blockingCode}
                      {field.blockingCount && field.blockingCount > 0 ? ` (${field.blockingCount})` : ""}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>

            {readinessProfile.masterDataStatus ||
            readinessProfile.entityMapStatus ||
            readinessProfile.accountMikroCariKod ||
            readinessProfile.lastSyncedAt ||
            readinessProfile.lastErrorAt ? (
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  padding: "12px 14px",
                  borderRadius: RADIUS.md,
                  border: `1px solid ${COLORS.border}`,
                  background: COLORS.bg.surface,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.muted, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    Operasyon Ozeti
                  </span>
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {readinessProfile.masterDataStatus ? (
                      <Badge variant={readinessProfile.masterDataStatus === "READY" ? "success" : "warning"}>
                        Master Data: {readinessProfile.masterDataStatus}
                      </Badge>
                    ) : null}
                    {readinessProfile.entityMapStatus ? (
                      <Badge variant={statusVariant(readinessProfile.entityMapStatus)}>
                        Entity Map: {readinessProfile.entityMapStatus}
                      </Badge>
                    ) : null}
                    {readinessProfile.outboxStatus ? (
                      <Badge variant={statusVariant(readinessProfile.outboxStatus)}>
                        Outbox: {readinessProfile.outboxStatus}
                      </Badge>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                  <DetailField label="Belge Kapsami" value={readinessScopeLabel} />
                  <DetailField label="Kaynak Sistem" value={formatPlainValue(readinessProfile.sourceSystem, "MIKRO")} />
                  <DetailField label="Master Data" value={formatPlainValue(readinessProfile.masterDataSummary)} />
                  <DetailField label="Cari Mikro Kodu" value={formatPlainValue(readinessProfile.accountMikroCariKod)} />
                  <DetailField label="Entity Map Kimligi" value={formatPlainValue(readinessProfile.entityMapExternalId)} />
                  <DetailField label="Profil Retry" value={formatRetryValue(readinessProfile.outboxRetryCount, readinessProfile.outboxMaxRetries)} />
                  <DetailField label="Profil Son Sync" value={formatDateTime(readinessProfile.lastSyncedAt)} />
                  <DetailField label="Profil Son Hata" value={formatDateTime(readinessProfile.lastErrorAt)} />
                  <DetailField label="Profil Hata Kodu" value={formatPlainValue(readinessProfile.lastErrorCode, "Aktif hata kodu yok")} />
                </div>
                {readinessProfile.lastErrorMessage ? (
                  <div style={{ fontSize: 12, color: COLORS.danger }}>{readinessProfile.lastErrorMessage}</div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        {localIssues.length > 0 ? (
          <div
            role="alert"
            style={{
              display: "grid",
              gap: 10,
              padding: "12px 14px",
              borderRadius: RADIUS.md,
              border: `1px solid ${COLORS.warning}`,
              background: `${COLORS.warning}10`,
            }}
          >
            <span style={{ fontSize: 12, fontWeight: 700, color: COLORS.text, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              Aktarim Blokajlari
            </span>
            <div style={{ display: "grid", gap: 8 }}>
              {localIssues.map((issue, index) => (
                <div key={`${issue.code ?? "issue"}-${index}`} style={{ display: "grid", gap: 4 }}>
                  {issue.code && !readinessBlockingCodeSet.has(issue.code) ? <Badge variant="warning">{issue.code}</Badge> : null}
                  <span style={{ fontSize: 13, color: COLORS.text }}>{issue.message}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
          <DetailField label="Dış Sistem Kimliği" value={externalIdentity} />
          <div style={{ display: "grid", gap: 6 }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: COLORS.muted,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Sync Durumu
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <Badge variant={statusVariant(latestOutbox?.status)}>{outboxStatus}</Badge>
              {latestOutbox?.operation ? <span style={{ fontSize: 12, color: COLORS.muted }}>{latestOutbox.operation}</span> : null}
            </div>
          </div>
          <DetailField label="Son Aktarım" value={formatDateTime(lastSyncedAt)} />
          <DetailField label="Retry" value={retryValue} />
          <DetailField label="Sonraki Retry" value={nextRetryValue} />
        </div>

        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <DetailField label="Hata Kodu" value={errorCodeValue} />
          <DetailField label="Hata Özeti" value={errorSummary} />
          <DetailField label="Son Audit" value={latestAuditSummary} />
        </div>
      </div>
    </Card>
  );
}

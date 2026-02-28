import React, { useState, useEffect, useRef, useCallback } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Circle } from "lucide-react";
import { mikroService } from "../../services/mikroService";
import { TopBar } from "../Layout/TopBar";
import { Button, Card, COLORS, RADIUS, TYPOGRAPHY } from "../Shared";

interface IntegrationStatus {
  status: string;
  connection?: boolean;
  message?: string;
  database?: string;
  pendingSyncs?: number;
  successRate?: number;
  error?: string;
  host?: string;
  port?: number;
  provider?: string;
}

interface HealthErrorItem {
  entityType?: string;
  errorCode?: string;
  errorMessage?: string;
  entityId?: string | number;
  timestamp?: string;
}

interface HealthData {
  overallStatus: string;
  timestamp: string;
  integrations: {
    MIKRO?: IntegrationStatus;
    SMTP?: IntegrationStatus;
    SMS?: IntegrationStatus;
    EINVOICE?: IntegrationStatus;
    CARGO?: IntegrationStatus;
  };
  errors: HealthErrorItem[];
}

export function IntegrationHealth() {
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const REFRESH_MS = 30_000;
  const MAX_RETRY_MS = 120_000;
  const retryDelayRef = useRef(REFRESH_MS);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);

  const loadHealth = useCallback(async () => {
    try {
      setLoading(true);
      const data = await mikroService.checkHealth() as HealthData;
      setHealth(data);
      setError(null);
      setLoading(false);
      retryDelayRef.current = REFRESH_MS; // Basarida sifirla
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
      setLoading(false);
      retryDelayRef.current = Math.min(retryDelayRef.current * 2, MAX_RETRY_MS); // Exponential backoff
    }
    // Sonraki yenilemeyi planla
    if (isMountedRef.current) {
      timerRef.current = setTimeout(() => void loadHealth(), retryDelayRef.current);
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    void loadHealth();
    return () => {
      isMountedRef.current = false;
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [loadHealth]);

  function getStatusSurface(status: string) {
    switch (status) {
      case "HEALTHY":
        return {
          background: COLORS.success.light,
          color: COLORS.success.DEFAULT,
          border: `1px solid ${COLORS.success.dark}`,
        };
      case "DEGRADED":
        return {
          background: COLORS.warning.light,
          color: COLORS.warning.DEFAULT,
          border: `1px solid ${COLORS.warning.DEFAULT}`,
        };
      case "UNHEALTHY":
      case "ERROR":
        return {
          background: COLORS.error.light,
          color: COLORS.error.DEFAULT,
          border: `1px solid ${COLORS.error.DEFAULT}`,
        };
      case "DISABLED":
        return {
          background: COLORS.bg.subtle,
          color: COLORS.muted,
          border: `1px solid ${COLORS.border}`,
        };
      default:
        return {
          background: COLORS.bg.subtle,
          color: COLORS.muted,
          border: `1px solid ${COLORS.border}`,
        };
    }
  }

  function getStatusBadgeStyle(status: string) {
    switch (status) {
      case "HEALTHY":
        return { background: COLORS.success.light, color: COLORS.success.DEFAULT };
      case "DEGRADED":
        return { background: COLORS.warning.light, color: COLORS.warning.DEFAULT };
      case "UNHEALTHY":
      case "ERROR":
        return { background: COLORS.error.light, color: COLORS.error.DEFAULT };
      case "DISABLED":
        return { background: COLORS.bg.elevated, color: COLORS.muted };
      default:
        return { background: COLORS.bg.elevated, color: COLORS.muted };
    }
  }

  function getStatusIcon(status: string) {
    const iconProps = { size: 16, strokeWidth: 2.5, style: { display: 'inline-block', verticalAlign: 'middle' } };
    switch (status) {
      case "HEALTHY":
        return <CheckCircle2 {...iconProps} color={COLORS.success.DEFAULT} aria-label="Sağlıklı" />;
      case "DEGRADED":
        return <AlertTriangle {...iconProps} color={COLORS.warning.DEFAULT} aria-label="Kısmi sorun" />;
      case "UNHEALTHY":
      case "ERROR":
        return <XCircle {...iconProps} color={COLORS.error.DEFAULT} aria-label="Sorunlu" />;
      case "DISABLED":
        return <Circle {...iconProps} color={COLORS.muted} aria-label="Devre dışı" />;
      default:
        return <Circle {...iconProps} color={COLORS.muted} aria-label="Bilinmiyor" />;
    }
  }

  if (loading && !health) {
    return (
      <div className="electric-page">
        <TopBar
          title="Entegrasyon Saglik Kontrolu"
          subtitle="Servislerin anlik baglanti ve hata durumu"
          breadcrumbs={["Entegrasyonlar", "Saglik"]}
        />
        <div
          className="app-page-container"
          style={{
            minHeight: "60vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: COLORS.muted,
            fontSize: TYPOGRAPHY.fontSize.sm,
          }}
        >
          Saglik durumu kontrol ediliyor...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="electric-page">
        <TopBar
          title="Entegrasyon Saglik Kontrolu"
          subtitle="Servislerin anlik baglanti ve hata durumu"
          breadcrumbs={["Entegrasyonlar", "Saglik"]}
        />
        <div className="app-page-container">
          <div
            style={{
              padding: 12,
              borderRadius: RADIUS.md,
              background: COLORS.error.light,
              color: COLORS.error.DEFAULT,
              border: `1px solid ${COLORS.error.DEFAULT}`,
            }}
          >
            Saglik kontrolu hatasi: {error}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="electric-page">
      <TopBar
        title="Entegrasyon Saglik Kontrolu"
        subtitle="Servislerin anlik baglanti ve hata durumu"
        breadcrumbs={["Entegrasyonlar", "Saglik"]}
      >
        <Button variant="secondary" size="sm" onClick={loadHealth}>
          Yenile
        </Button>
      </TopBar>

      <div
        className="app-page-container"
        style={{
          display: "grid",
          gap: 20,
        }}
      >
        {health && (
          <>
            {/* Genel Durum */}
            <div
              style={{
                padding: 16,
                borderRadius: RADIUS.md,
                ...getStatusSurface(health.overallStatus),
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: 18, fontWeight: TYPOGRAPHY.fontWeight.bold }}>
                    Genel Durum
                  </h2>
                  <p style={{ margin: "6px 0 0", fontSize: 12 }}>
                    Son guncelleme: {new Date(health.timestamp).toLocaleString("tr-TR")}
                  </p>
                </div>
                <div style={{ fontSize: 32 }}>{getStatusIcon(health.overallStatus)}</div>
              </div>
            </div>

            {/* Entegrasyon Kartları */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
                gap: 16,
              }}
            >
              {/* Mikro SQL */}
              {health.integrations.MIKRO && (
                <Card title="Mikro SQL">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{getStatusIcon(health.integrations.MIKRO.status)}</span>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: RADIUS.sm,
                        fontSize: 11,
                        fontWeight: TYPOGRAPHY.fontWeight.semibold,
                        ...getStatusBadgeStyle(health.integrations.MIKRO.status),
                      }}
                    >
                      {health.integrations.MIKRO.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: COLORS.muted }}>Durum:</span>
                      <span
                        style={{
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          color: health.integrations.MIKRO.connection ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
                        }}
                      >
                        {health.integrations.MIKRO.connection ? "Bagli" : "Baglanti Hatasi"}
                      </span>
                    </div>

                    {health.integrations.MIKRO.database && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ color: COLORS.muted }}>Veritabani:</span>
                        <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                          {health.integrations.MIKRO.database}
                        </span>
                      </div>
                    )}

                    {health.integrations.MIKRO.pendingSyncs !== undefined && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ color: COLORS.muted }}>Bekleyen Senkron:</span>
                        <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                          {health.integrations.MIKRO.pendingSyncs}
                        </span>
                      </div>
                    )}

                    {health.integrations.MIKRO.successRate !== undefined && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ color: COLORS.muted }}>Basari Orani:</span>
                        <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                          %{health.integrations.MIKRO.successRate}
                        </span>
                      </div>
                    )}

                    {health.integrations.MIKRO.error && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: 8,
                          borderRadius: RADIUS.sm,
                          background: COLORS.error.light,
                          color: COLORS.error.DEFAULT,
                          fontSize: 11,
                        }}
                      >
                        {health.integrations.MIKRO.error}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* SMTP */}
              {health.integrations.SMTP && (
                <Card title="E-posta (SMTP)">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{getStatusIcon(health.integrations.SMTP.status)}</span>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: RADIUS.sm,
                        fontSize: 11,
                        fontWeight: TYPOGRAPHY.fontWeight.semibold,
                        ...getStatusBadgeStyle(health.integrations.SMTP.status),
                      }}
                    >
                      {health.integrations.SMTP.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: COLORS.muted }}>Durum:</span>
                      <span
                        style={{
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          color: health.integrations.SMTP.connection ? COLORS.success.DEFAULT : COLORS.muted,
                        }}
                      >
                        {health.integrations.SMTP.connection ? "Aktif" : health.integrations.SMTP.message}
                      </span>
                    </div>

                    {health.integrations.SMTP.host && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ color: COLORS.muted }}>Host:</span>
                        <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                          {health.integrations.SMTP.host}:{health.integrations.SMTP.port}
                        </span>
                      </div>
                    )}

                    {health.integrations.SMTP.error && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: 8,
                          borderRadius: RADIUS.sm,
                          background: COLORS.error.light,
                          color: COLORS.error.DEFAULT,
                          fontSize: 11,
                        }}
                      >
                        {health.integrations.SMTP.error}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* SMS */}
              {health.integrations.SMS && (
                <Card title="SMS Gateway">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{getStatusIcon(health.integrations.SMS.status)}</span>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: RADIUS.sm,
                        fontSize: 11,
                        fontWeight: TYPOGRAPHY.fontWeight.semibold,
                        ...getStatusBadgeStyle(health.integrations.SMS.status),
                      }}
                    >
                      {health.integrations.SMS.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: COLORS.muted }}>Durum:</span>
                      <span
                        style={{
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          color: health.integrations.SMS.connection ? COLORS.success.DEFAULT : COLORS.muted,
                        }}
                      >
                        {health.integrations.SMS.connection ? "Aktif" : health.integrations.SMS.message}
                      </span>
                    </div>

                    {health.integrations.SMS.provider && (
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ color: COLORS.muted }}>Provider:</span>
                        <span style={{ fontWeight: TYPOGRAPHY.fontWeight.semibold }}>
                          {health.integrations.SMS.provider}
                        </span>
                      </div>
                    )}

                    {health.integrations.SMS.error && (
                      <div
                        style={{
                          marginTop: 4,
                          padding: 8,
                          borderRadius: RADIUS.sm,
                          background: COLORS.error.light,
                          color: COLORS.error.DEFAULT,
                          fontSize: 11,
                        }}
                      >
                        {health.integrations.SMS.error}
                      </div>
                    )}
                  </div>
                </Card>
              )}

              {/* e-Fatura */}
              {health.integrations.EINVOICE && (
                <Card title="e-Fatura">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{getStatusIcon(health.integrations.EINVOICE.status)}</span>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: RADIUS.sm,
                        fontSize: 11,
                        fontWeight: TYPOGRAPHY.fontWeight.semibold,
                        ...getStatusBadgeStyle(health.integrations.EINVOICE.status),
                      }}
                    >
                      {health.integrations.EINVOICE.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: COLORS.muted }}>Durum:</span>
                      <span
                        style={{
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          color: health.integrations.EINVOICE.connection ? COLORS.success.DEFAULT : COLORS.muted,
                        }}
                      >
                        {health.integrations.EINVOICE.message}
                      </span>
                    </div>
                  </div>
                </Card>
              )}

              {/* Kargo */}
              {health.integrations.CARGO && (
                <Card title="Kargo">
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <span style={{ fontSize: 28 }}>{getStatusIcon(health.integrations.CARGO.status)}</span>
                    <span
                      style={{
                        padding: "4px 8px",
                        borderRadius: RADIUS.sm,
                        fontSize: 11,
                        fontWeight: TYPOGRAPHY.fontWeight.semibold,
                        ...getStatusBadgeStyle(health.integrations.CARGO.status),
                      }}
                    >
                      {health.integrations.CARGO.status}
                    </span>
                  </div>

                  <div style={{ display: "grid", gap: 8, fontSize: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                      <span style={{ color: COLORS.muted }}>Durum:</span>
                      <span
                        style={{
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          color: health.integrations.CARGO.connection ? COLORS.success.DEFAULT : COLORS.muted,
                        }}
                      >
                        {health.integrations.CARGO.message}
                      </span>
                    </div>
                  </div>
                </Card>
              )}
            </div>

            {/* Hatalar */}
            {health.errors && health.errors.length > 0 && (
              <Card title="Son Hatalar">
                <div style={{ display: "grid", gap: 12 }}>
                  {health.errors.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: 12,
                        background: COLORS.error.light,
                        borderRadius: RADIUS.md,
                        border: `1px solid ${COLORS.error.DEFAULT}`,
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: TYPOGRAPHY.fontWeight.semibold,
                              color: COLORS.error.DEFAULT,
                            }}
                          >
                            {item.entityType ?? "UNKNOWN"} - {item.errorCode || "UNKNOWN"}
                          </div>
                          <div style={{ fontSize: 12, color: COLORS.gray[500] }}>
                            {item.errorMessage ?? "Bilinmeyen hata"}
                          </div>
                          {item.entityId !== undefined && item.entityId !== null && (
                            <div style={{ fontSize: 11, color: COLORS.gray[400], marginTop: 2 }}>
                              Entity ID: {String(item.entityId)}
                            </div>
                          )}
                        </div>
                        <div style={{ fontSize: 11, color: COLORS.error.DEFAULT, whiteSpace: "nowrap" }}>
                          {item.timestamp ? new Date(item.timestamp).toLocaleString("tr-TR") : "-"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {/* Hata yoksa */}
            {health.errors && health.errors.length === 0 && (
              <div
                style={{
                  padding: 12,
                  borderRadius: RADIUS.md,
                  background: COLORS.success.light,
                  color: COLORS.success.DEFAULT,
                  border: `1px solid ${COLORS.success.DEFAULT}`,
                  fontSize: 12,
                }}
              >
                [OK] Son 24 saatte entegrasyon hatasi bulunmamaktadir.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default IntegrationHealth;

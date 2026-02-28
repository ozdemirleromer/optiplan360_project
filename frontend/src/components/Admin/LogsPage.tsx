/**
 * Sistem Logları Sayfası
 * Hata yönetimi ve basit filtreleme
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { TopBar } from "../Layout";
import { Button, Card } from "../Shared";
import { COLORS, RADIUS } from "../Shared/constants";
import { adminService } from "../../services/adminService";
import type { AuditLog } from "../../services/adminService";

// Log level enum for type-safe filtering
type LogLevel = "ERROR" | "WARNING" | "INFO" | "DEBUG";

interface LogEntry extends AuditLog {
  level?: LogLevel;
}

interface LogStats {
  total: number;
  errors: number;
  warnings: number;
  info: number;
  debug: number;
}

export function LogsPage() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState({ 
    user: "", 
    action: "", 
    date: "", 
    level: "all" as LogLevel | "all"
  });
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalLogs, setTotalLogs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.listLogs(page, pageSize);
      const logsWithLevel = data.map((log) => ({
        ...log,
        level: (
          log.action?.includes("ERROR") ? "ERROR" :
          log.action?.includes("WARNING") ? "WARNING" :
          log.action?.includes("DEBUG") ? "DEBUG" :
          "INFO"
        ) as LogLevel
      }));
      setLogs(logsWithLevel);
      setTotalLogs(data.length >= pageSize ? page * pageSize + 10 : page * pageSize - (pageSize - data.length));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Loglar yüklenemedi";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesUser = !filter.user || (log.username || "").toLowerCase().includes(filter.user.toLowerCase());
      const matchesAction = !filter.action || (log.action || "").toLowerCase().includes(filter.action.toLowerCase());
      const matchesDate = !filter.date || new Date(log.createdAt).toLocaleDateString("tr-TR").includes(filter.date);
      const matchesLevel = filter.level === "all" || log.level === filter.level;
      return matchesUser && matchesAction && matchesDate && matchesLevel;
    });
  }, [logs, filter]);

  const stats = useMemo<LogStats>(() => ({
    total: logs.length,
    errors: logs.filter((l) => l.level === "ERROR").length,
    warnings: logs.filter((l) => l.level === "WARNING").length,
    info: logs.filter((l) => l.level === "INFO").length,
    debug: logs.filter((l) => l.level === "DEBUG").length,
  }), [logs]);

  const getLogLevelColor = (level: LogLevel): string => {
    switch (level) {
      case "ERROR":
        return COLORS.error.DEFAULT;
      case "WARNING":
        return COLORS.warning.DEFAULT;
      case "INFO":
        return "#06b6d4";
      case "DEBUG":
        return COLORS.gray[400];
      default:
        return COLORS.gray[400];
    }
  };

  const getLogLevelLabel = (level: LogLevel) => {
    const labels: Record<LogLevel, string> = {
      ERROR: "Hata",
      WARNING: "Uyarı",
      INFO: "Bilgi",
      DEBUG: "Debug",
    };
    return labels[level];
  };

  const totalPages = Math.ceil(totalLogs / pageSize);

  return (
    <div>
      <TopBar
        title="Sistem Logları"
        subtitle="Sistem olayları ve hata kayıtları"
        breadcrumbs={["Yönetim", "Loglar"]}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Button variant="secondary" onClick={() => void loadLogs()} disabled={loading}>
            {loading ? "Yenileniyor..." : "Yenile"}
          </Button>
        </div>
      </TopBar>

      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto", display: "grid", gap: 16 }}>
        {/* Statistics Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
          <Card
            style={{
              background: `linear-gradient(135deg, ${'#06b6d4'}22, ${'#06b6d4'}11)`,
              borderLeft: `4px solid ${'#06b6d4'}`,
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.muted }}>Toplam Loglar</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#06b6d4" }}>{stats.total}</div>
          </Card>
          <Card
            style={{
              background: `linear-gradient(135deg, ${COLORS.error.DEFAULT}22, ${COLORS.error.DEFAULT}11)`,
              borderLeft: `4px solid ${COLORS.error.DEFAULT}`,
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.muted }}>Hatalar</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.error.DEFAULT }}>{stats.errors}</div>
          </Card>
          <Card
            style={{
              background: `linear-gradient(135deg, ${COLORS.warning.DEFAULT}22, ${COLORS.warning.DEFAULT}11)`,
              borderLeft: `4px solid ${COLORS.warning.DEFAULT}`,
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.muted }}>Uyarılar</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.warning.DEFAULT }}>{stats.warnings}</div>
          </Card>
          <Card
            style={{
              background: `linear-gradient(135deg, ${'#06b6d4'}22, ${'#06b6d4'}11)`,
              borderLeft: `4px solid ${'#06b6d4'}`,
            }}
          >
            <div style={{ fontSize: 12, color: COLORS.muted }}>Bilgiler</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: "#06b6d4" }}>{stats.info}</div>
          </Card>
        </div>

        {/* Error Display */}
        {error && (
          <Card style={{ background: `${COLORS.error.DEFAULT}15`, borderLeft: `4px solid ${COLORS.error.DEFAULT}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ color: COLORS.error.DEFAULT, fontSize: 13 }}>
                <strong>Hata:</strong> {error}
              </span>
              <button
                onClick={() => setError(null)}
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: COLORS.error.DEFAULT,
                  fontSize: 18,
                }}
              >
                ×
              </button>
            </div>
          </Card>
        )}

        {/* Filters */}
        <Card title="Log Filtreleri">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Kullanıcı</label>
              <input
                placeholder="Ara..."
                value={filter.user}
                onChange={(e) => {
                  setFilter((s) => ({ ...s, user: e.target.value }));
                  setPage(1);
                }}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  fontSize: 12,
                  width: "100%",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>İşlem</label>
              <input
                placeholder="Ara..."
                value={filter.action}
                onChange={(e) => {
                  setFilter((s) => ({ ...s, action: e.target.value }));
                  setPage(1);
                }}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  fontSize: 12,
                  width: "100%",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Tarih</label>
              <input
                type="date"
                value={filter.date}
                onChange={(e) => {
                  setFilter((s) => ({ ...s, date: e.target.value }));
                  setPage(1);
                }}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  fontSize: 12,
                  width: "100%",
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Seviye</label>
              <select
                value={filter.level}
                onChange={(e) => {
                  setFilter((s) => ({ ...s, level: e.target.value as LogLevel | "all" }));
                  setPage(1);
                }}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  fontSize: 12,
                  width: "100%",
                }}
              >
                <option value="all">Tümü</option>
                <option value="ERROR">Hatalar</option>
                <option value="WARNING">Uyarılar</option>
                <option value="INFO">Bilgiler</option>
                <option value="DEBUG">Debug</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Sayfa Boyutu</label>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                style={{
                  padding: "8px 12px",
                  border: `1px solid ${COLORS.border}`,
                  borderRadius: RADIUS.sm,
                  fontSize: 12,
                  width: "100%",
                }}
              >
                <option value="25">25 kayıt</option>
                <option value="50">50 kayıt</option>
                <option value="100">100 kayıt</option>
                <option value="200">200 kayıt</option>
              </select>
            </div>
          </div>
        </Card>

        {/* Logs Table */}
        <Card title={`Log Kayıtları (${filteredLogs.length} / ~${totalLogs})`}>
          {filteredLogs.length === 0 ? (
            <div style={{ textAlign: "center", padding: 40, color: COLORS.muted }}>
              {loading ? "Yükleniyor..." : "Kayıt bulunamadı"}
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Tarih</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Kullanıcı</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Seviye</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>İşlem</th>
                      <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Detay</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLogs.map((log) => (
                      <tr
                        key={log.id}
                        onClick={() => setSelectedLog(log)}
                        style={{
                          borderBottom: `1px solid ${COLORS.border}`,
                          cursor: "pointer",
                          background: selectedLog?.id === log.id ? `${COLORS.primary}11` : "transparent",
                        }}
                      >
                        <td style={{ padding: 10, fontSize: 11 }}>
                          {new Date(log.createdAt).toLocaleString("tr-TR")}
                        </td>
                        <td style={{ padding: 10, fontWeight: 600 }}>{log.username || "Sistem"}</td>
                        <td style={{ padding: 10 }}>
                          <span
                            style={{
                              background: `${getLogLevelColor(log.level || "INFO")}22`,
                              color: getLogLevelColor(log.level || "INFO"),
                              padding: "4px 8px",
                              borderRadius: 3,
                              fontSize: 10,
                              fontWeight: 600,
                            }}
                          >
                            {getLogLevelLabel(log.level || "INFO")}
                          </span>
                        </td>
                        <td style={{ padding: 10 }}>{log.action || "—"}</td>
                        <td style={{ padding: 10, color: COLORS.muted, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {log.detail || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: `1px solid ${COLORS.border}`, paddingTop: 12 }}>
                <span style={{ fontSize: 12, color: COLORS.muted }}>
                  Sayfa {page} / {totalPages || 1}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1 || loading}
                    style={{
                      background: page === 1 || loading ? COLORS.gray[300] : COLORS.gray[200],
                      color: page === 1 || loading ? COLORS.gray[400] : COLORS.gray[700],
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: RADIUS.sm,
                      cursor: page === 1 || loading ? "default" : "pointer",
                      fontSize: 11,
                    }}
                  >
                    Önceki
                  </button>
                  <button
                    onClick={() => setPage((p) => p + 1)}
                    disabled={page >= totalPages || loading}
                    style={{
                      background: page >= totalPages || loading ? COLORS.gray[300] : COLORS.gray[200],
                      color: page >= totalPages || loading ? COLORS.gray[400] : COLORS.gray[700],
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: RADIUS.sm,
                      cursor: page >= totalPages || loading ? "default" : "pointer",
                      fontSize: 11,
                    }}
                  >
                    Sonraki
                  </button>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

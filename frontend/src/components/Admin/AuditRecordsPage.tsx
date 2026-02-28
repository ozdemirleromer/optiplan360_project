/**
 * Audit Records Page — Enhanced
 * Field-level change tracking with entity history
 */

import { useState, useEffect, useMemo, useCallback } from "react";
import { TopBar } from "../Layout";
import { Card } from "../Shared";
import { COLORS } from "../Shared/constants";
import { adminService } from "../../services/adminService";

// Type definitions matching backend AuditRecord model
interface AuditRecordOut {
  id: string;
  userId: number;
  userName?: string;
  timestamp: string;
  entityType: string;
  entityId: string;
  entityName?: string;
  operation: "CREATE" | "UPDATE" | "DELETE" | "LOGIN" | "EXPORT";
  fieldName?: string;
  oldValue: string | null;
  newValue: string | null;
  reason?: string;
  ipAddress?: string;
  userAgent?: string;
  success: boolean;
  errorMessage?: string;
}

interface AuditStats {
  total: number;
  byOperation: Record<string, number>;
  byEntity: Record<string, number>;
}

export function AuditRecordsPage() {
  const [records, setRecords] = useState<AuditRecordOut[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<AuditRecordOut | null>(null);
  const [filter, setFilter] = useState({
    entity_type: "",
    operation: "",
    user_id: "",
    entity_id: "",
    date_from: "",
    date_to: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ offset: 0, limit: 50 });

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getAuditRecords({
        entity_type: filter.entity_type || undefined,
        operation: filter.operation || undefined,
        user_id: filter.user_id ? parseInt(filter.user_id, 10) : undefined,
        date_from: filter.date_from || undefined,
        date_to: filter.date_to || undefined,
        limit: pagination.limit,
        offset: pagination.offset,
      }) as AuditRecordOut[];
      setRecords(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Denetim kayıtları yüklenemedi");
    } finally {
      setLoading(false);
    }
  }, [filter, pagination]);

  const loadStats = useCallback(async () => {
    try {
      const data = await adminService.getActivityStats({
        date_from: filter.date_from || undefined,
        date_to: filter.date_to || undefined,
      }) as unknown;
      setStats(data as AuditStats);
    } catch (err) {
      console.error("Failed to load stats", err);
    }
  }, [filter]);

  useEffect(() => {
    loadRecords();
    loadStats();
  }, [loadRecords, loadStats]);

  const handleFilter = () => {
    setPagination({ offset: 0, limit: 50 }); // Reset pagination on filter
    loadRecords();
  };

  const filteredRecords = useMemo(() => {
    if (!filter.entity_id) return records;
    return records.filter((rec) => rec.entityId.includes(filter.entity_id));
  }, [records, filter.entity_id]);

  const getOperationColor = (op: string): string => {
    switch (op) {
      case "CREATE":
        return COLORS.success.DEFAULT;
      case "UPDATE":
        return COLORS.warning.DEFAULT;
      case "DELETE":
        return COLORS.error.DEFAULT;
      case "LOGIN":
        return "#06b6d4";
      case "EXPORT":
        return "#06b6d4";
      default:
        return COLORS.gray[400];
    }
  };

  const getOperationLabel = (op: string) => {
    const labels: Record<string, string> = {
      CREATE: "Oluşturma",
      UPDATE: "Güncelleme",
      DELETE: "Silme",
      LOGIN: "Giriş",
      EXPORT: "İhracat",
    };
    return labels[op] || op;
  };

  return (
    <div>
      <TopBar
        title="Denetim Kayıtları"
        subtitle="Sistem değişiklik tarihi ve izleme"
        breadcrumbs={["Yönetim", "Denetim"]}
      />

      <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto", display: "grid", gap: 16 }}>
        {/* Statistics Cards */}
        {stats && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
            <Card
              style={{
                background: `linear-gradient(135deg, ${'#06b6d4'}22, ${'#06b6d4'}11)`,
                borderLeft: `4px solid ${'#06b6d4'}`,
              }}
            >
              <div style={{ fontSize: 12, color: COLORS.muted }}>Toplam Kayıtlar</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#06b6d4" }}>{stats.total}</div>
            </Card>
            <Card
              style={{
                background: `linear-gradient(135deg, ${COLORS.success.DEFAULT}22, ${COLORS.success.DEFAULT}11)`,
                borderLeft: `4px solid ${COLORS.success.DEFAULT}`,
              }}
            >
              <div style={{ fontSize: 12, color: COLORS.muted }}>Oluşturma</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.success.DEFAULT }}>
                {stats.byOperation["CREATE"] || 0}
              </div>
            </Card>
            <Card
              style={{
                background: `linear-gradient(135deg, ${COLORS.warning.DEFAULT}22, ${COLORS.warning.DEFAULT}11)`,
                borderLeft: `4px solid ${COLORS.warning.DEFAULT}`,
              }}
            >
              <div style={{ fontSize: 12, color: COLORS.muted }}>Güncelleme</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.warning.DEFAULT }}>
                {stats.byOperation["UPDATE"] || 0}
              </div>
            </Card>
            <Card
              style={{
                background: `linear-gradient(135deg, ${COLORS.error.DEFAULT}22, ${COLORS.error.DEFAULT}11)`,
                borderLeft: `4px solid ${COLORS.error.DEFAULT}`,
              }}
            >
              <div style={{ fontSize: 12, color: COLORS.muted }}>Silme</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: COLORS.error.DEFAULT }}>
                {stats.byOperation["DELETE"] || 0}
              </div>
            </Card>
          </div>
        )}

        {/* Filters */}
        <Card title="Filtreler">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Varlık Tipi</label>
              <select
                value={filter.entity_type}
                onChange={(e) => setFilter((p) => ({ ...p, entity_type: e.target.value }))}
              >
                <option value="">Tümü</option>
                <option value="order">Sipariş</option>
                <option value="user">Kullanıcı</option>
                <option value="station">İstasyon</option>
                <option value="config">Ayarlar</option>
                <option value="invoice">Fatura</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>İşlem</label>
              <select
                value={filter.operation}
                onChange={(e) => setFilter((p) => ({ ...p, operation: e.target.value }))}
              >
                <option value="">Tümü</option>
                <option value="CREATE">Oluşturma</option>
                <option value="UPDATE">Güncelleme</option>
                <option value="DELETE">Silme</option>
                <option value="LOGIN">Giriş</option>
                <option value="EXPORT">İhracat</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Varlık ID</label>
              <input
                placeholder="Ara..."
                value={filter.entity_id}
                onChange={(e) => setFilter((p) => ({ ...p, entity_id: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Kullanıcı ID</label>
              <input
                type="number"
                placeholder="Kullanıcı ID"
                value={filter.user_id}
                onChange={(e) => setFilter((p) => ({ ...p, user_id: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Başlangıç Tarihi</label>
              <input
                type="date"
                value={filter.date_from}
                onChange={(e) => setFilter((p) => ({ ...p, date_from: e.target.value }))}
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: COLORS.muted }}>Bitiş Tarihi</label>
              <input
                type="date"
                value={filter.date_to}
                onChange={(e) => setFilter((p) => ({ ...p, date_to: e.target.value }))}
              />
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button
              onClick={handleFilter}
              style={{
                background: "#06b6d4",
                color: "#fff",
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              Filtrele
            </button>
            <button
              onClick={() => {
                setFilter({ entity_type: "", operation: "", user_id: "", entity_id: "", date_from: "", date_to: "" });
              }}
              style={{
                background: COLORS.gray[200],
                color: COLORS.gray[600],
                border: "none",
                padding: "8px 16px",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Sıfırla
            </button>
          </div>
        </Card>

        {/* Error Display */}
        {error && (
          <Card style={{ background: `${COLORS.error.DEFAULT}15`, borderLeft: `4px solid ${COLORS.error.DEFAULT}` }}>
            <div style={{ color: COLORS.error.DEFAULT, fontSize: 13 }}>
              <strong>Hata:</strong> {error}
            </div>
          </Card>
        )}

        {/* Records Table */}
        <Card
          title={`Kayıtlar (${filteredRecords.length}${pagination.offset > 0 ? ` / +${pagination.offset}` : ""})`}
        >
          {loading ? (
            <div style={{ textAlign: "center", padding: 20, color: COLORS.muted }}>
              Yükleniyor...
            </div>
          ) : filteredRecords.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: COLORS.muted }}>
              Kayıt bulunamadı
            </div>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", fontSize: 12 }}>
                <thead>
                  <tr style={{ borderBottom: `2px solid ${COLORS.border}` }}>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Kullanıcı</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>İşlem</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Varlık</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Alan</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Eski Değer</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Yeni Değer</th>
                    <th style={{ padding: 10, textAlign: "left", fontWeight: 600 }}>Tarih</th>
                    <th style={{ padding: 10, textAlign: "center", fontWeight: 600 }}>Durum</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecords.map((r) => (
                    <tr
                      key={r.id}
                      onClick={() => setSelectedRecord(r)}
                      style={{
                        borderBottom: `1px solid ${COLORS.border}`,
                        cursor: "pointer",
                        background: selectedRecord?.id === r.id ? "#06b6d411" : "transparent",
                      }}
                    >
                      <td style={{ padding: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 600 }}>{r.userName || "Sistem"}</div>
                        <div style={{ fontSize: 10, color: COLORS.muted }}>{r.ipAddress || "—"}</div>
                      </td>
                      <td style={{ padding: 10 }}>
                        <span
                          style={{
                            background: `${getOperationColor(r.operation)}22`,
                            color: getOperationColor(r.operation),
                            padding: "4px 8px",
                            borderRadius: 3,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {getOperationLabel(r.operation)}
                        </span>
                      </td>
                      <td style={{ padding: 10 }}>
                        <div style={{ fontSize: 11 }}>{r.entityType}</div>
                        <div style={{ fontSize: 10, color: COLORS.muted }}>{r.entityId}</div>
                      </td>
                      <td style={{ padding: 10, fontSize: 11, color: COLORS.muted }}>{r.fieldName || "—"}</td>
                      <td style={{ padding: 10, fontSize: 11, color: COLORS.gray[400], maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.oldValue || "—"}
                      </td>
                      <td style={{ padding: 10, fontSize: 11, color: COLORS.gray[400], maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.newValue || "—"}
                      </td>
                      <td style={{ padding: 10, fontSize: 10, color: COLORS.muted }}>
                        {new Date(r.timestamp).toLocaleDateString("tr-TR")} {new Date(r.timestamp).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td style={{ padding: 10, textAlign: "center" }}>
                        <span
                          style={{
                            display: "inline-block",
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: r.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
                          }}
                          title={r.success ? "Başarılı" : r.errorMessage || "Başarısız"}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: COLORS.muted }}>
              Sayfa: {Math.floor(pagination.offset / pagination.limit) + 1}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() =>
                  setPagination((p) => ({
                    ...p,
                    offset: Math.max(0, p.offset - p.limit),
                  }))
                }
                disabled={pagination.offset === 0}
                style={{
                  background: pagination.offset === 0 ? COLORS.gray[300] : COLORS.gray[200],
                  color: pagination.offset === 0 ? COLORS.gray[400] : COLORS.gray[700],
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 4,
                  cursor: pagination.offset === 0 ? "default" : "pointer",
                  fontSize: 11,
                }}
              >
                Önceki
              </button>
              <button
                onClick={() =>
                  setPagination((p) => ({
                    ...p,
                    offset: p.offset + p.limit,
                  }))
                }
                disabled={filteredRecords.length < pagination.limit}
                style={{
                  background: filteredRecords.length < pagination.limit ? COLORS.gray[300] : COLORS.gray[200],
                  color: filteredRecords.length < pagination.limit ? COLORS.gray[400] : COLORS.gray[700],
                  border: "none",
                  padding: "6px 12px",
                  borderRadius: 4,
                  cursor: filteredRecords.length < pagination.limit ? "default" : "pointer",
                  fontSize: 11,
                }}
              >
                Sonraki
              </button>
            </div>
          </div>
        </Card>

        {/* Detail Modal */}
        {selectedRecord && (
          <Card
            title="Detay"
            style={{
              borderLeft: `4px solid ${getOperationColor(selectedRecord.operation)}`,
            }}
          >
            <div style={{ display: "grid", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: 12 }}>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Kullanıcı</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{selectedRecord.userName}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>İşlem</div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: getOperationColor(selectedRecord.operation),
                    }}
                  >
                    {getOperationLabel(selectedRecord.operation)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Varlık</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>
                    {selectedRecord.entityType} #{selectedRecord.entityId}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Tarih</div>
                  <div style={{ fontSize: 13 }}>
                    {new Date(selectedRecord.timestamp).toLocaleString("tr-TR")}
                  </div>
                </div>
              </div>
              {selectedRecord.fieldName && (
                <div style={{ background: "#f3f4f6", padding: 12, borderRadius: 4, display: "grid", gap: 8 }}>
                  <div style={{ fontSize: 11, color: COLORS.muted, fontWeight: 600 }}>Alan Değişikliği</div>
                  <div>
                    <div style={{ fontSize: 10, color: COLORS.muted }}>Alan: {selectedRecord.fieldName}</div>
                    <div style={{ fontSize: 12, marginTop: 4 }}>
                      <strong style={{ color: COLORS.error.DEFAULT }}>Eski:</strong> {selectedRecord.oldValue || "—"}
                    </div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>
                      <strong style={{ color: COLORS.success.DEFAULT }}>Yeni:</strong> {selectedRecord.newValue || "—"}
                    </div>
                  </div>
                </div>
              )}
              {selectedRecord.reason && (
                <div>
                  <div style={{ fontSize: 11, color: COLORS.muted }}>Neden</div>
                  <div style={{ fontSize: 12 }}>{selectedRecord.reason}</div>
                </div>
              )}
              {selectedRecord.ipAddress && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>IP Adresi</div>
                    <div style={{ fontSize: 12, fontFamily: "monospace" }}>{selectedRecord.ipAddress}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: COLORS.muted }}>Durum</div>
                    <div
                      style={{
                        fontSize: 12,
                        color: selectedRecord.success ? COLORS.success.DEFAULT : COLORS.error.DEFAULT,
                        fontWeight: 600,
                      }}
                    >
                      {selectedRecord.success ? "[OK] Başarılı" : `[HATA] ${selectedRecord.errorMessage || "Başarısız"}`}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

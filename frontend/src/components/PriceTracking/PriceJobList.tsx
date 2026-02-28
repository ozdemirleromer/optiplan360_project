import { Eye, Trash2 } from "lucide-react";
import type { PriceUploadJob } from "../../types";
import { Button, Card, COLORS, RADIUS, TYPOGRAPHY } from "../Shared";

interface PriceJobListProps {
  jobs: PriceUploadJob[];
  loading: boolean;
  activeJobId: string | null;
  selectedJobIds: string[];
  deletingJobId: string | null;
  onToggleSelect: (jobId: string) => void;
  onSelectDetail: (jobId: string) => void;
  onDelete: (jobId: string) => void;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("tr-TR");
}

function statusStyle(status: PriceUploadJob["status"]) {
  switch (status) {
    case "COMPLETED":
      return { background: "rgba(16,185,129,0.14)", color: COLORS.success.DEFAULT };
    case "FAILED":
      return { background: "rgba(239,68,68,0.14)", color: COLORS.error.DEFAULT };
    case "PROCESSING":
      return { background: "rgba(59,130,246,0.14)", color: COLORS.primary.DEFAULT };
    default:
      return { background: "rgba(148,163,184,0.18)", color: COLORS.muted };
  }
}

export function PriceJobList({
  jobs,
  loading,
  activeJobId,
  selectedJobIds,
  deletingJobId,
  onToggleSelect,
  onSelectDetail,
  onDelete,
}: PriceJobListProps) {
  return (
    <Card title="Yukleme Isleri" subtitle={`${jobs.length} kayit`}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th style={{ width: 42 }}>Sec</th>
              <th>Durum</th>
              <th>Dosya</th>
              <th>Tedarikci</th>
              <th>Satir</th>
              <th>Olusturma</th>
              <th style={{ width: 200 }}>Islemler</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} style={{ color: COLORS.muted, textAlign: "center", padding: 20 }}>
                  Is listesi yukleniyor...
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ color: COLORS.muted, textAlign: "center", padding: 20 }}>
                  Henuz yuklenmis fiyat listesi yok.
                </td>
              </tr>
            ) : (
              jobs.map((job) => {
                const selected = selectedJobIds.includes(job.id);
                const active = activeJobId === job.id;
                const chip = statusStyle(job.status);
                return (
                  <tr
                    key={job.id}
                    style={{
                      background: active ? "rgba(59,130,246,0.06)" : undefined,
                    }}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(job.id)}
                        aria-label={`${job.originalFilename ?? "Dosya"} sec`}
                      />
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          borderRadius: 999,
                          padding: "2px 8px",
                          fontSize: 11,
                          fontWeight: TYPOGRAPHY.fontWeight.semibold,
                          ...chip,
                        }}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td
                      style={{
                        maxWidth: 220,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={job.originalFilename ?? "-"}
                    >
                      {job.originalFilename ?? "-"}
                    </td>
                    <td>{job.supplier}</td>
                    <td>{job.rowsExtracted}</td>
                    <td>{formatDateTime(job.createdAt)}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={<Eye size={14} />}
                          onClick={() => onSelectDetail(job.id)}
                        >
                          Detay
                        </Button>
                        <Button
                          size="sm"
                          variant="danger"
                          icon={<Trash2 size={14} />}
                          onClick={() => onDelete(job.id)}
                          disabled={deletingJobId === job.id}
                          loading={deletingJobId === job.id}
                        >
                          Sil
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div
        style={{
          marginTop: 10,
          padding: "8px 10px",
          borderRadius: RADIUS.md,
          background: COLORS.bg.main,
          border: `1px solid ${COLORS.border}`,
          fontSize: 12,
          color: COLORS.muted,
        }}
      >
        Not: Export islemi icin birden fazla is secilebilir. Detay tablosu tek secili is icin gosterilir.
      </div>
    </Card>
  );
}

export default PriceJobList;

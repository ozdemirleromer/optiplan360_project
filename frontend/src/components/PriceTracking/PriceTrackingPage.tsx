import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import type { PriceJobDetail, PriceUploadJob } from "../../types";
import { priceTrackingService } from "../../services/priceTrackingService";
import { TopBar } from "../Layout";
import { Button, COLORS, RADIUS } from "../Shared";
import { PriceExportButton } from "./PriceExportButton";
import { PriceItemsTable } from "./PriceItemsTable";
import { PriceJobList } from "./PriceJobList";
import { PriceUploadForm } from "./PriceUploadForm";

type Feedback = {
  type: "success" | "error" | "info";
  text: string;
} | null;

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

export function PriceTrackingPage() {
  const [jobs, setJobs] = useState<PriceUploadJob[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<string[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [jobDetail, setJobDetail] = useState<PriceJobDetail | null>(null);

  const [loadingJobs, setLoadingJobs] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const hasBackgroundProcessing = useMemo(
    () => jobs.some((job) => job.status === "PENDING" || job.status === "PROCESSING"),
    [jobs],
  );

  const loadJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const data = await priceTrackingService.listJobs();
      setJobs(data);
      setSelectedJobIds((prev) => prev.filter((id) => data.some((job) => job.id === id)));
      if (activeJobId && !data.some((job) => job.id === activeJobId)) {
        setActiveJobId(null);
        setJobDetail(null);
      }
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Is listesi yuklenemedi",
      });
    } finally {
      setLoadingJobs(false);
    }
  }, [activeJobId]);

  const loadDetail = useCallback(async (jobId: string) => {
    setLoadingDetail(true);
    setActiveJobId(jobId);
    try {
      const detail = await priceTrackingService.getJobDetail(jobId);
      setJobDetail(detail);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Is detayi yuklenemedi",
      });
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (!hasBackgroundProcessing) return;
    const timer = window.setInterval(() => {
      void loadJobs();
      if (activeJobId) {
        void loadDetail(activeJobId);
      }
    }, 5000);
    return () => window.clearInterval(timer);
  }, [activeJobId, hasBackgroundProcessing, loadDetail, loadJobs]);

  const handleUpload = async (file: File, supplier: string) => {
    setUploading(true);
    setFeedback(null);
    try {
      const job = await priceTrackingService.uploadFile(file, supplier);
      await loadJobs();
      setFeedback({
        type: "success",
        text: `Yukleme alindi: ${job.originalFilename ?? job.id}`,
      });
      setActiveJobId(job.id);
      setSelectedJobIds((prev) => (prev.includes(job.id) ? prev : [job.id, ...prev]));
      await loadDetail(job.id);
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Yukleme basarisiz",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleToggleSelect = (jobId: string) => {
    setSelectedJobIds((prev) =>
      prev.includes(jobId) ? prev.filter((id) => id !== jobId) : [...prev, jobId],
    );
  };

  const handleDelete = async (jobId: string) => {
    if (!window.confirm("Secili yukleme isi silinsin mi?")) return;
    setDeletingJobId(jobId);
    setFeedback(null);
    try {
      await priceTrackingService.deleteJob(jobId);
      if (activeJobId === jobId) {
        setActiveJobId(null);
        setJobDetail(null);
      }
      await loadJobs();
      setFeedback({ type: "success", text: "Yukleme isi silindi." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Silme islemi basarisiz",
      });
    } finally {
      setDeletingJobId(null);
    }
  };

  const handleExport = async () => {
    if (selectedJobIds.length === 0) return;
    setExporting(true);
    setFeedback(null);
    try {
      const blob = await priceTrackingService.exportJobs(selectedJobIds);
      const date = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `Fiyat_Listesi_${date}.xlsx`);
      setFeedback({ type: "success", text: "Excel dosyasi hazirlandi." });
    } catch (error) {
      setFeedback({
        type: "error",
        text: error instanceof Error ? error.message : "Export basarisiz",
      });
    } finally {
      setExporting(false);
    }
  };

  const feedbackStyle =
    feedback?.type === "success"
      ? {
          background: "rgba(16,185,129,0.12)",
          border: "rgba(16,185,129,0.35)",
          color: COLORS.success.DEFAULT,
        }
      : feedback?.type === "error"
      ? {
          background: "rgba(239,68,68,0.12)",
          border: "rgba(239,68,68,0.35)",
          color: COLORS.error.DEFAULT,
        }
      : {
          background: "rgba(59,130,246,0.12)",
          border: "rgba(59,130,246,0.35)",
          color: COLORS.primary.DEFAULT,
        };

  return (
    <div className="electric-page">
      <TopBar
        title="Fiyat Takip"
        subtitle="Dosya yukleme, AI tabanli satir cikarma ve Excel export"
        breadcrumbs={["Orkestrasyon", "Fiyat Takip"]}
      >
        <Button
          variant="ghost"
          icon={<RefreshCw size={14} />}
          onClick={() => void loadJobs()}
          disabled={loadingJobs}
        >
          Yenile
        </Button>
        <PriceExportButton
          selectedCount={selectedJobIds.length}
          exporting={exporting}
          onExport={() => void handleExport()}
        />
      </TopBar>

      <div
        className="app-page-container"
        style={{
          display: "grid",
          gap: 16,
          alignContent: "start",
        }}
      >
        {feedback ? (
          <div
            role={feedback.type === "error" ? "alert" : "status"}
            style={{
              border: `1px solid ${feedbackStyle.border}`,
              background: feedbackStyle.background,
              color: feedbackStyle.color,
              borderRadius: RADIUS.md,
              padding: "10px 12px",
              fontSize: 13,
            }}
          >
            {feedback.text}
          </div>
        ) : null}

        <PriceUploadForm uploading={uploading} onUpload={handleUpload} />

        <PriceJobList
          jobs={jobs}
          loading={loadingJobs}
          activeJobId={activeJobId}
          selectedJobIds={selectedJobIds}
          deletingJobId={deletingJobId}
          onToggleSelect={handleToggleSelect}
          onSelectDetail={(jobId) => void loadDetail(jobId)}
          onDelete={(jobId) => void handleDelete(jobId)}
        />

        <PriceItemsTable items={jobDetail?.items ?? []} loading={loadingDetail} />
      </div>
    </div>
  );
}

export default PriceTrackingPage;

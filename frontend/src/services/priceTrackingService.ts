import type { PriceJobDetail, PriceUploadJob } from "../types";
import { apiRequest, getApiBaseUrl, getAuthToken } from "./apiClient";

type PriceExportRequest = {
  job_ids: string[];
};

function normalizeErrorMessage(status: number, bodyText: string): string {
  if (!bodyText) {
    return `HTTP ${status}`;
  }
  try {
    const parsed = JSON.parse(bodyText) as {
      detail?: string;
      message?: string;
      error?: { message?: string };
    };
    return (
      parsed.error?.message ||
      parsed.detail ||
      parsed.message ||
      `HTTP ${status}`
    );
  } catch {
    return bodyText;
  }
}

export const priceTrackingService = {
  async uploadFile(file: File, supplier: string): Promise<PriceUploadJob> {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("supplier", supplier);
    return apiRequest<PriceUploadJob>("/price-tracking/upload", {
      method: "POST",
      body: formData,
    });
  },

  async listJobs(): Promise<PriceUploadJob[]> {
    return apiRequest<PriceUploadJob[]>("/price-tracking/jobs");
  },

  async getJobDetail(jobId: string): Promise<PriceJobDetail> {
    return apiRequest<PriceJobDetail>(`/price-tracking/jobs/${jobId}`);
  },

  async exportJobs(jobIds: string[]): Promise<Blob> {
    const token = getAuthToken();
    const response = await fetch(`${getApiBaseUrl()}/price-tracking/export`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ job_ids: jobIds } as PriceExportRequest),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(normalizeErrorMessage(response.status, text));
    }
    return response.blob();
  },

  async deleteJob(jobId: string): Promise<void> {
    await apiRequest<void>(`/price-tracking/jobs/${jobId}`, {
      method: "DELETE",
    });
  },
};

// ── Yardımcı formatlayıcılar ──────────────────────────────

export function formatPrice(value: number | null, currency = "TRY"): string {
  if (value == null) return "—";
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(value);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

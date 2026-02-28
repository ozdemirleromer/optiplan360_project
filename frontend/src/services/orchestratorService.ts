/**
 * OptiPlan 360 — Orchestrator API Service
 * Backend /api/v1/orchestrator/* endpointleri için istemci
 */
import { apiRequest, getApiBaseUrl } from "./apiClient";
import type {
  OptiJob,
  OptiJobCreateRequest,
  OptiJobListResponse,
  ProductionReceipt,
  WorkerStatus,
} from "../types";

function mapJob(raw: Record<string, unknown>): OptiJob {
  // apiClient.transformKeys() zaten snake_case → camelCase dönüşümü yapıyor
  const events = Array.isArray(raw.events)
    ? (raw.events as Record<string, unknown>[]).map((e) => ({
      id: Number(e.id),
      jobId: String(e.jobId ?? ""),
      eventType: String(e.eventType ?? ""),
      message: e.message != null ? String(e.message) : null,
      detailsJson: e.detailsJson != null ? String(e.detailsJson) : null,
      createdAt: e.createdAt != null ? String(e.createdAt) : null,
    }))
    : [];

  return {
    id: String(raw.id ?? ""),
    orderId: Number(raw.orderId ?? 0),
    state: (raw.state as OptiJob["state"]) ?? "NEW",
    optiMode: (raw.optiMode as OptiJob["optiMode"]) ?? "C",
    errorCode: raw.errorCode != null ? String(raw.errorCode) : null,
    errorMessage: raw.errorMessage != null ? String(raw.errorMessage) : null,
    retryCount: Number(raw.retryCount ?? 0),
    createdAt: raw.createdAt != null ? String(raw.createdAt) : null,
    updatedAt: raw.updatedAt != null ? String(raw.updatedAt) : null,
    createdBy: raw.createdBy != null ? Number(raw.createdBy) : undefined,
    events,
  };
}

export const orchestratorService = {
  async listJobs(params?: {
    limit?: number;
    offset?: number;
    state?: string;
    orderId?: number;
  }): Promise<OptiJobListResponse> {
    const query = new URLSearchParams();
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.offset) query.set("offset", String(params.offset));
    if (params?.state) query.set("state", params.state);
    if (params?.orderId) query.set("order_id", String(params.orderId));
    const qs = query.toString();
    const raw = (await apiRequest(`/orchestrator/jobs${qs ? "?" + qs : ""}`, {
      method: "GET",
    })) as Record<string, unknown>;
    const jobs = Array.isArray(raw.jobs)
      ? (raw.jobs as Record<string, unknown>[]).map(mapJob)
      : [];
    return { jobs, total: Number(raw.total ?? jobs.length) };
  },

  async getJob(jobId: string): Promise<OptiJob> {
    const raw = (await apiRequest(`/orchestrator/jobs/${jobId}`, {
      method: "GET",
    })) as Record<string, unknown>;
    return mapJob(raw);
  },

  async retryJob(jobId: string): Promise<OptiJob> {
    const raw = (await apiRequest(`/orchestrator/jobs/${jobId}/retry`, {
      method: "POST",
    })) as Record<string, unknown>;
    return mapJob(raw);
  },

  async approveJob(jobId: string): Promise<OptiJob> {
    const raw = (await apiRequest(`/orchestrator/jobs/${jobId}/approve`, {
      method: "POST",
    })) as Record<string, unknown>;
    return mapJob(raw);
  },

  async syncJob(jobId: string): Promise<OptiJob> {
    const raw = (await apiRequest(`/orchestrator/jobs/${jobId}/sync`, {
      method: "POST",
    })) as Record<string, unknown>;
    return mapJob(raw);
  },

  async cancelJob(jobId: string): Promise<OptiJob> {
    const raw = (await apiRequest(`/orchestrator/jobs/${jobId}/cancel`, {
      method: "POST",
    })) as Record<string, unknown>;
    return mapJob(raw);
  },

  async createJob(payload: OptiJobCreateRequest): Promise<OptiJob> {
    const raw = (await apiRequest(`/orchestrator/jobs`, {
      method: "POST",
      body: JSON.stringify({
        order_id: payload.orderId,
        customer_phone: payload.customerPhone,
        customer_snapshot_name: payload.customerSnapshotName,
        opti_mode: payload.optiMode ?? "C",
        plate_width_mm: payload.plateWidthMm,
        plate_height_mm: payload.plateHeightMm,
        parts: payload.parts.map((part) => ({
          id: part.id,
          part_type: part.partType,
          material_code: part.materialCode,
          length_cm: part.lengthCm,
          width_cm: part.widthCm,
          quantity: part.quantity,
          grain: part.grain,
          color: part.color,
          thickness_mm: part.thicknessMm,
        })),
      }),
    })) as Record<string, unknown>;
    return mapJob(raw);
  },

  getXmlDownloadUrl(jobId: string): string {
    return `${getApiBaseUrl()}/orchestrator/jobs/${jobId}/xml`;
  },

  async runOptimization(orderIds: number[], params?: Record<string, unknown>): Promise<unknown> {
    const raw = await apiRequest(`/optiplanning/optimization/run`, {
      method: "POST",
      body: JSON.stringify({
        order_ids: orderIds,
        params: params,
        config_name: "DEFAULT"
      }),
    });
    return raw;
  },

  // -- Production Receipt --

  async getReceipt(jobId: string): Promise<ProductionReceipt> {
    const raw = (await apiRequest(`/orchestrator/jobs/${jobId}/receipt`, {
      method: "GET",
    })) as Record<string, unknown>;
    const xmlParse = (raw.xmlParse ?? raw.xml_parse ?? {}) as Record<string, unknown>;
    const inv = (raw.invoice ?? null) as Record<string, unknown> | null;
    return {
      jobId: String(raw.jobId ?? raw.job_id ?? ""),
      orderId: Number(raw.orderId ?? raw.order_id ?? 0),
      orderTsCode: raw.orderTsCode != null ? String(raw.orderTsCode) : (raw.order_ts_code != null ? String(raw.order_ts_code) : null),
      customerName: raw.customerName != null ? String(raw.customerName) : (raw.customer_name != null ? String(raw.customer_name) : null),
      xmlParse: {
        bestSolution: xmlParse.bestSolution != null ? String(xmlParse.bestSolution) : (xmlParse.best_solution != null ? String(xmlParse.best_solution) : undefined),
        algorithm: xmlParse.algorithm != null ? String(xmlParse.algorithm) : undefined,
        mqBoards: xmlParse.mqBoards != null ? Number(xmlParse.mqBoards) : (xmlParse.mq_boards != null ? Number(xmlParse.mq_boards) : undefined),
        patterns: xmlParse.patterns != null ? Number(xmlParse.patterns) : undefined,
        zcuts: xmlParse.zcuts != null ? Number(xmlParse.zcuts) : undefined,
        jobTime: xmlParse.jobTime != null ? Number(xmlParse.jobTime) : (xmlParse.job_time != null ? Number(xmlParse.job_time) : undefined),
        jobCost: xmlParse.jobCost != null ? Number(xmlParse.jobCost) : (xmlParse.job_cost != null ? Number(xmlParse.job_cost) : undefined),
        mqDrops: xmlParse.mqDrops != null ? Number(xmlParse.mqDrops) : (xmlParse.mq_drops != null ? Number(xmlParse.mq_drops) : undefined),
        totalSolutions: xmlParse.totalSolutions != null ? Number(xmlParse.totalSolutions) : (xmlParse.total_solutions != null ? Number(xmlParse.total_solutions) : undefined),
        error: xmlParse.error != null ? String(xmlParse.error) : undefined,
      },
      plakaAdedi: Number(raw.plakaAdedi ?? raw.plaka_adedi ?? 0),
      bantMetre: Number(raw.bantMetre ?? raw.bant_metre ?? 0),
      invoice: inv ? {
        id: Number(inv.id ?? 0),
        number: String(inv.number ?? ""),
        subtotal: Number(inv.subtotal ?? 0),
        totalAmount: Number(inv.totalAmount ?? inv.total_amount ?? 0),
        status: inv.status != null ? String(inv.status) : null,
        notes: inv.notes != null ? String(inv.notes) : null,
      } : null,
    };
  },

  async createReceipt(jobId: string): Promise<{ message: string; invoiceId: number; invoiceNumber: string; totalAmount: number }> {
    const raw = (await apiRequest(`/orchestrator/jobs/${jobId}/receipt`, {
      method: "POST",
    })) as Record<string, unknown>;
    return {
      message: String(raw.message ?? ""),
      invoiceId: Number(raw.invoiceId ?? raw.invoice_id ?? 0),
      invoiceNumber: String(raw.invoiceNumber ?? raw.invoice_number ?? ""),
      totalAmount: Number(raw.totalAmount ?? raw.total_amount ?? 0),
    };
  },

  // -- Worker Status --

  async getWorkerStatus(): Promise<WorkerStatus> {
    const raw = (await apiRequest(`/orchestrator/jobs/worker/status`, {
      method: "GET",
    })) as Record<string, unknown>;
    return {
      circuitOpen: Boolean(raw.circuitOpen ?? raw.circuit_open ?? false),
      consecutiveFailures: Number(raw.consecutiveFailures ?? raw.consecutive_failures ?? 0),
      maxConsecutiveFailures: Number(raw.maxConsecutiveFailures ?? raw.max_consecutive_failures ?? 3),
      lastRunAt: raw.lastRunAt != null ? String(raw.lastRunAt) : (raw.last_run_at != null ? String(raw.last_run_at) : null),
      lastError: raw.lastError != null ? String(raw.lastError) : (raw.last_error != null ? String(raw.last_error) : null),
      engine: String(raw.engine ?? ""),
      supportedEngines: Array.isArray(raw.supportedEngines ?? raw.supported_engines) ? (raw.supportedEngines ?? raw.supported_engines) as string[] : [],
      queueCount: Number(raw.queueCount ?? raw.queue_count ?? 0),
      runningCount: Number(raw.runningCount ?? raw.running_count ?? 0),
      scriptPath: String(raw.scriptPath ?? raw.script_path ?? ""),
      scriptExists: Boolean(raw.scriptExists ?? raw.script_exists ?? false),
    };
  },

  async resetWorkerCircuitBreaker(): Promise<{ message: string }> {
    const raw = (await apiRequest(`/orchestrator/jobs/worker/reset`, {
      method: "POST",
    })) as Record<string, unknown>;
    return { message: String(raw.message ?? "") };
  },
};


import { apiRequest } from "./apiClient";

// ── Enums ──
export enum SyncStatus {
  QUEUED = "QUEUED",
  RUNNING = "RUNNING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  PARTIAL = "PARTIAL",
}

export enum SyncDirection {
  PUSH = "PUSH",
  PULL = "PULL",
  BIDIRECTIONAL = "BIDIRECTIONAL",
}

// ── Types ──
// NOT: apiClient.ts transformKeys() tüm API yanıtlarını camelCase'e çevirir.
export interface EntityMap {
  id: string;
  entityType: string;
  internalId: string;
  externalId: string;
  externalSystem: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SyncJob {
  id: string;
  jobType: string;
  direction: SyncDirection;
  status: SyncStatus;
  recordsTotal?: number;
  recordsProcessed?: number;
  recordsSuccess?: number;
  recordsFailed?: number;
  startedAt?: string;
  completedAt?: string;
  errorMessage?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  createdBy?: string;
}

export interface OutboxItem {
  id: string;
  entityType: string;
  entityId: string;
  operation: string;
  payload: Record<string, unknown>;
  status: SyncStatus;
  retryCount: number;
  maxRetries: number;
  nextRetryAt?: string;
  errorMessage?: string;
  createdAt: string;
  processedAt?: string;
}

export interface InboxItem {
  id: string;
  externalSystem: string;
  externalId: string;
  entityType: string;
  operation: string;
  payload: Record<string, unknown>;
  status: SyncStatus;
  conflictType?: string;
  conflictData?: Record<string, unknown>;
  resolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  processedAt?: string;
}

export interface IntegrationError {
  id: string;
  entityType?: string;
  entityId?: string;
  errorCode: string;
  errorMessage: string;
  stackTrace?: string;
  context?: Record<string, unknown>;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
}

export interface IntegrationAudit {
  id: string;
  action: string;
  entityType?: string;
  entityId?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  userId?: string;
  createdAt: string;
}

export interface HealthStatus {
  status: string; // "HEALTHY" | "DEGRADED" | "DISCONNECTED"
  mikroConnection: boolean;
  outboxPending: number;
  inboxPending: number;
  recentErrors: number;
  lastSync?: string;
}

type ListResponse<T> = { data: T[]; total?: number } | T[];

function normalizeList<T>(payload: ListResponse<T>): T[] {
  if (Array.isArray(payload)) return payload;
  return payload.data || [];
}

// ── Input Types ──
export interface EntityMapInput {
  entity_type: string;
  internal_id: string;
  external_id: string;
  external_system?: string;
  metadata?: Record<string, unknown>;
}

export interface SyncJobInput {
  job_type: string;
  direction: SyncDirection;
  metadata?: Record<string, unknown>;
}

export interface ConflictResolveInput {
  resolution: "ACCEPT" | "REJECT" | "MERGE";
  merge_data?: Record<string, unknown>;
}

// ── Service ──
export const integrationService = {
  // Entity Maps
  async listEntityMaps(params?: { entity_type?: string; external_system?: string }): Promise<EntityMap[]> {
    const query = new URLSearchParams();
    if (params?.entity_type) query.set("entity_type", params.entity_type);
    if (params?.external_system) query.set("external_system", params.external_system);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<EntityMap>>(`/integration/maps${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async createEntityMap(payload: EntityMapInput): Promise<EntityMap> {
    return apiRequest<EntityMap>("/integration/maps", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  async deleteEntityMap(id: string): Promise<{ message: string }> {
    return apiRequest<{ message: string }>(`/integration/maps/${id}`, { method: "DELETE" });
  },

  // Sync Jobs
  async listSyncJobs(params?: { job_type?: string; status?: SyncStatus }): Promise<SyncJob[]> {
    const query = new URLSearchParams();
    if (params?.job_type) query.set("job_type", params.job_type);
    if (params?.status) query.set("status", params.status);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<SyncJob>>(`/integration/jobs${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async getSyncJob(id: string): Promise<SyncJob> {
    return apiRequest<SyncJob>(`/integration/jobs/${id}`, { method: "GET" });
  },

  async createSyncJob(payload: SyncJobInput): Promise<SyncJob> {
    return apiRequest<SyncJob>("/integration/jobs", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Outbox
  async listOutbox(params?: { status?: SyncStatus; entity_type?: string }): Promise<OutboxItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.entity_type) query.set("entity_type", params.entity_type);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<OutboxItem>>(`/integration/outbox${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async processOutboxItem(id: string): Promise<OutboxItem> {
    return apiRequest<OutboxItem>(`/integration/outbox/${id}/process`, {
      method: "POST",
    });
  },

  // Inbox
  async listInbox(params?: { status?: SyncStatus; resolved?: boolean }): Promise<InboxItem[]> {
    const query = new URLSearchParams();
    if (params?.status) query.set("status", params.status);
    if (params?.resolved !== undefined) query.set("resolved", String(params.resolved));
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<InboxItem>>(`/integration/inbox${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async resolveConflict(id: string, payload: ConflictResolveInput): Promise<InboxItem> {
    return apiRequest<InboxItem>(`/integration/inbox/${id}/resolve`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  // Errors
  async listErrors(params?: { is_resolved?: boolean }): Promise<IntegrationError[]> {
    const query = new URLSearchParams();
    if (params?.is_resolved !== undefined) query.set("is_resolved", String(params.is_resolved));
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<IntegrationError>>(`/integration/errors${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  async resolveError(id: string): Promise<IntegrationError> {
    return apiRequest<IntegrationError>(`/integration/errors/${id}/resolve`, {
      method: "POST",
    });
  },

  // Audit
  async listAudit(params?: { entity_type?: string; entity_id?: string }): Promise<IntegrationAudit[]> {
    const query = new URLSearchParams();
    if (params?.entity_type) query.set("entity_type", params.entity_type);
    if (params?.entity_id) query.set("entity_id", params.entity_id);
    const qs = query.toString();
    const payload = await apiRequest<ListResponse<IntegrationAudit>>(`/integration/audit${qs ? `?${qs}` : ""}`, { method: "GET" });
    return normalizeList(payload);
  },

  // Health
  async getHealth(): Promise<HealthStatus> {
    return apiRequest<HealthStatus>("/integration/health", { method: "GET" });
  },

  // Retry
  async retryFailed(): Promise<{ message: string; count: number }> {
    return apiRequest<{ message: string; count: number }>("/integration/retry", {
      method: "POST",
    });
  },
};

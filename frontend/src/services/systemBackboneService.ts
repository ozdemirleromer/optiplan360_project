import { apiRequest } from "./apiClient";
import type {
  SystemBackboneAudit,
  SystemBackboneAuditListResponse,
  SystemBackboneCreateFlowRequest,
  SystemBackboneFlow,
  SystemBackboneFlowListResponse,
  SystemBackboneFlowListQuery,
  SystemBackboneOverview,
  SystemBackboneAdvanceRequest,
  SystemBackbonePhaseCommand,
  SystemBackbonePhaseResponse,
  SystemBackboneTodoItem,
  SystemBackboneTodoListResponse,
  SystemBackboneRoadmapResponse,
  SystemBackbonePackageResponse,
  SystemBackbonePackageStatusResponse,
  SystemBackboneLastPackageRun,
} from "../types";

function readString(raw: Record<string, unknown>, camelKey: string, snakeKey: string): string {
  const value = raw[camelKey] ?? raw[snakeKey] ?? "";
  return String(value);
}

function readNullableString(raw: Record<string, unknown>, camelKey: string, snakeKey: string): string | null {
  const value = raw[camelKey] ?? raw[snakeKey];
  return value == null ? null : String(value);
}

function readNumber(raw: Record<string, unknown>, camelKey: string, snakeKey: string, fallback = 0): number {
  const value = raw[camelKey] ?? raw[snakeKey] ?? fallback;
  return Number(value);
}

function mapFlow(raw: Record<string, unknown>): SystemBackboneFlow {
  return {
    id: String(raw.id ?? ""),
    flowName: readString(raw, "flowName", "flow_name"),
    entityType: readString(raw, "entityType", "entity_type"),
    entityId: readString(raw, "entityId", "entity_id"),
    externalId: readNullableString(raw, "externalId", "external_id"),
    companyId: readNumber(raw, "companyId", "company_id", 1),
    branchId: readNumber(raw, "branchId", "branch_id", 0),
    fiscalYear: readNumber(raw, "fiscalYear", "fiscal_year", 2026),
    sourceSystem: readString(raw, "sourceSystem", "source_system"),
    targetSystem: readString(raw, "targetSystem", "target_system"),
    status: String(raw.status ?? "PENDING"),
    stage: String(raw.stage ?? "foundation"),
    retryCount: readNumber(raw, "retryCount", "retry_count", 0),
    maxRetries: readNumber(raw, "maxRetries", "max_retries", 0),
    retryCooldownSeconds: readNumber(raw, "retryCooldownSeconds", "retry_cooldown_seconds", 0),
    lastError: readNullableString(raw, "lastError", "last_error"),
    metadataJson: readNullableString(raw, "metadataJson", "metadata_json"),
    lastRetryAt: readNullableString(raw, "lastRetryAt", "last_retry_at"),
    nextRetryAt: readNullableString(raw, "nextRetryAt", "next_retry_at"),
    createdBy: raw.createdBy != null ? Number(raw.createdBy) : raw.created_by != null ? Number(raw.created_by) : null,
    updatedBy: raw.updatedBy != null ? Number(raw.updatedBy) : raw.updated_by != null ? Number(raw.updated_by) : null,
    createdAt: readNullableString(raw, "createdAt", "created_at"),
    updatedAt: readNullableString(raw, "updatedAt", "updated_at"),
  };
}

function mapAudit(raw: Record<string, unknown>): SystemBackboneAudit {
  return {
    id: Number(raw.id ?? 0),
    flowId: readString(raw, "flowId", "flow_id"),
    eventType: readString(raw, "eventType", "event_type"),
    message: String(raw.message ?? ""),
    payloadJson: readNullableString(raw, "payloadJson", "payload_json"),
    createdBy: raw.createdBy != null ? Number(raw.createdBy) : raw.created_by != null ? Number(raw.created_by) : null,
    createdAt: readNullableString(raw, "createdAt", "created_at"),
  };
}

function mapTodo(raw: Record<string, unknown>): SystemBackboneTodoItem {
  return {
    order: Number(raw.order ?? 0),
    title: String(raw.title ?? ""),
    status: String(raw.status ?? "pending"),
    detail: String(raw.detail ?? ""),
  };
}

function mapPhaseResponse(raw: Record<string, unknown>): SystemBackbonePhaseResponse {
  return {
    phase: String(raw.phase ?? ""),
    summary: ((raw.summary ?? {}) as Record<string, unknown>),
    flowIds: Array.isArray(raw.flow_ids)
      ? (raw.flow_ids as unknown[]).map((item) => String(item))
      : Array.isArray(raw.flowIds)
        ? (raw.flowIds as unknown[]).map((item) => String(item))
        : [],
    todos: Array.isArray(raw.todos)
      ? (raw.todos as Record<string, unknown>[]).map(mapTodo)
      : [],
  };
}

function mapRoadmap(raw: Record<string, unknown>): SystemBackboneRoadmapResponse {
  return {
    companyId: Number(raw.companyId ?? raw.company_id ?? 1),
    branchId: Number(raw.branchId ?? raw.branch_id ?? 0),
    fiscalYear: Number(raw.fiscalYear ?? raw.fiscal_year ?? 2026),
    tamamlananAnaYapi: Array.isArray(raw.tamamlananAnaYapi ?? raw.tamamlanan_ana_yapi)
      ? ((raw.tamamlananAnaYapi ?? raw.tamamlanan_ana_yapi) as unknown[]).map((item) => String(item))
      : [],
    anaYapiEksikleri: Array.isArray(raw.anaYapiEksikleri ?? raw.ana_yapi_eksikleri)
      ? ((raw.anaYapiEksikleri ?? raw.ana_yapi_eksikleri) as unknown[]).map((item) => String(item))
      : [],
    tamamlananSertlestirmeTest: Array.isArray(raw.tamamlananSertlestirmeTest ?? raw.tamamlanan_sertlestirme_test)
      ? ((raw.tamamlananSertlestirmeTest ?? raw.tamamlanan_sertlestirme_test) as unknown[]).map((item) => String(item))
      : [],
    sertlestirmeTestEksikleri: Array.isArray(raw.sertlestirmeTestEksikleri ?? raw.sertlestirme_test_eksikleri)
      ? ((raw.sertlestirmeTestEksikleri ?? raw.sertlestirme_test_eksikleri) as unknown[]).map((item) => String(item))
      : [],
  };
}

function mapPackageResponse(raw: Record<string, unknown>): SystemBackbonePackageResponse {
  const lastRunRaw = ((raw.lastPackageRun ?? raw.last_package_run) as Record<string, unknown> | null) ?? null;
  const lastPackageRun: SystemBackboneLastPackageRun | null = lastRunRaw
    ? {
        package: String(lastRunRaw.package ?? ""),
        eventType: String(lastRunRaw.eventType ?? lastRunRaw.event_type ?? ""),
        at: lastRunRaw.at == null ? null : String(lastRunRaw.at),
        userId:
          lastRunRaw.userId != null
            ? Number(lastRunRaw.userId)
            : lastRunRaw.user_id != null
              ? Number(lastRunRaw.user_id)
              : null,
        companyId: Number(lastRunRaw.companyId ?? lastRunRaw.company_id ?? 1),
        branchId: Number(lastRunRaw.branchId ?? lastRunRaw.branch_id ?? 0),
        fiscalYear: Number(lastRunRaw.fiscalYear ?? lastRunRaw.fiscal_year ?? 2026),
      }
    : null;

  return {
    package: String(raw.package ?? ""),
    chainId: raw.chainId == null ? raw.chain_id == null ? null : String(raw.chain_id) : String(raw.chainId),
    generatedAt: String(raw.generatedAt ?? raw.generated_at ?? new Date().toISOString()),
    watcherEnabled: Boolean(raw.watcherEnabled ?? raw.watcher_enabled ?? false),
    warnings: Array.isArray(raw.warnings) ? (raw.warnings as unknown[]).map((item) => String(item)) : [],
    flowCount: Number(raw.flowCount ?? raw.flow_count ?? 0),
    workflowRecordCount: Number(raw.workflowRecordCount ?? raw.workflow_record_count ?? 0),
    totalDurationMs: raw.totalDurationMs == null ? raw.total_duration_ms == null ? null : Number(raw.total_duration_ms) : Number(raw.totalDurationMs),
    failedStep: raw.failedStep == null ? raw.failed_step == null ? null : String(raw.failed_step) : String(raw.failedStep),
    phaseCounts: ((raw.phaseCounts ?? raw.phase_counts) as Record<string, number>) ?? {},
    statusCounts: ((raw.statusCounts ?? raw.status_counts) as Record<string, number>) ?? {},
    lastPackageRun,
    roadmap: mapRoadmap((raw.roadmap ?? {}) as Record<string, unknown>),
    coreBootstrap: ((raw.coreBootstrap ?? raw.core_bootstrap) as Record<string, unknown> | null) ?? null,
    workflowScan: ((raw.workflowScan ?? raw.workflow_scan) as Record<string, unknown> | null) ?? null,
    hardening: (raw.hardening as Record<string, unknown> | null) ?? null,
    chainSteps: Array.isArray(raw.chainSteps ?? raw.chain_steps)
      ? ((raw.chainSteps ?? raw.chain_steps) as Record<string, unknown>[]).map((item) => ({
          step: String(item.step ?? ""),
          generatedAt: item.generatedAt == null ? item.generated_at == null ? null : String(item.generated_at) : String(item.generatedAt),
          flowCount: Number(item.flowCount ?? item.flow_count ?? 0),
          durationMs: Number(item.durationMs ?? item.duration_ms ?? 0),
        }))
      : null,
  };
}

function buildPhaseBody(body?: SystemBackbonePhaseCommand) {
  return {
    company_id: body?.companyId ?? 1,
    branch_id: body?.branchId ?? 0,
    fiscal_year: body?.fiscalYear ?? 2026,
    source_system: body?.sourceSystem ?? "optiplan360",
    target_system: body?.targetSystem ?? "mikro",
  };
}

export const systemBackboneService = {
  async getOverview(params?: { companyId?: number; branchId?: number; fiscalYear?: number }): Promise<SystemBackboneOverview> {
    const query = new URLSearchParams();
    if (params?.companyId != null) query.set("company_id", String(params.companyId));
    if (params?.branchId != null) query.set("branch_id", String(params.branchId));
    if (params?.fiscalYear != null) query.set("fiscal_year", String(params.fiscalYear));

    const path = `/system-backbone/overview${query.toString() ? `?${query.toString()}` : ""}`;
    const raw = (await apiRequest(path, {
      method: "GET",
    })) as Record<string, unknown>;

    return {
      generatedAt: String(raw.generatedAt ?? raw.generated_at ?? new Date().toISOString()),
      totalFlows: Number(raw.totalFlows ?? raw.total_flows ?? 0),
      statusSummary: ((raw.statusSummary ?? raw.status_summary) as Record<string, number>) ?? {},
      stageSummary: ((raw.stageSummary ?? raw.stage_summary) as Record<string, number>) ?? {},
    };
  },

  async listFlows(params?: SystemBackboneFlowListQuery): Promise<SystemBackboneFlowListResponse> {
    const query = new URLSearchParams();
    if (params?.limit != null) query.set("limit", String(params.limit));
    if (params?.offset != null) query.set("offset", String(params.offset));
    if (params?.status) query.set("status", params.status);
    if (params?.stage) query.set("stage", params.stage);
    if (params?.companyId != null) query.set("company_id", String(params.companyId));
    if (params?.branchId != null) query.set("branch_id", String(params.branchId));
    if (params?.fiscalYear != null) query.set("fiscal_year", String(params.fiscalYear));

    const queryString = query.toString();
    const path = `/system-backbone/flows${queryString ? `?${queryString}` : ""}`;

    const raw = (await apiRequest(path, {
      method: "GET",
    })) as Record<string, unknown>;

    const data = Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>[]).map(mapFlow)
      : [];

    return {
      data,
      total: Number(raw.total ?? data.length),
    };
  },

  async createFlow(body: SystemBackboneCreateFlowRequest): Promise<SystemBackboneFlow> {
    const requestBody = {
      flow_name: body.flowName,
      entity_type: body.entityType,
      entity_id: body.entityId,
      external_id: body.externalId ?? null,
      company_id: body.companyId ?? 1,
      branch_id: body.branchId ?? 0,
      fiscal_year: body.fiscalYear ?? 2026,
      source_system: body.sourceSystem,
      target_system: body.targetSystem,
      stage: body.stage,
      metadata: body.metadata ?? {},
    };

    const raw = (await apiRequest("/system-backbone/flows", {
      method: "POST",
      body: JSON.stringify(requestBody),
    })) as Record<string, unknown>;

    return mapFlow(raw);
  },

  async advanceFlow(flowId: string, body: SystemBackboneAdvanceRequest): Promise<SystemBackboneFlow> {
    const raw = (await apiRequest(`/system-backbone/flows/${flowId}/advance`, {
      method: "POST",
      body: JSON.stringify(body),
    })) as Record<string, unknown>;

    return mapFlow(raw);
  },

  async listAudits(flowId: string, limit = 100): Promise<SystemBackboneAuditListResponse> {
    const raw = (await apiRequest(`/system-backbone/flows/${flowId}/audits?limit=${limit}`, {
      method: "GET",
    })) as Record<string, unknown>;

    return {
      data: Array.isArray(raw.data) ? (raw.data as Record<string, unknown>[]).map(mapAudit) : [],
    };
  },

  async bootstrapCoreStructure(body?: SystemBackbonePhaseCommand): Promise<SystemBackbonePhaseResponse> {
    const raw = (await apiRequest("/system-backbone/phases/core/bootstrap", {
      method: "POST",
      body: JSON.stringify(buildPhaseBody(body)),
    })) as Record<string, unknown>;
    return mapPhaseResponse(raw);
  },

  async applyHardening(body?: SystemBackbonePhaseCommand): Promise<SystemBackbonePhaseResponse> {
    const raw = (await apiRequest("/system-backbone/phases/hardening/apply", {
      method: "POST",
      body: JSON.stringify(buildPhaseBody(body)),
    })) as Record<string, unknown>;
    return mapPhaseResponse(raw);
  },

  async getPhaseTodo(
    phase: "core" | "hardening",
    params?: { companyId?: number; branchId?: number; fiscalYear?: number },
  ): Promise<SystemBackboneTodoListResponse> {
    const query = new URLSearchParams();
    query.set("company_id", String(params?.companyId ?? 1));
    query.set("branch_id", String(params?.branchId ?? 0));
    query.set("fiscal_year", String(params?.fiscalYear ?? 2026));
    const raw = (await apiRequest(`/system-backbone/phases/${phase}/todo?${query.toString()}`, {
      method: "GET",
    })) as Record<string, unknown>;

    return {
      phase: String(raw.phase ?? phase),
      todos: Array.isArray(raw.todos) ? (raw.todos as Record<string, unknown>[]).map(mapTodo) : [],
    };
  },

  async getRoadmap(params?: { companyId?: number; branchId?: number; fiscalYear?: number }): Promise<SystemBackboneRoadmapResponse> {
    const query = new URLSearchParams();
    query.set("company_id", String(params?.companyId ?? 1));
    query.set("branch_id", String(params?.branchId ?? 0));
    query.set("fiscal_year", String(params?.fiscalYear ?? 2026));
    const raw = (await apiRequest(`/system-backbone/roadmap?${query.toString()}`, {
      method: "GET",
    })) as Record<string, unknown>;

    return mapRoadmap(raw);
  },

  async runFoundationPackage(body?: SystemBackbonePhaseCommand): Promise<SystemBackbonePackageResponse> {
    const raw = (await apiRequest("/system-backbone/packages/foundation/run", {
      method: "POST",
      body: JSON.stringify(buildPhaseBody(body)),
    })) as Record<string, unknown>;
    return mapPackageResponse(raw);
  },

  async runStabilizationPackage(body?: SystemBackbonePhaseCommand): Promise<SystemBackbonePackageResponse> {
    const raw = (await apiRequest("/system-backbone/packages/stabilization/run", {
      method: "POST",
      body: JSON.stringify(buildPhaseBody(body)),
    })) as Record<string, unknown>;
    return mapPackageResponse(raw);
  },

  async runChainPackage(body?: SystemBackbonePhaseCommand): Promise<SystemBackbonePackageResponse> {
    const raw = (await apiRequest("/system-backbone/packages/chain/run", {
      method: "POST",
      body: JSON.stringify(buildPhaseBody(body)),
    })) as Record<string, unknown>;
    return mapPackageResponse(raw);
  },

  async getPackageStatus(params?: { companyId?: number; branchId?: number; fiscalYear?: number }): Promise<SystemBackbonePackageStatusResponse> {
    const query = new URLSearchParams();
    query.set("company_id", String(params?.companyId ?? 1));
    query.set("branch_id", String(params?.branchId ?? 0));
    query.set("fiscal_year", String(params?.fiscalYear ?? 2026));

    const raw = (await apiRequest(`/system-backbone/packages/status?${query.toString()}`, {
      method: "GET",
    })) as Record<string, unknown>;

    const lastRunRaw = ((raw.lastPackageRun ?? raw.last_package_run) as Record<string, unknown> | null) ?? null;
    const lastPackageRun: SystemBackboneLastPackageRun | null = lastRunRaw
      ? {
          package: String(lastRunRaw.package ?? ""),
          eventType: String(lastRunRaw.eventType ?? lastRunRaw.event_type ?? ""),
          at: lastRunRaw.at == null ? null : String(lastRunRaw.at),
          userId:
            lastRunRaw.userId != null
              ? Number(lastRunRaw.userId)
              : lastRunRaw.user_id != null
                ? Number(lastRunRaw.user_id)
                : null,
          companyId: Number(lastRunRaw.companyId ?? lastRunRaw.company_id ?? 1),
          branchId: Number(lastRunRaw.branchId ?? lastRunRaw.branch_id ?? 0),
          fiscalYear: Number(lastRunRaw.fiscalYear ?? lastRunRaw.fiscal_year ?? 2026),
        }
      : null;

    return {
      companyId: Number(raw.companyId ?? raw.company_id ?? 1),
      branchId: Number(raw.branchId ?? raw.branch_id ?? 0),
      fiscalYear: Number(raw.fiscalYear ?? raw.fiscal_year ?? 2026),
      generatedAt: String(raw.generatedAt ?? raw.generated_at ?? new Date().toISOString()),
      watcherEnabled: Boolean(raw.watcherEnabled ?? raw.watcher_enabled ?? false),
      warnings: Array.isArray(raw.warnings) ? (raw.warnings as unknown[]).map((item) => String(item)) : [],
      flowCount: Number(raw.flowCount ?? raw.flow_count ?? 0),
      workflowRecordCount: Number(raw.workflowRecordCount ?? raw.workflow_record_count ?? 0),
      phaseCounts: ((raw.phaseCounts ?? raw.phase_counts) as Record<string, number>) ?? {},
      statusCounts: ((raw.statusCounts ?? raw.status_counts) as Record<string, number>) ?? {},
      lastPackageRun,
      roadmap: mapRoadmap((raw.roadmap ?? {}) as Record<string, unknown>),
    };
  },
};

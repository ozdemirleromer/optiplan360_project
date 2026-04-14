import { describe, expect, it, vi, beforeEach } from "vitest";

import { systemBackboneService } from "./systemBackboneService";

const apiRequestMock = vi.fn();

vi.mock("./apiClient", () => ({
  apiRequest: (...args: unknown[]) => apiRequestMock(...args),
}));

describe("systemBackboneService", () => {
  beforeEach(() => {
    apiRequestMock.mockReset();
  });

  it("overview verisini map eder", async () => {
    apiRequestMock.mockResolvedValueOnce({
      generated_at: "2026-03-12T00:00:00Z",
      total_flows: 3,
      status_summary: { PENDING: 1, IN_PROGRESS: 2 },
      stage_summary: { foundation: 1, stabilization: 2, completed: 0 },
    });

    const overview = await systemBackboneService.getOverview();

    expect(overview.totalFlows).toBe(3);
    expect(overview.stageSummary.stabilization).toBe(2);
  });

  it("flow listesini map eder", async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [
        {
          id: "flow-1",
          flow_name: "core",
          entity_type: "order",
          entity_id: "001",
          external_id: "ext-flow-1",
          company_id: 1,
          branch_id: 0,
          fiscal_year: 2026,
          source_system: "optiplan360",
          target_system: "mikro",
          status: "PENDING",
          stage: "foundation",
          retry_count: 0,
          max_retries: 3,
          last_error: null,
          metadata_json: "{}",
          created_by: 1,
          updated_by: 1,
          created_at: "2026-03-12T00:00:00Z",
          updated_at: "2026-03-12T00:00:00Z",
        },
      ],
      total: 1,
    });

    const result = await systemBackboneService.listFlows();

    expect(result.total).toBe(1);
    expect(result.data[0].id).toBe("flow-1");
    expect(result.data[0].externalId).toBe("ext-flow-1");
    expect(result.data[0].companyId).toBe(1);
  });

  it("create ve advance endpointlerini çağırır", async () => {
    apiRequestMock.mockResolvedValue({
      id: "flow-2",
      flow_name: "core",
      entity_type: "order",
      entity_id: "002",
      external_id: "ext-flow-2",
      company_id: 1,
      branch_id: 0,
      fiscal_year: 2026,
      source_system: "optiplan360",
      target_system: "mikro",
      status: "IN_PROGRESS",
      stage: "stabilization",
      retry_count: 1,
      max_retries: 3,
      last_error: null,
      metadata_json: "{}",
      created_by: 1,
      updated_by: 1,
      created_at: "2026-03-12T00:00:00Z",
      updated_at: "2026-03-12T00:00:00Z",
    });

    const created = await systemBackboneService.createFlow({
      flowName: "core",
      entityType: "order",
      entityId: "002",
      externalId: "ext-flow-2",
      companyId: 1,
      branchId: 0,
      fiscalYear: 2026,
      sourceSystem: "optiplan360",
      targetSystem: "mikro",
      stage: "foundation",
      metadata: {},
    });

    expect(created.id).toBe("flow-2");

    const advanced = await systemBackboneService.advanceFlow("flow-2", {
      nextStage: "stabilization",
      nextStatus: "IN_PROGRESS",
      note: "advance",
      retryIncrement: true,
    });

    expect(advanced.stage).toBe("stabilization");
    expect(apiRequestMock).toHaveBeenCalled();
  });

  it("audit listesini map eder", async () => {
    apiRequestMock.mockResolvedValueOnce({
      data: [
        {
          id: 10,
          flow_id: "flow-2",
          event_type: "FLOW_ADVANCED",
          message: "advance",
          payload_json: '{"next_stage":"stabilization"}',
          created_by: 1,
          created_at: "2026-03-12T00:00:00Z",
        },
      ],
    });

    const result = await systemBackboneService.listAudits("flow-2", 25);

    expect(result.data).toHaveLength(1);
    expect(result.data[0].eventType).toBe("FLOW_ADVANCED");
    expect(apiRequestMock).toHaveBeenCalledWith("/system-backbone/flows/flow-2/audits?limit=25", { method: "GET" });
  });

  it("core bootstrap ve hardening endpointlerini map eder", async () => {
    apiRequestMock
      .mockResolvedValueOnce({
        phase: "core",
        summary: { created: 5, reused: 0, total: 5 },
        flow_ids: ["f1", "f2"],
        todos: [{ order: 1, title: "Klasör yapısı", status: "done", detail: "ok" }],
      })
      .mockResolvedValueOnce({
        phase: "hardening",
        summary: { hardened: 5, total: 5 },
        flow_ids: ["f1", "f2"],
        todos: [{ order: 1, title: "Retry", status: "done", detail: "ok" }],
      });

    const bootstrap = await systemBackboneService.bootstrapCoreStructure({
      companyId: 1,
      branchId: 0,
      fiscalYear: 2026,
    });
    const hardening = await systemBackboneService.applyHardening({
      companyId: 1,
      branchId: 0,
      fiscalYear: 2026,
    });

    expect(bootstrap.phase).toBe("core");
    expect(bootstrap.todos[0].status).toBe("done");
    expect(hardening.phase).toBe("hardening");
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      1,
      "/system-backbone/phases/core/bootstrap",
      expect.objectContaining({ method: "POST" }),
    );
    expect(apiRequestMock).toHaveBeenNthCalledWith(
      2,
      "/system-backbone/phases/hardening/apply",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("faz TODO endpointini map eder", async () => {
    apiRequestMock.mockResolvedValueOnce({
      phase: "hardening",
      todos: [{ order: 1, title: "Audit", status: "pending", detail: "bekliyor" }],
    });

    const result = await systemBackboneService.getPhaseTodo("hardening", {
      companyId: 1,
      branchId: 0,
      fiscalYear: 2026,
    });

    expect(result.phase).toBe("hardening");
    expect(result.todos).toHaveLength(1);
    expect(apiRequestMock).toHaveBeenCalledWith(
      "/system-backbone/phases/hardening/todo?company_id=1&branch_id=0&fiscal_year=2026",
      { method: "GET" },
    );
  });
});

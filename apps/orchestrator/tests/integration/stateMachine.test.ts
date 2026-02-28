import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/db/database";
import { JobRepository } from "../../src/db/jobRepository";
import { ERROR_CODES } from "../../src/domain/errors";
import type { JobPayload } from "../../src/domain/job";

async function makeTempDbPath(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "orchestrator-db-"));
  return path.join(dir, "test.db");
}

function payload(orderId: string): JobPayload {
  return {
    order_id: orderId,
    customer_phone: "05551234567",
    parts: [
      {
        id: "p1",
        part_type: "GOVDE",
        material_code: "MAT",
        length_cm: 100,
        width_cm: 50,
        quantity: 1,
        grain: 1,
        color: "Beyaz",
        thickness_mm: 18,
      },
    ],
  };
}

describe("JobRepository state machine constraints", () => {
  it("ayni anda tek OPTI_RUNNING state kisitini uygular", async () => {
    const dbPath = await makeTempDbPath();
    const { db } = createDatabase(dbPath);
    const repo = new JobRepository(db);

    const jobA = repo.createJob(payload("A"), "A");
    const jobB = repo.createJob(payload("B"), "A");

    repo.setState(jobA.id, "OPTI_RUNNING", "first running");

    expect(() => repo.setState(jobB.id, "OPTI_RUNNING", "second running")).toThrow();
  });

  it("approveHold sadece HOLD state icin calisir", async () => {
    const dbPath = await makeTempDbPath();
    const { db } = createDatabase(dbPath);
    const repo = new JobRepository(db);

    const job = repo.createJob(payload("C"), "A");
    expect(() => repo.approveHold(job.id)).toThrow();
  });

  it("approveHold mode-c hold onayinda manual_trigger_approved alanini set eder", async () => {
    const dbPath = await makeTempDbPath();
    const { db } = createDatabase(dbPath);
    const repo = new JobRepository(db);

    const job = repo.createJob(payload("MC"), "C");
    repo.setHold(job.id, ERROR_CODES.E_OPERATOR_TRIGGER_REQUIRED, "manual trigger gerekli");

    const approved = repo.approveHold(job.id);

    expect(approved.state).toBe("NEW");
    expect(approved.manual_trigger_approved).toBe(1);
    expect(approved.error_code).toBeNull();
    expect(approved.error_message).toBeNull();

    const { audit } = repo.getJobWithAudit(job.id);
    const last = audit[audit.length - 1];
    expect(last?.event_type).toBe("HOLD_APPROVED");
    expect(last?.details_json).toContain('"mode_c_approved":true');
  });

  it("approveHold mode-c disi holdlarda manual_trigger_approved alanini set etmez", async () => {
    const dbPath = await makeTempDbPath();
    const { db } = createDatabase(dbPath);
    const repo = new JobRepository(db);

    const job = repo.createJob(payload("NMC"), "A");
    repo.setHold(job.id, ERROR_CODES.E_CRM_NO_MATCH, "crm eslesmesi yok");

    const approved = repo.approveHold(job.id);

    expect(approved.state).toBe("NEW");
    expect(approved.manual_trigger_approved).toBe(0);
    expect(approved.error_code).toBeNull();
    expect(approved.error_message).toBeNull();

    const { audit } = repo.getJobWithAudit(job.id);
    const last = audit[audit.length - 1];
    expect(last?.event_type).toBe("HOLD_APPROVED");
    expect(last?.details_json).toContain('"mode_c_approved":false');
  });

  it("listJobs invalid veya buyuk limit geldiginde guvenli clamp uygular", async () => {
    const dbPath = await makeTempDbPath();
    const { db } = createDatabase(dbPath);
    const repo = new JobRepository(db);

    repo.createJob(payload("D1"), "A");
    repo.createJob(payload("D2"), "A");
    repo.createJob(payload("D3"), "A");

    const invalidLimitJobs = repo.listJobs(Number.NaN as unknown as number);
    expect(invalidLimitJobs.length).toBe(3);

    const tooSmallLimitJobs = repo.listJobs(0);
    expect(tooSmallLimitJobs.length).toBe(1);
  });
});

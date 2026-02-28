import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { ERROR_CODES } from "../domain/errors";
import type { AuditEvent, CustomerRecord, JobPayload, JobRecord, JobState, OptiMode } from "../domain/job";

function nowIso(): string {
  return new Date().toISOString();
}

function makeHash(payload: JobPayload): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function isUniqueConstraintError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.message.includes("UNIQUE constraint failed") || error.message.includes("uq_jobs_payload_hash");
}

export class JobRepository {
  constructor(private readonly db: Database.Database) {}

  createJob(payload: JobPayload, mode: OptiMode): JobRecord {
    const id = crypto.randomUUID();
    const payloadJson = JSON.stringify(payload);
    const payloadHash = makeHash(payload);
    const ts = nowIso();

    try {
      this.db
        .prepare(
          `INSERT INTO jobs (id, order_id, payload_json, payload_hash, state, retry_count, opti_mode, next_run_at, created_at, updated_at, manual_trigger_approved)
           VALUES (@id, @order_id, @payload_json, @payload_hash, 'NEW', 0, @opti_mode, @next_run_at, @created_at, @updated_at, 0)`
        )
        .run({
          id,
          order_id: payload.order_id,
          payload_json: payloadJson,
          payload_hash: payloadHash,
          opti_mode: mode,
          next_run_at: ts,
          created_at: ts,
          updated_at: ts,
        });

      this.addAudit(id, "JOB_CREATED", "Job olusturuldu", { mode });
      return this.getJobOrThrow(id);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const existing = this.db
          .prepare("SELECT * FROM jobs WHERE payload_hash = ?")
          .get(payloadHash) as JobRecord | undefined;
        if (existing) {
          this.addAudit(existing.id, "JOB_DEDUP", "Ayni payload hash bulundu, mevcut job donuldu");
          return existing;
        }
      }
      throw error;
    }
  }

  getJobOrThrow(jobId: string): JobRecord {
    const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId) as JobRecord | undefined;
    if (!row) {
      throw new Error(ERROR_CODES.E_JOB_NOT_FOUND);
    }
    return row;
  }

  getJobWithAudit(jobId: string): { job: JobRecord; audit: AuditEvent[] } {
    const job = this.getJobOrThrow(jobId);
    const audit = this.db
      .prepare("SELECT * FROM audit_events WHERE job_id = ? ORDER BY id ASC")
      .all(jobId) as AuditEvent[];
    return { job, audit };
  }

  listJobs(limit = 100): JobRecord[] {
    // Defensive clamp for API query limits to avoid invalid or unbounded reads.
    const normalized = Number.isFinite(limit) ? Math.trunc(limit) : 100;
    const safeLimit = Math.min(500, Math.max(1, normalized));
    return this.db.prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?").all(safeLimit) as JobRecord[];
  }

  claimNextJob(): JobRecord | null {
    const tx = this.db.transaction(() => {
      const row = this.db
        .prepare(
          `SELECT * FROM jobs
           WHERE state = 'NEW'
             AND datetime(next_run_at) <= datetime('now')
           ORDER BY datetime(next_run_at) ASC, datetime(created_at) ASC
           LIMIT 1`
        )
        .get() as JobRecord | undefined;

      if (!row) {
        return null;
      }

      const token = crypto.randomUUID();
      const result = this.db
        .prepare("UPDATE jobs SET claim_token = ?, updated_at = ? WHERE id = ? AND claim_token IS NULL AND state = 'NEW'")
        .run(token, nowIso(), row.id);

      if (result.changes === 0) {
        return null;
      }

      return this.getJobOrThrow(row.id);
    });

    return tx();
  }

  setState(jobId: string, state: JobState, message: string, details?: Record<string, unknown>): void {
    this.db
      .prepare("UPDATE jobs SET state = ?, updated_at = ?, error_code = NULL, error_message = NULL WHERE id = ?")
      .run(state, nowIso(), jobId);

    this.addAudit(jobId, `STATE_${state}`, message, details);
  }

  setHold(jobId: string, errorCode: string, message: string, details?: Record<string, unknown>): void {
    this.db
      .prepare("UPDATE jobs SET state = 'HOLD', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?")
      .run(errorCode, message, nowIso(), jobId);

    this.addAudit(jobId, "STATE_HOLD", message, { errorCode, ...details });
  }

  setFailed(jobId: string, errorCode: string, message: string, details?: Record<string, unknown>): void {
    this.db
      .prepare("UPDATE jobs SET state = 'FAILED', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?")
      .run(errorCode, message, nowIso(), jobId);

    this.addAudit(jobId, "STATE_FAILED", message, { errorCode, ...details });
  }

  scheduleRetry(jobId: string, backoffMinutes: number): number {
    const nextRunAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
    this.db
      .prepare(
        "UPDATE jobs SET retry_count = retry_count + 1, state = 'NEW', claim_token = NULL, error_code = NULL, error_message = NULL, next_run_at = ?, updated_at = ? WHERE id = ?"
      )
      .run(nextRunAt, nowIso(), jobId);

    const row = this.getJobOrThrow(jobId);
    this.addAudit(jobId, "JOB_RETRY_SCHEDULED", "Retry planlandi", {
      retry_count: row.retry_count,
      backoff_minutes: backoffMinutes,
      next_run_at: nextRunAt,
    });
    return row.retry_count;
  }

  approveHold(jobId: string): JobRecord {
    const current = this.getJobOrThrow(jobId);
    if (current.state !== "HOLD") {
      throw new Error(ERROR_CODES.E_JOB_NOT_IN_HOLD);
    }

    const modeCApproved = current.error_code === ERROR_CODES.E_OPERATOR_TRIGGER_REQUIRED ? 1 : 0;
    this.db
      .prepare(
        "UPDATE jobs SET state = 'NEW', claim_token = NULL, error_code = NULL, error_message = NULL, manual_trigger_approved = ?, next_run_at = ?, updated_at = ? WHERE id = ?"
      )
      .run(modeCApproved, nowIso(), nowIso(), jobId);

    this.addAudit(jobId, "HOLD_APPROVED", "HOLD durumu operator tarafindan onaylandi", {
      mode_c_approved: Boolean(modeCApproved),
    });

    return this.getJobOrThrow(jobId);
  }

  releaseClaim(jobId: string): void {
    this.db.prepare("UPDATE jobs SET claim_token = NULL, updated_at = ? WHERE id = ?").run(nowIso(), jobId);
  }

  addAudit(jobId: string, eventType: string, message: string, details?: Record<string, unknown>): void {
    this.db
      .prepare(
        `INSERT INTO audit_events (job_id, event_type, message, details_json, created_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      .run(jobId, eventType, message, details ? JSON.stringify(details) : null, nowIso());
  }

  lookupCustomerByPhone(phoneNormalized: string): CustomerRecord | null {
    const row = this.db
      .prepare("SELECT * FROM customers WHERE phone_normalized = ?")
      .get(phoneNormalized) as CustomerRecord | undefined;
    return row ?? null;
  }

  upsertCustomer(name: string, phoneNormalized: string): CustomerRecord {
    const existing = this.lookupCustomerByPhone(phoneNormalized);
    if (existing) {
      return existing;
    }

    const row: CustomerRecord = {
      id: crypto.randomUUID(),
      name,
      phone_normalized: phoneNormalized,
      created_at: nowIso(),
    };

    this.db
      .prepare("INSERT INTO customers (id, name, phone_normalized, created_at) VALUES (?, ?, ?, ?)")
      .run(row.id, row.name, row.phone_normalized, row.created_at);

    return row;
  }
}

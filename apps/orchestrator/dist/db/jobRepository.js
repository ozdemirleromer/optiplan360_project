"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRepository = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const errors_1 = require("../domain/errors");
function nowIso() {
    return new Date().toISOString();
}
function makeHash(payload) {
    return node_crypto_1.default.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}
function isUniqueConstraintError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return error.message.includes("UNIQUE constraint failed") || error.message.includes("uq_jobs_payload_hash");
}
class JobRepository {
    db;
    constructor(db) {
        this.db = db;
    }
    createJob(payload, mode) {
        const id = node_crypto_1.default.randomUUID();
        const payloadJson = JSON.stringify(payload);
        const payloadHash = makeHash(payload);
        const ts = nowIso();
        try {
            this.db
                .prepare(`INSERT INTO jobs (id, order_id, payload_json, payload_hash, state, retry_count, opti_mode, next_run_at, created_at, updated_at, manual_trigger_approved)
           VALUES (@id, @order_id, @payload_json, @payload_hash, 'NEW', 0, @opti_mode, @next_run_at, @created_at, @updated_at, 0)`)
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
        }
        catch (error) {
            if (isUniqueConstraintError(error)) {
                const existing = this.db
                    .prepare("SELECT * FROM jobs WHERE payload_hash = ?")
                    .get(payloadHash);
                if (existing) {
                    this.addAudit(existing.id, "JOB_DEDUP", "Ayni payload hash bulundu, mevcut job donuldu");
                    return existing;
                }
            }
            throw error;
        }
    }
    getJobOrThrow(jobId) {
        const row = this.db.prepare("SELECT * FROM jobs WHERE id = ?").get(jobId);
        if (!row) {
            throw new Error(errors_1.ERROR_CODES.E_JOB_NOT_FOUND);
        }
        return row;
    }
    getJobWithAudit(jobId) {
        const job = this.getJobOrThrow(jobId);
        const audit = this.db
            .prepare("SELECT * FROM audit_events WHERE job_id = ? ORDER BY id ASC")
            .all(jobId);
        return { job, audit };
    }
    listJobs(limit = 100) {
        // Defensive clamp for API query limits to avoid invalid or unbounded reads.
        const normalized = Number.isFinite(limit) ? Math.trunc(limit) : 100;
        const safeLimit = Math.min(500, Math.max(1, normalized));
        return this.db.prepare("SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?").all(safeLimit);
    }
    claimNextJob() {
        const tx = this.db.transaction(() => {
            const row = this.db
                .prepare(`SELECT * FROM jobs
           WHERE state = 'NEW'
             AND datetime(next_run_at) <= datetime('now')
           ORDER BY datetime(next_run_at) ASC, datetime(created_at) ASC
           LIMIT 1`)
                .get();
            if (!row) {
                return null;
            }
            const token = node_crypto_1.default.randomUUID();
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
    setState(jobId, state, message, details) {
        this.db
            .prepare("UPDATE jobs SET state = ?, updated_at = ?, error_code = NULL, error_message = NULL WHERE id = ?")
            .run(state, nowIso(), jobId);
        this.addAudit(jobId, `STATE_${state}`, message, details);
    }
    setHold(jobId, errorCode, message, details) {
        this.db
            .prepare("UPDATE jobs SET state = 'HOLD', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?")
            .run(errorCode, message, nowIso(), jobId);
        this.addAudit(jobId, "STATE_HOLD", message, { errorCode, ...details });
    }
    setFailed(jobId, errorCode, message, details) {
        this.db
            .prepare("UPDATE jobs SET state = 'FAILED', error_code = ?, error_message = ?, updated_at = ? WHERE id = ?")
            .run(errorCode, message, nowIso(), jobId);
        this.addAudit(jobId, "STATE_FAILED", message, { errorCode, ...details });
    }
    scheduleRetry(jobId, backoffMinutes) {
        const nextRunAt = new Date(Date.now() + backoffMinutes * 60_000).toISOString();
        this.db
            .prepare("UPDATE jobs SET retry_count = retry_count + 1, state = 'NEW', claim_token = NULL, error_code = NULL, error_message = NULL, next_run_at = ?, updated_at = ? WHERE id = ?")
            .run(nextRunAt, nowIso(), jobId);
        const row = this.getJobOrThrow(jobId);
        this.addAudit(jobId, "JOB_RETRY_SCHEDULED", "Retry planlandi", {
            retry_count: row.retry_count,
            backoff_minutes: backoffMinutes,
            next_run_at: nextRunAt,
        });
        return row.retry_count;
    }
    approveHold(jobId) {
        const current = this.getJobOrThrow(jobId);
        if (current.state !== "HOLD") {
            throw new Error(errors_1.ERROR_CODES.E_JOB_NOT_IN_HOLD);
        }
        const modeCApproved = current.error_code === errors_1.ERROR_CODES.E_OPERATOR_TRIGGER_REQUIRED ? 1 : 0;
        this.db
            .prepare("UPDATE jobs SET state = 'NEW', claim_token = NULL, error_code = NULL, error_message = NULL, manual_trigger_approved = ?, next_run_at = ?, updated_at = ? WHERE id = ?")
            .run(modeCApproved, nowIso(), nowIso(), jobId);
        this.addAudit(jobId, "HOLD_APPROVED", "HOLD durumu operator tarafindan onaylandi", {
            mode_c_approved: Boolean(modeCApproved),
        });
        return this.getJobOrThrow(jobId);
    }
    releaseClaim(jobId) {
        this.db.prepare("UPDATE jobs SET claim_token = NULL, updated_at = ? WHERE id = ?").run(nowIso(), jobId);
    }
    addAudit(jobId, eventType, message, details) {
        this.db
            .prepare(`INSERT INTO audit_events (job_id, event_type, message, details_json, created_at)
         VALUES (?, ?, ?, ?, ?)`)
            .run(jobId, eventType, message, details ? JSON.stringify(details) : null, nowIso());
    }
    lookupCustomerByPhone(phoneNormalized) {
        const row = this.db
            .prepare("SELECT * FROM customers WHERE phone_normalized = ?")
            .get(phoneNormalized);
        return row ?? null;
    }
    upsertCustomer(name, phoneNormalized) {
        const existing = this.lookupCustomerByPhone(phoneNormalized);
        if (existing) {
            return existing;
        }
        const row = {
            id: node_crypto_1.default.randomUUID(),
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
exports.JobRepository = JobRepository;

import Database from "better-sqlite3";
import path from "node:path";
import fs from "node:fs";

export interface DatabaseContext {
  db: Database.Database;
}

function resolveDbPath(): string {
  const local = path.resolve(process.cwd(), "apps", "orchestrator", "orchestrator.db");
  if (fs.existsSync(path.dirname(local))) {
    return local;
  }
  return path.resolve(process.cwd(), "orchestrator.db");
}

function ensureJobsColumns(db: Database.Database): void {
  const columns = db.prepare("PRAGMA table_info(jobs)").all() as Array<{ name: string }>;
  const hasManualApproved = columns.some((column) => column.name === "manual_trigger_approved");
  if (!hasManualApproved) {
    db.exec("ALTER TABLE jobs ADD COLUMN manual_trigger_approved INTEGER NOT NULL DEFAULT 0;");
  }
}

export function createDatabase(dbPath?: string): DatabaseContext {
  const filePath = dbPath ?? process.env.ORCHESTRATOR_DB_PATH ?? resolveDbPath();
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const db = new Database(filePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      order_id TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      state TEXT NOT NULL,
      error_code TEXT,
      error_message TEXT,
      retry_count INTEGER NOT NULL DEFAULT 0,
      opti_mode TEXT NOT NULL,
      next_run_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      claim_token TEXT,
      manual_trigger_approved INTEGER NOT NULL DEFAULT 0
    );

    CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_payload_hash ON jobs(payload_hash);
    CREATE INDEX IF NOT EXISTS idx_jobs_next_run ON jobs(state, next_run_at);
    CREATE UNIQUE INDEX IF NOT EXISTS uq_single_opti_running ON jobs(state) WHERE state = 'OPTI_RUNNING';

    CREATE TABLE IF NOT EXISTS audit_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      message TEXT NOT NULL,
      details_json TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY(job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone_normalized TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
  `);

  ensureJobsColumns(db);

  return { db };
}

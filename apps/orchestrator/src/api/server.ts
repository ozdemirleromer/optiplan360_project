import express, { type Request, type Response, type NextFunction } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { ERROR_CODES } from "../domain/errors";
import type { OrchestratorService } from "../services/orchestratorService";
import type { PathsConfig, RulesConfig } from "../config/loadConfig";
import { devBypassAuth,requireRole, type AuthRequest } from "../middleware/auth";
import { createAuthRoutes } from "./auth-routes";
import { renderDashboard } from "./dashboard";

// Rate limiting middleware
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: "Bu IP'den çok fazla istek gönderildi, lütfen daha sonra tekrar deneyin",
  standardHeaders: true,
  legacyHeaders: false,
});

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Stricter limit for sensitive operations
  message: "Bu işlem için çok fazla istek gönderildi",
});

const partSchema = z.object({
  id: z.string(),
  part_type: z.union([z.literal("GOVDE"), z.literal("ARKALIK")]),
  material_code: z.string(),
  length_cm: z.number().positive(),
  width_cm: z.number().positive(),
  quantity: z.number().int().positive(),
  grain: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)]),
  color: z.string(),
  thickness_mm: z.number().positive(),
  edge_up: z.string().nullable().optional(),
  edge_lo: z.string().nullable().optional(),
  edge_sx: z.string().nullable().optional(),
  edge_dx: z.string().nullable().optional(),
  iidesc: z.string().optional(),
  desc1: z.string().optional(),
  delik_kodu: z.string().nullable().optional(),
});

const createJobSchema = z.object({
  order_id: z.string(),
  customer_phone: z.string(),
  customer_snapshot_name: z.string().optional(),
  opti_mode: z.union([z.literal("A"), z.literal("B"), z.literal("C")]).optional(),
  plate_size: z
    .object({
      width_mm: z.number().positive(),
      height_mm: z.number().positive(),
    })
    .optional(),
  parts: z.array(partSchema).min(1),
});

function validationErrorMessage(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

export function createApiServer(orchestratorService: OrchestratorService, paths?: PathsConfig, rules?: RulesConfig) {
  const app = express();
  app.use(express.json({ limit: "5mb" }));
  
  // Dev mode: bypass auth (set default user)
  app.use(devBypassAuth);
  
  app.use(limiter);

  // Auth routes (login, verify, me)
  app.use("/auth", createAuthRoutes());

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "orchestrator", timestamp: new Date().toISOString() });
  });

  // Dashboard anasayfa (tam panelli)
  const startedAt = Date.now();
  app.get("/", (_req, res) => {
    const jobs = orchestratorService.listJobs(100);
    const elapsed = Date.now() - startedAt;
    const mins = Math.floor(elapsed / 60000);
    const hrs = Math.floor(mins / 60);
    const uptime = hrs > 0 ? `${hrs}s ${mins % 60}dk` : `${mins}dk`;

    const html = renderDashboard({
      jobs,
      paths: paths ?? null,
      rules: rules ? {
        cm_to_mm_multiplier: rules.cm_to_mm_multiplier,
        retry_count_max: rules.retry_count_max,
        opti_mode_default: rules.optiModeDefault,
        timeouts: rules.timeouts,
        ack_mode: rules.ackMode,
      } : null,
      uptime,
    });
    res.type("html").send(html);
  });

  // Job detail UI page
  app.get("/ui/jobs/:id", (req, res) => {
    try {
      const data = orchestratorService.getJob(req.params.id);
      const j = data.job;
      const audit = data.audit || [];
      const auditRows = audit.map((a: { event_type: string; message: string; created_at: string; details_json: string | null }) =>
        `<tr><td>${a.event_type}</td><td>${a.message}</td><td>${a.created_at}</td><td><pre style="margin:0;font-size:.75rem">${a.details_json || "-"}</pre></td></tr>`
      ).join("") || `<tr><td colspan="4" style="text-align:center;color:#94a3b8">Kayit yok</td></tr>`;

      res.type("html").send(`<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Job ${j.id.slice(0, 8)} | OptiPlan360</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;padding:2rem}
a{color:#38bdf8;text-decoration:none} a:hover{text-decoration:underline}
h1{font-size:1.25rem;color:#38bdf8;margin-bottom:.25rem}
.back{margin-bottom:1.5rem;display:inline-block;font-size:.85rem}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:.5rem .75rem;background:#1e293b;padding:1.25rem;border-radius:8px;margin-bottom:1.5rem;max-width:600px}
.grid .k{font-size:.75rem;color:#94a3b8;text-transform:uppercase} .grid .v{font-size:.9rem;margin-bottom:.5rem}
.badge{padding:2px 8px;border-radius:4px;font-size:.75rem;font-weight:600}
table{width:100%;border-collapse:collapse;background:#1e293b;border-radius:8px;overflow:hidden;font-size:.85rem}
th{background:#334155;text-align:left;padding:.5rem .75rem;font-size:.7rem;text-transform:uppercase;color:#94a3b8}
td{padding:.5rem .75rem;border-top:1px solid #334155}
pre{background:#0f172a;padding:.75rem;border-radius:6px;overflow-x:auto;font-size:.8rem;color:#94a3b8;margin-top:1rem}
.actions{margin:1.5rem 0;display:flex;gap:.5rem}
.btn{padding:.5rem 1rem;border-radius:6px;border:none;font-weight:600;cursor:pointer;font-size:.85rem}
.btn-retry{background:#422006;color:#fbbf24} .btn-retry:hover{background:#78350f}
.btn-approve{background:#064e3b;color:#34d399} .btn-approve:hover{background:#065f46}
#toast{position:fixed;bottom:2rem;right:2rem;background:#1e293b;border:1px solid #334155;padding:.75rem 1.25rem;border-radius:8px;font-size:.85rem;display:none;z-index:100}
#toast.show{display:block} #toast.ok{border-color:#34d399;color:#34d399} #toast.fail{border-color:#f87171;color:#f87171}
</style></head><body>
<a class="back" href="/">&larr; Dashboard'a Don</a>
<h1>Job: ${j.id}</h1>
<div class="grid">
  <div class="k">Siparis</div><div class="v">${j.order_id}</div>
  <div class="k">Durum</div><div class="v"><span class="badge" style="background:#334155">${j.state}</span></div>
  <div class="k">Opti Modu</div><div class="v">${j.opti_mode || "C"}</div>
  <div class="k">Retry Sayisi</div><div class="v">${j.retry_count}</div>
  <div class="k">Hata Kodu</div><div class="v">${j.error_code || "-"}</div>
  <div class="k">Hata Mesaji</div><div class="v">${j.error_message || "-"}</div>
  <div class="k">Olusturulma</div><div class="v">${j.created_at}</div>
  <div class="k">Guncelleme</div><div class="v">${j.updated_at}</div>
</div>
<div class="actions">
  <button class="btn btn-retry" onclick="doAction('/jobs/${j.id}/retry','POST')">Yeniden Dene</button>
  <button class="btn btn-approve" onclick="doAction('/jobs/${j.id}/approve','POST')">Onayla</button>
</div>
<h2 style="font-size:1rem;margin-bottom:.75rem;color:#cbd5e1">Audit Log</h2>
<table><tr><th>Olay</th><th>Mesaj</th><th>Tarih</th><th>Detay</th></tr>${auditRows}</table>
<h2 style="font-size:1rem;margin:1.5rem 0 .75rem;color:#cbd5e1">Payload (JSON)</h2>
<pre>${j.payload_json ? JSON.stringify(JSON.parse(j.payload_json), null, 2) : "-"}</pre>
<div id="toast"></div>
<script>
function showToast(m,ok){const t=document.getElementById('toast');t.textContent=m;t.className='show '+(ok?'ok':'fail');setTimeout(()=>t.className='',3000)}
async function doAction(u,m){try{const r=await fetch(u,{method:m});const d=await r.json();if(r.ok){showToast('Basarili!',true);setTimeout(()=>location.reload(),800)}else{showToast('Hata: '+(d.error?.message||'?'),false)}}catch(e){showToast('Ag hatasi',false)}}
</script></body></html>`);
    } catch {
      res.redirect("/");
    }
  });

  app.get("/customers/lookup", strictLimiter, (req, res) => {
    const phone = String(req.query.phone ?? "").trim();
    if (!phone) {
      res.status(400).json({ error: { code: ERROR_CODES.E_PHONE_REQUIRED, message: "phone query zorunlu" } });
      return;
    }

    const lookup = orchestratorService.lookupCustomer(phone);
    res.json({
      success: true,
      phone_normalized: lookup.phone_normalized,
      customer: lookup.customer,
    });
  });

  app.post("/jobs", strictLimiter, (req, res) => {
    const parsed = createJobSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(422)
        .json({ error: { code: ERROR_CODES.E_VALIDATION, message: validationErrorMessage(parsed.error) } });
      return;
    }

    try {
      const job = orchestratorService.createJob(parsed.data);
      res.status(201).json({ job });
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_CODES.E_UNKNOWN;
      res.status(400).json({ error: { code: message, message } });
    }
  });

  app.post("/orders/:orderId/import/xlsx", strictLimiter, (req, res) => {
    const body = { ...req.body, order_id: req.params.orderId };
    const parsed = createJobSchema.safeParse(body);
    if (!parsed.success) {
      res
        .status(422)
        .json({ error: { code: ERROR_CODES.E_VALIDATION, message: validationErrorMessage(parsed.error) } });
      return;
    }

    try {
      const job = orchestratorService.createJob(parsed.data);
      res.status(201).json({ job });
    } catch (error) {
      const message = error instanceof Error ? error.message : ERROR_CODES.E_UNKNOWN;
      res.status(400).json({ error: { code: message, message } });
    }
  });

  app.get("/jobs/:id", (req, res) => {
    try {
      const data = orchestratorService.getJob(req.params.id);
      res.json(data);
    } catch {
      res.status(404).json({ error: { code: ERROR_CODES.E_JOB_NOT_FOUND, message: "Job bulunamadi" } });
    }
  });

  app.post("/jobs/:id/retry", strictLimiter, (req, res) => {
    try {
      const result = orchestratorService.retryJob(req.params.id);
      res.json({ success: true, ...result });
    } catch (error) {
      const code = error instanceof Error ? error.message : ERROR_CODES.E_UNKNOWN;
      res.status(400).json({ error: { code, message: code } });
    }
  });

  app.post("/jobs/:id/approve", strictLimiter, (req, res) => {
    try {
      const job = orchestratorService.approveHold(req.params.id);
      res.json({ success: true, job });
    } catch (error) {
      const code = error instanceof Error ? error.message : ERROR_CODES.E_UNKNOWN;
      res.status(400).json({ error: { code, message: code } });
    }
  });

  app.get("/jobs", (req, res) => {
    const limit = Number(req.query.limit ?? 100);
    res.json({ jobs: orchestratorService.listJobs(limit) });
  });

  app.get("/config/paths", (_req, res) => {
    if (!paths) {
      res.status(503).json({ error: { code: "E_CONFIG_UNAVAILABLE", message: "Paths config yüklenebilir değil" } });
      return;
    }
    res.json(paths);
  });

  app.get("/config/rules", (_req, res) => {
    if (!rules) {
      res.status(503).json({ error: { code: "E_CONFIG_UNAVAILABLE", message: "Rules config yüklenebilir değil" } });
      return;
    }
    res.json({
      cm_to_mm_multiplier: rules.cm_to_mm_multiplier,
      retry_count_max: rules.retry_count_max,
      opti_mode_default: rules.optiModeDefault,
      timeouts: rules.timeouts,
      ack_mode: rules.ackMode,
    });
  });

  return app;
}

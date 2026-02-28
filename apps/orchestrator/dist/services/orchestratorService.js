"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrchestratorService = void 0;
const node_path_1 = __importDefault(require("node:path"));
const errors_1 = require("../domain/errors");
class OrchestratorService {
    deps;
    constructor(deps) {
        this.deps = deps;
    }
    lookupCustomer(rawPhone) {
        return this.deps.customerService.lookupByPhone(rawPhone);
    }
    createJob(payload) {
        const mode = payload.opti_mode ?? this.deps.rules.optiModeDefault;
        return this.deps.repository.createJob(payload, mode);
    }
    getJob(jobId) {
        return this.deps.repository.getJobWithAudit(jobId);
    }
    listJobs(limit) {
        return this.deps.repository.listJobs(limit);
    }
    retryJob(jobId) {
        const job = this.deps.repository.getJobOrThrow(jobId);
        if (job.retry_count >= this.deps.rules.retry_count_max) {
            throw new Error(errors_1.ERROR_CODES.E_RETRY_LIMIT_REACHED);
        }
        if (job.error_code && errors_1.PERMANENT_ERRORS.has(job.error_code)) {
            throw new Error(job.error_code);
        }
        const nextBackoff = this.deps.rules.retry_backoff_minutes[Math.min(job.retry_count, this.deps.rules.retry_backoff_minutes.length - 1)] ?? 1;
        const retry_count = this.deps.repository.scheduleRetry(jobId, nextBackoff);
        return { retry_count };
    }
    approveHold(jobId) {
        return this.deps.repository.approveHold(jobId);
    }
    async processClaimedJob(job) {
        try {
            const payload = JSON.parse(job.payload_json);
            const lookup = this.deps.customerService.lookupByPhone(payload.customer_phone);
            if (!lookup.customer) {
                this.deps.repository.setHold(job.id, errors_1.ERROR_CODES.E_CRM_NO_MATCH, "CRM eslesmesi bulunamadi", {
                    phone_normalized: lookup.phone_normalized,
                });
                return;
            }
            const plateSize = this.resolvePlateSize(payload.plate_size);
            this.deps.templateService.validateOrThrow(this.deps.paths.xlsxTemplatePath);
            const transformed = this.deps.transformerService.transform(payload.parts, this.deps.rules, plateSize);
            this.deps.repository.setState(job.id, "PREPARED", "Job donusum icin hazirlandi", {
                batch_count: transformed.batches.length,
                backing_edge_reset_count: transformed.backing_edge_reset_count,
            });
            if (transformed.backing_edge_reset_count > 0) {
                const msg = `${transformed.backing_edge_reset_count} arkalik parca(lar)da bant alanlari sifirlandi (ihtilaf kontrolu)`;
                this.deps.repository.addAudit(job.id, "BACKING_EDGE_RESET", msg, {
                    count: transformed.backing_edge_reset_count,
                });
            }
            const importFiles = [];
            for (const batch of transformed.batches) {
                const output = await this.deps.xlsxWriterService.writeBatchXlsx(job.id, batch, this.deps.paths.xlsxTemplatePath, this.deps.paths);
                importFiles.push(output);
            }
            this.deps.repository.setState(job.id, "OPTI_IMPORTED", "XLSX dosyalari OptiPlanning import klasorune birakildi", {
                import_files: importFiles.map((value) => node_path_1.default.basename(value)),
            });
            const isModeC = job.opti_mode === "C";
            const modeCApproved = job.manual_trigger_approved === 1;
            if (isModeC && !modeCApproved) {
                this.deps.repository.setHold(job.id, errors_1.ERROR_CODES.E_OPERATOR_TRIGGER_REQUIRED, "MODE C: Operator OptiPlanning tetikleme bekleniyor");
                return;
            }
            if (!isModeC) {
                this.deps.optiPlanningAdapter.trigger({
                    mode: job.opti_mode,
                    optiplanningExePath: this.deps.paths.optiplanningExePath,
                    importFiles,
                });
            }
            this.deps.repository.setState(job.id, "OPTI_RUNNING", "OptiPlanning calistirildi");
            const xmlPath = await this.deps.xmlCollectorAdapter.waitForXml(this.deps.paths.optiplanningExportFolder, job.id, this.deps.rules.timeouts.optiXmlMinutes * 60_000);
            this.deps.repository.setState(job.id, "OPTI_DONE", "XML cikti yakalandi", {
                xml_file: node_path_1.default.basename(xmlPath),
            });
            this.deps.repository.setState(job.id, "XML_READY", "XML validasyonu tamamlandi");
            await this.deps.osiAdapter.deliverAndWaitAck(xmlPath, this.deps.paths.machineDropFolder, this.deps.rules.timeouts.osiAckMinutes * 60_000);
            this.deps.repository.setState(job.id, "DELIVERED", "OSI ACK alindi");
            this.deps.repository.setState(job.id, "DONE", "Job basariyla tamamlandi");
        }
        catch (error) {
            const code = error instanceof Error ? error.message : errors_1.ERROR_CODES.E_UNKNOWN;
            if (errors_1.HOLD_ERROR_CODES.has(code)) {
                this.deps.repository.setHold(job.id, code, "Islem HOLD", { reason: code });
            }
            else {
                this.deps.repository.setFailed(job.id, code, "Islem FAILED", { reason: code });
            }
        }
        finally {
            this.deps.repository.releaseClaim(job.id);
        }
    }
    resolvePlateSize(payloadPlate) {
        if (payloadPlate) {
            return payloadPlate;
        }
        if (this.deps.rules.defaultPlateSize) {
            return this.deps.rules.defaultPlateSize;
        }
        throw new Error(errors_1.ERROR_CODES.E_PLATE_SIZE_MISSING);
    }
}
exports.OrchestratorService = OrchestratorService;

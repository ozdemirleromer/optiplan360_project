import path from "node:path";
import type { JobRepository } from "../db/jobRepository";
import { ERROR_CODES, HOLD_ERROR_CODES, PERMANENT_ERRORS } from "../domain/errors";
import type { JobPayload, JobRecord, OptiMode, PlateSize } from "../domain/job";
import type { PathsConfig, RulesConfig } from "../config/loadConfig";
import { CustomerService } from "./customerService";
import { TransformerService } from "./transformerService";
import { TemplateService } from "./templateService";
import { XlsxWriterService } from "./xlsxWriterService";
import { OptiPlanningAdapter } from "../adapters/optiPlanningAdapter";
import { XmlCollectorAdapter } from "../adapters/xmlCollectorAdapter";
import { OsiAdapter } from "../adapters/osiAdapter";

interface ServiceDeps {
  repository: JobRepository;
  paths: PathsConfig;
  rules: RulesConfig;
  customerService: CustomerService;
  transformerService: TransformerService;
  templateService: TemplateService;
  xlsxWriterService: XlsxWriterService;
  optiPlanningAdapter: OptiPlanningAdapter;
  xmlCollectorAdapter: XmlCollectorAdapter;
  osiAdapter: OsiAdapter;
}

export class OrchestratorService {
  constructor(private readonly deps: ServiceDeps) {}

  lookupCustomer(rawPhone: string) {
    return this.deps.customerService.lookupByPhone(rawPhone);
  }

  createJob(payload: JobPayload): JobRecord {
    const mode = payload.opti_mode ?? this.deps.rules.optiModeDefault;
    return this.deps.repository.createJob(payload, mode);
  }

  getJob(jobId: string) {
    return this.deps.repository.getJobWithAudit(jobId);
  }

  listJobs(limit?: number) {
    return this.deps.repository.listJobs(limit);
  }

  retryJob(jobId: string): { retry_count: number } {
    const job = this.deps.repository.getJobOrThrow(jobId);

    if (job.retry_count >= this.deps.rules.retry_count_max) {
      throw new Error(ERROR_CODES.E_RETRY_LIMIT_REACHED);
    }

    if (job.error_code && PERMANENT_ERRORS.has(job.error_code)) {
      throw new Error(job.error_code);
    }

    const nextBackoff =
      this.deps.rules.retry_backoff_minutes[Math.min(job.retry_count, this.deps.rules.retry_backoff_minutes.length - 1)] ?? 1;
    const retry_count = this.deps.repository.scheduleRetry(jobId, nextBackoff);

    return { retry_count };
  }

  approveHold(jobId: string): JobRecord {
    return this.deps.repository.approveHold(jobId);
  }

  async processClaimedJob(job: JobRecord): Promise<void> {
    try {
      const payload = JSON.parse(job.payload_json) as JobPayload;

      const lookup = this.deps.customerService.lookupByPhone(payload.customer_phone);
      if (!lookup.customer) {
        this.deps.repository.setHold(job.id, ERROR_CODES.E_CRM_NO_MATCH, "CRM eslesmesi bulunamadi", {
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

      const importFiles: string[] = [];
      for (const batch of transformed.batches) {
        const output = await this.deps.xlsxWriterService.writeBatchXlsx(
          job.id,
          batch,
          this.deps.paths.xlsxTemplatePath,
          this.deps.paths,
        );
        importFiles.push(output);
      }

      this.deps.repository.setState(job.id, "OPTI_IMPORTED", "XLSX dosyalari OptiPlanning import klasorune birakildi", {
        import_files: importFiles.map((value) => path.basename(value)),
      });

      const isModeC = job.opti_mode === "C";
      const modeCApproved = job.manual_trigger_approved === 1;

      if (isModeC && !modeCApproved) {
        this.deps.repository.setHold(
          job.id,
          ERROR_CODES.E_OPERATOR_TRIGGER_REQUIRED,
          "MODE C: Operator OptiPlanning tetikleme bekleniyor",
        );
        return;
      }

      if (!isModeC) {
        this.deps.optiPlanningAdapter.trigger({
          mode: job.opti_mode as OptiMode,
          optiplanningExePath: this.deps.paths.optiplanningExePath,
          importFiles,
        });
      }

      this.deps.repository.setState(job.id, "OPTI_RUNNING", "OptiPlanning calistirildi");

      const xmlPath = await this.deps.xmlCollectorAdapter.waitForXml(
        this.deps.paths.optiplanningExportFolder,
        job.id,
        this.deps.rules.timeouts.optiXmlMinutes * 60_000,
      );

      this.deps.repository.setState(job.id, "OPTI_DONE", "XML cikti yakalandi", {
        xml_file: path.basename(xmlPath),
      });

      this.deps.repository.setState(job.id, "XML_READY", "XML validasyonu tamamlandi");

      await this.deps.osiAdapter.deliverAndWaitAck(
        xmlPath,
        this.deps.paths.machineDropFolder,
        this.deps.rules.timeouts.osiAckMinutes * 60_000,
      );

      this.deps.repository.setState(job.id, "DELIVERED", "OSI ACK alindi");
      this.deps.repository.setState(job.id, "DONE", "Job basariyla tamamlandi");
    } catch (error) {
      const code = error instanceof Error ? error.message : ERROR_CODES.E_UNKNOWN;
      if (HOLD_ERROR_CODES.has(code)) {
        this.deps.repository.setHold(job.id, code, "Islem HOLD", { reason: code });
      } else {
        this.deps.repository.setFailed(job.id, code, "Islem FAILED", { reason: code });
      }
    } finally {
      this.deps.repository.releaseClaim(job.id);
    }
  }

  private resolvePlateSize(payloadPlate?: PlateSize): PlateSize {
    if (payloadPlate) {
      return payloadPlate;
    }

    if (this.deps.rules.defaultPlateSize) {
      return this.deps.rules.defaultPlateSize;
    }

    throw new Error(ERROR_CODES.E_PLATE_SIZE_MISSING);
  }
}

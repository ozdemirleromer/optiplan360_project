import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createDatabase } from "../../src/db/database";
import { JobRepository } from "../../src/db/jobRepository";
import type { PathsConfig, RulesConfig } from "../../src/config/loadConfig";
import { CustomerService } from "../../src/services/customerService";
import { TransformerService } from "../../src/services/transformerService";
import { TemplateService } from "../../src/services/templateService";
import { XlsxWriterService } from "../../src/services/xlsxWriterService";
import { OrchestratorService } from "../../src/services/orchestratorService";

const TAG_ROW = [
  "[P_CODE_MAT]",
  "[P_LENGTH]",
  "[P_WIDTH]",
  "[P_MINQ]",
  "[P_GRAIN]",
  "[P_IDESC]",
  "[P_EDGE_MAT_UP]",
  "[P_EGDE_MAT_LO]",
  "[P_EDGE_MAT_SX]",
  "[P_EDGE_MAT_DX]",
  "[P_IIDESC]",
  "[P_DESC1]",
];

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

async function createTemplate(templatePath: string): Promise<void> {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    TAG_ROW,
    [
      "P_CODE_MAT",
      "P_LENGTH",
      "P_WIDTH",
      "P_MINQ",
      "P_GRAIN",
      "P_IDESC",
      "P_EDGE_MAT_UP",
      "P_EGDE_MAT_LO",
      "P_EDGE_MAT_SX",
      "P_EDGE_MAT_DX",
      "P_IIDESC",
      "P_DESC1",
    ],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, "ŞABLON");
  XLSX.writeFile(wb, templatePath);
}

describe("Orchestrator e2e fake runner", () => {
  it("NEW -> DONE akisinda job basariyla tamamlanir", async () => {
    const root = await makeTempDir("orchestrator-e2e-");
    const importDir = path.join(root, "import");
    const exportDir = path.join(root, "export");
    const rulesDir = path.join(root, "rules");
    const tempDir = path.join(root, "temp");
    const machineDrop = path.join(root, "drop");
    const templatePath = path.join(root, "Excel_sablon.xlsx");

    await fs.mkdir(importDir, { recursive: true });
    await fs.mkdir(exportDir, { recursive: true });
    await fs.mkdir(rulesDir, { recursive: true });
    await fs.mkdir(tempDir, { recursive: true });
    await fs.mkdir(machineDrop, { recursive: true });

    await createTemplate(templatePath);

    const dbPath = path.join(root, "orchestrator.db");
    const { db } = createDatabase(dbPath);
    const repository = new JobRepository(db);

    const paths: PathsConfig = {
      optiplanningExePath: "C:/fake/opti.exe",
      optiplanningImportFolder: importDir,
      optiplanningExportFolder: exportDir,
      optiplanningRulesFolder: rulesDir,
      machineDropFolder: machineDrop,
      tempFolder: tempDir,
      xlsxTemplatePath: templatePath,
    };

    const rules: RulesConfig = {
      cm_to_mm_multiplier: 10,
      trimByThickness: {
        "18": 10,
        "3": 5,
        "4": 5,
        "5": 5,
        "8": 5,
      },
      backingThicknesses: [3, 4, 5, 8],
      edgeMapping: {
        "Bant Yok": null,
        "040": 0.4,
        "1mm": 1,
        "2mm": 2,
      },
      grainMapping: {
        "0": 0,
        "1": 1,
        "2": 2,
        "3": 3,
      },
      mergePolicy: {
        defaultDisabled: true,
        requiresOperatorApproval: true,
      },
      defaultPlateSize: {
        width_mm: 2100,
        height_mm: 2800,
      },
      retry_count_max: 3,
      retry_backoff_minutes: [1, 3, 9],
      optiModeDefault: "A",
      timeouts: {
        optiXmlMinutes: 20,
        osiAckMinutes: 5,
      },
      ackMode: "file_move",
    };

    const customerService = new CustomerService(repository);
    customerService.createCustomer("Test Musteri", "05551234567");

    const orchestrator = new OrchestratorService({
      repository,
      paths,
      rules,
      customerService,
      transformerService: new TransformerService(),
      templateService: new TemplateService(),
      xlsxWriterService: new XlsxWriterService(),
      optiPlanningAdapter: {
        trigger: () => ({ operatorActionRequired: false }),
      } as never,
      xmlCollectorAdapter: {
        waitForXml: async () => {
          const xmlPath = path.join(exportDir, "job_test.xml");
          await fs.writeFile(xmlPath, "<root><ok>true</ok></root>", "utf-8");
          return xmlPath;
        },
      } as never,
      osiAdapter: {
        deliverAndWaitAck: async () => Promise.resolve(),
      } as never,
    });

    const created = orchestrator.createJob({
      order_id: "ORDER-E2E",
      customer_phone: "05551234567",
      opti_mode: "A",
      parts: [
        {
          id: "p1",
          part_type: "GOVDE",
          material_code: "MAT-01",
          length_cm: 120,
          width_cm: 45,
          quantity: 2,
          grain: 1,
          color: "Beyaz",
          thickness_mm: 18,
          edge_up: "1mm",
          edge_lo: "1mm",
          edge_sx: "040",
          edge_dx: "Bant Yok",
        },
      ],
    });

    const claimed = repository.claimNextJob();
    expect(claimed?.id).toBe(created.id);

    await orchestrator.processClaimedJob(claimed!);

    const final = repository.getJobOrThrow(created.id);
    expect(final.state).toBe("DONE");
  });
});

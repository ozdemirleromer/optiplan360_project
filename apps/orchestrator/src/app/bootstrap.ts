import { OptiPlanningAdapter } from "../adapters/optiPlanningAdapter";
import { OsiAdapter } from "../adapters/osiAdapter";
import { XmlCollectorAdapter } from "../adapters/xmlCollectorAdapter";
import { createApiServer } from "../api/server";
import { loadPathsConfig, loadRulesConfig } from "../config/loadConfig";
import { createDatabase } from "../db/database";
import { JobRepository } from "../db/jobRepository";
import { JobRunner } from "../runtime/jobRunner";
import { CustomerService } from "../services/customerService";
import { OrchestratorService } from "../services/orchestratorService";
import { TemplateService } from "../services/templateService";
import { TransformerService } from "../services/transformerService";
import { XlsxWriterService } from "../services/xlsxWriterService";

export function startOrchestratorApp(): void {
  const paths = loadPathsConfig();
  const rules = loadRulesConfig();
  const { db } = createDatabase();

  const repository = new JobRepository(db);
  const customerService = new CustomerService(repository);

  const orchestratorService = new OrchestratorService({
    repository,
    paths,
    rules,
    customerService,
    transformerService: new TransformerService(),
    templateService: new TemplateService(),
    xlsxWriterService: new XlsxWriterService(),
    optiPlanningAdapter: new OptiPlanningAdapter(),
    xmlCollectorAdapter: new XmlCollectorAdapter(),
    osiAdapter: new OsiAdapter(),
  });

  const runner = new JobRunner(repository, orchestratorService);
  const app = createApiServer(orchestratorService, paths, rules);

  const port = Number(process.env.ORCHESTRATOR_PORT ?? 8090);
  app.listen(port, () => {
    console.log(`[orchestrator] server started on ${port}`);
    runner.start();
  });

  process.on("SIGINT", () => {
    runner.stop();
    process.exit(0);
  });

  process.on("SIGTERM", () => {
    runner.stop();
    process.exit(0);
  });
}

"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const database_1 = require("./db/database");
const jobRepository_1 = require("./db/jobRepository");
const loadConfig_1 = require("./config/loadConfig");
const customerService_1 = require("./services/customerService");
const transformerService_1 = require("./services/transformerService");
const templateService_1 = require("./services/templateService");
const xlsxWriterService_1 = require("./services/xlsxWriterService");
const optiPlanningAdapter_1 = require("./adapters/optiPlanningAdapter");
const xmlCollectorAdapter_1 = require("./adapters/xmlCollectorAdapter");
const osiAdapter_1 = require("./adapters/osiAdapter");
const orchestratorService_1 = require("./services/orchestratorService");
const jobRunner_1 = require("./runtime/jobRunner");
const server_1 = require("./api/server");
const paths = (0, loadConfig_1.loadPathsConfig)();
const rules = (0, loadConfig_1.loadRulesConfig)();
const { db } = (0, database_1.createDatabase)();
const repository = new jobRepository_1.JobRepository(db);
const customerService = new customerService_1.CustomerService(repository);
const orchestratorService = new orchestratorService_1.OrchestratorService({
    repository,
    paths,
    rules,
    customerService,
    transformerService: new transformerService_1.TransformerService(),
    templateService: new templateService_1.TemplateService(),
    xlsxWriterService: new xlsxWriterService_1.XlsxWriterService(),
    optiPlanningAdapter: new optiPlanningAdapter_1.OptiPlanningAdapter(),
    xmlCollectorAdapter: new xmlCollectorAdapter_1.XmlCollectorAdapter(),
    osiAdapter: new osiAdapter_1.OsiAdapter(),
});
const runner = new jobRunner_1.JobRunner(repository, orchestratorService);
const app = (0, server_1.createApiServer)(orchestratorService, paths, rules);
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

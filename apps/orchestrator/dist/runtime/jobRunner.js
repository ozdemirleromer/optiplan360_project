"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobRunner = void 0;
class JobRunner {
    repository;
    orchestratorService;
    running = false;
    timer = null;
    constructor(repository, orchestratorService) {
        this.repository = repository;
        this.orchestratorService = orchestratorService;
    }
    start() {
        if (this.running) {
            return;
        }
        this.running = true;
        this.schedule(50);
    }
    stop() {
        this.running = false;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }
    schedule(delayMs) {
        if (!this.running) {
            return;
        }
        this.timer = setTimeout(() => {
            void this.tick();
        }, delayMs);
    }
    async tick() {
        if (!this.running) {
            return;
        }
        const claimed = this.repository.claimNextJob();
        if (!claimed) {
            this.schedule(1_000);
            return;
        }
        await this.orchestratorService.processClaimedJob(claimed);
        this.schedule(100);
    }
}
exports.JobRunner = JobRunner;

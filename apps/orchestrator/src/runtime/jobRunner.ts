import type { JobRepository } from "../db/jobRepository";
import type { OrchestratorService } from "../services/orchestratorService";

export class JobRunner {
  private running = false;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly repository: JobRepository,
    private readonly orchestratorService: OrchestratorService,
  ) {}

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.schedule(50);
  }

  stop(): void {
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedule(delayMs: number): void {
    if (!this.running) {
      return;
    }

    this.timer = setTimeout(() => {
      void this.tick();
    }, delayMs);
  }

  private async tick(): Promise<void> {
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

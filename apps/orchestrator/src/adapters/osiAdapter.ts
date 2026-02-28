import fs from "node:fs/promises";
import path from "node:path";
import { ERROR_CODES } from "../domain/errors";
import { copyFileAtomic } from "../utils/atomicFile";

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class OsiAdapter {
  async deliverAndWaitAck(xmlPath: string, machineDropFolder: string, timeoutMs: number): Promise<void> {
    const inbox = path.join(machineDropFolder, "inbox");
    const processed = path.join(machineDropFolder, "processed");
    const failed = path.join(machineDropFolder, "failed");

    await fs.mkdir(inbox, { recursive: true });
    await fs.mkdir(processed, { recursive: true });
    await fs.mkdir(failed, { recursive: true });

    const fileName = path.basename(xmlPath);
    const inboxTarget = path.join(inbox, fileName);
    await copyFileAtomic(xmlPath, inboxTarget);

    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const processedPath = path.join(processed, fileName);
      const failedPath = path.join(failed, fileName);
      const inboxPath = path.join(inbox, fileName);

      const hasProcessed = await fs.access(processedPath).then(() => true).catch(() => false);
      if (hasProcessed) {
        const stillInInbox = await fs.access(inboxPath).then(() => true).catch(() => false);
        if (!stillInInbox) {
          return;
        }
      }

      const hasFailed = await fs.access(failedPath).then(() => true).catch(() => false);
      if (hasFailed) {
        throw new Error(ERROR_CODES.E_OSI_ACK_FAILED);
      }

      await delay(1_000);
    }

    throw new Error(ERROR_CODES.E_OSI_ACK_TIMEOUT);
  }
}

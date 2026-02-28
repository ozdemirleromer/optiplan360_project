import fs from "node:fs/promises";
import path from "node:path";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { ERROR_CODES } from "../domain/errors";

const parser = new XMLParser({
  ignoreAttributes: false,
  trimValues: true,
});

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class XmlCollectorAdapter {
  async waitForXml(exportFolder: string, jobId: string, timeoutMs: number): Promise<string> {
    const started = Date.now();
    const normalizedJobId = jobId.toLowerCase();

    while (Date.now() - started < timeoutMs) {
      const files = await fs.readdir(exportFolder).catch(() => []);
      const candidate = files.find((file) => file.toLowerCase().endsWith(".xml") && file.toLowerCase().includes(normalizedJobId));

      if (candidate) {
        const fullPath = path.join(exportFolder, candidate);
        await this.validateOrThrow(fullPath);
        return fullPath;
      }

      await delay(1_000);
    }

    throw new Error(ERROR_CODES.E_OPTI_XML_TIMEOUT);
  }

  async validateOrThrow(xmlPath: string): Promise<void> {
    const xmlRaw = await fs.readFile(xmlPath, "utf-8");
    const isValidXml = XMLValidator.validate(xmlRaw);
    if (isValidXml !== true) {
      throw new Error(ERROR_CODES.E_XML_INVALID);
    }

    let parsed: unknown;
    try {
      parsed = parser.parse(xmlRaw);
    } catch {
      throw new Error(ERROR_CODES.E_XML_INVALID);
    }

    if (!parsed || typeof parsed !== "object") {
      throw new Error(ERROR_CODES.E_XML_INVALID);
    }
  }
}

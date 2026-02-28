import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ERROR_CODES } from "../../src/domain/errors";
import { XmlCollectorAdapter } from "../../src/adapters/xmlCollectorAdapter";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("XmlCollectorAdapter", () => {
  it("job id iceren xml dosyasini bulur ve dogrular", async () => {
    const dir = await makeTempDir("xml-ok-");
    const xmlPath = path.join(dir, "job-123_export.xml");
    await fs.writeFile(xmlPath, "<root><ok>true</ok></root>", "utf-8");

    const adapter = new XmlCollectorAdapter();
    const found = await adapter.waitForXml(dir, "job-123", 500);

    expect(found).toBe(xmlPath);
  });

  it("gecersiz xml iceriginde E_XML_INVALID doner", async () => {
    const dir = await makeTempDir("xml-bad-");
    const xmlPath = path.join(dir, "job-bad_export.xml");
    await fs.writeFile(xmlPath, "<root>", "utf-8");

    const adapter = new XmlCollectorAdapter();
    await expect(adapter.validateOrThrow(xmlPath)).rejects.toThrow(ERROR_CODES.E_XML_INVALID);
  });
});

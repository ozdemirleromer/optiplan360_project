import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { copyFileAtomic, writeFileAtomic } from "../../src/utils/atomicFile";

async function makeTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

describe("atomicFile", () => {
  it("writeFileAtomic hedef dosyayi atomik sekilde yazar", async () => {
    const dir = await makeTempDir("atomic-write-");
    const target = path.join(dir, "sample.txt");

    await writeFileAtomic(target, "hello");
    const raw = await fs.readFile(target, "utf-8");

    expect(raw).toBe("hello");
  });

  it("copyFileAtomic kaynak dosyayi hedefe atomik sekilde kopyalar", async () => {
    const dir = await makeTempDir("atomic-copy-");
    const source = path.join(dir, "source.txt");
    const target = path.join(dir, "dest.txt");

    await fs.writeFile(source, "copy-me", "utf-8");
    await copyFileAtomic(source, target);

    const raw = await fs.readFile(target, "utf-8");
    expect(raw).toBe("copy-me");
  });
});

import fs from "node:fs/promises";
import path from "node:path";

export async function ensureDir(targetPath: string): Promise<void> {
  await fs.mkdir(targetPath, { recursive: true });
}

export async function writeFileAtomic(targetPath: string, content: Buffer | string): Promise<void> {
  const dir = path.dirname(targetPath);
  await ensureDir(dir);

  const tmpPath = `${targetPath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
  await fs.writeFile(tmpPath, content);
  await fs.rename(tmpPath, targetPath);
}

export async function copyFileAtomic(sourcePath: string, targetPath: string): Promise<void> {
  const content = await fs.readFile(sourcePath);
  await writeFileAtomic(targetPath, content);
}

"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDir = ensureDir;
exports.writeFileAtomic = writeFileAtomic;
exports.copyFileAtomic = copyFileAtomic;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
async function ensureDir(targetPath) {
    await promises_1.default.mkdir(targetPath, { recursive: true });
}
async function writeFileAtomic(targetPath, content) {
    const dir = node_path_1.default.dirname(targetPath);
    await ensureDir(dir);
    const tmpPath = `${targetPath}.${Date.now()}.${Math.random().toString(16).slice(2)}.tmp`;
    await promises_1.default.writeFile(tmpPath, content);
    await promises_1.default.rename(tmpPath, targetPath);
}
async function copyFileAtomic(sourcePath, targetPath) {
    const content = await promises_1.default.readFile(sourcePath);
    await writeFileAtomic(targetPath, content);
}

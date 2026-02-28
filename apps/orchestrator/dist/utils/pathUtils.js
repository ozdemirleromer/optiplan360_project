"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.withExtension = withExtension;
exports.toSafeFileName = toSafeFileName;
const node_path_1 = __importDefault(require("node:path"));
function withExtension(fileName, nextExt) {
    const parsed = node_path_1.default.parse(fileName);
    return `${parsed.name}${nextExt.startsWith(".") ? nextExt : `.${nextExt}`}`;
}
function toSafeFileName(value) {
    return value.replace(/[^a-zA-Z0-9_-]/g, "_");
}

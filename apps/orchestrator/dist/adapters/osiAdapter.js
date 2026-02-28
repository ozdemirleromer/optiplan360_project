"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OsiAdapter = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const errors_1 = require("../domain/errors");
const atomicFile_1 = require("../utils/atomicFile");
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
class OsiAdapter {
    async deliverAndWaitAck(xmlPath, machineDropFolder, timeoutMs) {
        const inbox = node_path_1.default.join(machineDropFolder, "inbox");
        const processed = node_path_1.default.join(machineDropFolder, "processed");
        const failed = node_path_1.default.join(machineDropFolder, "failed");
        await promises_1.default.mkdir(inbox, { recursive: true });
        await promises_1.default.mkdir(processed, { recursive: true });
        await promises_1.default.mkdir(failed, { recursive: true });
        const fileName = node_path_1.default.basename(xmlPath);
        const inboxTarget = node_path_1.default.join(inbox, fileName);
        await (0, atomicFile_1.copyFileAtomic)(xmlPath, inboxTarget);
        const started = Date.now();
        while (Date.now() - started < timeoutMs) {
            const processedPath = node_path_1.default.join(processed, fileName);
            const failedPath = node_path_1.default.join(failed, fileName);
            const inboxPath = node_path_1.default.join(inbox, fileName);
            const hasProcessed = await promises_1.default.access(processedPath).then(() => true).catch(() => false);
            if (hasProcessed) {
                const stillInInbox = await promises_1.default.access(inboxPath).then(() => true).catch(() => false);
                if (!stillInInbox) {
                    return;
                }
            }
            const hasFailed = await promises_1.default.access(failedPath).then(() => true).catch(() => false);
            if (hasFailed) {
                throw new Error(errors_1.ERROR_CODES.E_OSI_ACK_FAILED);
            }
            await delay(1_000);
        }
        throw new Error(errors_1.ERROR_CODES.E_OSI_ACK_TIMEOUT);
    }
}
exports.OsiAdapter = OsiAdapter;

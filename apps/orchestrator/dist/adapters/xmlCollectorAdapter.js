"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XmlCollectorAdapter = void 0;
const promises_1 = __importDefault(require("node:fs/promises"));
const node_path_1 = __importDefault(require("node:path"));
const fast_xml_parser_1 = require("fast-xml-parser");
const errors_1 = require("../domain/errors");
const parser = new fast_xml_parser_1.XMLParser({
    ignoreAttributes: false,
    trimValues: true,
});
function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
class XmlCollectorAdapter {
    async waitForXml(exportFolder, jobId, timeoutMs) {
        const started = Date.now();
        const normalizedJobId = jobId.toLowerCase();
        while (Date.now() - started < timeoutMs) {
            const files = await promises_1.default.readdir(exportFolder).catch(() => []);
            const candidate = files.find((file) => file.toLowerCase().endsWith(".xml") && file.toLowerCase().includes(normalizedJobId));
            if (candidate) {
                const fullPath = node_path_1.default.join(exportFolder, candidate);
                await this.validateOrThrow(fullPath);
                return fullPath;
            }
            await delay(1_000);
        }
        throw new Error(errors_1.ERROR_CODES.E_OPTI_XML_TIMEOUT);
    }
    async validateOrThrow(xmlPath) {
        const xmlRaw = await promises_1.default.readFile(xmlPath, "utf-8");
        const isValidXml = fast_xml_parser_1.XMLValidator.validate(xmlRaw);
        if (isValidXml !== true) {
            throw new Error(errors_1.ERROR_CODES.E_XML_INVALID);
        }
        let parsed;
        try {
            parsed = parser.parse(xmlRaw);
        }
        catch {
            throw new Error(errors_1.ERROR_CODES.E_XML_INVALID);
        }
        if (!parsed || typeof parsed !== "object") {
            throw new Error(errors_1.ERROR_CODES.E_XML_INVALID);
        }
    }
}
exports.XmlCollectorAdapter = XmlCollectorAdapter;

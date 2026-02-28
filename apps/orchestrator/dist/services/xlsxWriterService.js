"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.XlsxWriterService = void 0;
const node_path_1 = __importDefault(require("node:path"));
const XLSX = __importStar(require("xlsx"));
const atomicFile_1 = require("../utils/atomicFile");
const pathUtils_1 = require("../utils/pathUtils");
const SHEET_NAME = "ŞABLON";
class XlsxWriterService {
    async writeBatchXlsx(jobId, batch, templatePath, paths) {
        const workbook = XLSX.readFile(templatePath, { cellDates: false });
        const worksheet = workbook.Sheets[SHEET_NAME];
        if (!worksheet) {
            throw new Error("E_TEMPLATE_INVALID");
        }
        let rowIndex = 2;
        for (const row of batch.rows) {
            const values = [
                row.P_CODE_MAT,
                row.P_LENGTH,
                row.P_WIDTH,
                row.P_MINQ,
                row.P_GRAIN,
                row.P_IDESC,
                row.P_EDGE_MAT_UP,
                row.P_EGDE_MAT_LO,
                row.P_EDGE_MAT_SX,
                row.P_EDGE_MAT_DX,
                row.P_IIDESC,
                row.P_DESC1,
            ];
            values.forEach((value, columnIndex) => {
                const address = XLSX.utils.encode_cell({ r: rowIndex, c: columnIndex });
                if (value === null || value === "") {
                    delete worksheet[address];
                    return;
                }
                worksheet[address] = {
                    t: typeof value === "number" ? "n" : "s",
                    v: value,
                };
            });
            rowIndex += 1;
        }
        const range = XLSX.utils.decode_range(worksheet["!ref"] ?? "A1:L2");
        range.e.r = Math.max(range.e.r, rowIndex - 1);
        worksheet["!ref"] = XLSX.utils.encode_range(range);
        const fileName = `${(0, pathUtils_1.toSafeFileName)(jobId)}_${(0, pathUtils_1.toSafeFileName)(batch.part_type)}_${(0, pathUtils_1.toSafeFileName)(batch.color)}_${batch.thickness_mm}mm.xlsx`;
        const targetPath = node_path_1.default.join(paths.optiplanningImportFolder, fileName);
        const binary = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
        await (0, atomicFile_1.writeFileAtomic)(targetPath, binary);
        return targetPath;
    }
}
exports.XlsxWriterService = XlsxWriterService;

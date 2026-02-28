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
exports.TemplateService = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const errors_1 = require("../domain/errors");
const XLSX = __importStar(require("xlsx"));
const REQUIRED_SHEET_NAME = "ŞABLON";
const REQUIRED_TAGS = [
    "[P_CODE_MAT]",
    "[P_LENGTH]",
    "[P_WIDTH]",
    "[P_MINQ]",
    "[P_GRAIN]",
    "[P_IDESC]",
    "[P_EDGE_MAT_UP]",
    "[P_EGDE_MAT_LO]",
    "[P_EDGE_MAT_SX]",
    "[P_EDGE_MAT_DX]",
    "[P_IIDESC]",
    "[P_DESC1]",
];
class TemplateService {
    validateOrThrow(templatePath) {
        if (!node_fs_1.default.existsSync(templatePath)) {
            throw new Error(errors_1.ERROR_CODES.E_TEMPLATE_INVALID);
        }
        const workbook = XLSX.readFile(templatePath, { cellDates: false });
        if (!workbook.SheetNames.includes(REQUIRED_SHEET_NAME)) {
            throw new Error(errors_1.ERROR_CODES.E_TEMPLATE_INVALID);
        }
        const worksheet = workbook.Sheets[REQUIRED_SHEET_NAME];
        const rows = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            blankrows: false,
        });
        const firstRow = (rows[0] ?? []).map((value) => String(value ?? "").trim());
        if (firstRow.length !== REQUIRED_TAGS.length) {
            throw new Error(errors_1.ERROR_CODES.E_TEMPLATE_INVALID);
        }
        for (let index = 0; index < REQUIRED_TAGS.length; index += 1) {
            if (firstRow[index] !== REQUIRED_TAGS[index]) {
                throw new Error(errors_1.ERROR_CODES.E_TEMPLATE_INVALID);
            }
        }
    }
}
exports.TemplateService = TemplateService;

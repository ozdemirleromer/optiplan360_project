import fs from "node:fs";
import { ERROR_CODES } from "../domain/errors";
import * as XLSX from "xlsx";

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
] as const;

export class TemplateService {
  validateOrThrow(templatePath: string): void {
    if (!fs.existsSync(templatePath)) {
      throw new Error(ERROR_CODES.E_TEMPLATE_INVALID);
    }

    const workbook = XLSX.readFile(templatePath, { cellDates: false });
    if (!workbook.SheetNames.includes(REQUIRED_SHEET_NAME)) {
      throw new Error(ERROR_CODES.E_TEMPLATE_INVALID);
    }

    const worksheet = workbook.Sheets[REQUIRED_SHEET_NAME];
    const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(worksheet, {
      header: 1,
      blankrows: false,
    });

    const firstRow = (rows[0] ?? []).map((value) => String(value ?? "").trim());
    if (firstRow.length !== REQUIRED_TAGS.length) {
      throw new Error(ERROR_CODES.E_TEMPLATE_INVALID);
    }

    for (let index = 0; index < REQUIRED_TAGS.length; index += 1) {
      if (firstRow[index] !== REQUIRED_TAGS[index]) {
        throw new Error(ERROR_CODES.E_TEMPLATE_INVALID);
      }
    }
  }
}

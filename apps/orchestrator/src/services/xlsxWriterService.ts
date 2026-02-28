import path from "node:path";
import * as XLSX from "xlsx";
import { writeFileAtomic } from "../utils/atomicFile";
import type { TransformBatch } from "./transformerService";
import type { PathsConfig } from "../config/loadConfig";
import { toSafeFileName } from "../utils/pathUtils";

const SHEET_NAME = "ŞABLON";

export class XlsxWriterService {
  async writeBatchXlsx(jobId: string, batch: TransformBatch, templatePath: string, paths: PathsConfig): Promise<string> {
    const workbook = XLSX.readFile(templatePath, { cellDates: false });
    const worksheet = workbook.Sheets[SHEET_NAME];

    if (!worksheet) {
      throw new Error("E_TEMPLATE_INVALID");
    }

    let rowIndex = 2;
    for (const row of batch.rows) {
      const values: Array<string | number | null> = [
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

    const fileName = `${toSafeFileName(jobId)}_${toSafeFileName(batch.part_type)}_${toSafeFileName(batch.color)}_${batch.thickness_mm}mm.xlsx`;
    const targetPath = path.join(paths.optiplanningImportFolder, fileName);

    const binary = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    await writeFileAtomic(targetPath, binary);

    return targetPath;
  }
}

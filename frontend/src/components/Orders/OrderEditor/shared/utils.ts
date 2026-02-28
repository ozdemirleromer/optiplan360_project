/**
 * OrderEditor utilities
 */
import { Order } from "../../../../types";
import { MeasureRow } from "./types";

const CSV_HEADERS = [
  "boy",
  "en",
  "adet",
  "grain",
  "u1",
  "u2",
  "k1",
  "k2",
  "delik-1",
  "delik-2",
  "bilgi",
];

type Delimiter = "," | ";" | "\t";

interface ParsedImport {
  rows: MeasureRow[];
  warnings: string[];
  meta?: {
    thickness?: number;
    plateSize?: string;
    material?: string;
  };
}

export const buildOrderPayload = (
  orderId: string | number,
  customerName: string,
  customerPhone: string,
  plateSize: string,
  thickness: number,
  selectedGrain: string,
  rows: MeasureRow[],
  order: Order | null
): Order => {
  const normalizedRows = rows.map((row) => ({
    ...row,
    grain: row.grain || selectedGrain,
  }));

  const totalParts = normalizedRows.reduce((sum, row) => sum + (parseInt(row.adet, 10) || 0), 0);

  return {
    id: String(orderId),
    cust: customerName || order?.cust || "Yeni Musteri",
    phone: customerPhone || order?.phone || "",
    mat: order?.mat || "Belirtilmedi",
    plate: plateSize || "2100x2800",
    thick: thickness,
    parts: totalParts,
    status: order?.status || "NEW",
    date: order?.date || new Date().toLocaleString("tr-TR"),
    upd: "az once",
    grp: order?.grp || "GOVDE",
    priority: order?.priority || "normal",
  };
};

export const calculateTotalParts = (rows: MeasureRow[]): number => {
  return rows.reduce((sum, row) => sum + (parseInt(row.adet, 10) || 0), 0);
};

export const calculateEstimatedArea = (rows: MeasureRow[]): string => {
  const totalSquareMm = rows.reduce((sum, row) => {
    const length = parseFloat(row.boy) || 0;
    const width = parseFloat(row.en) || 0;
    const count = parseInt(row.adet, 10) || 0;
    return sum + length * width * count;
  }, 0);

  return (totalSquareMm / 1_000_000).toFixed(2);
};

const escapeCsv = (value: string): string => {
  if (!value) return "";
  const escaped = value.replace(/"/g, '""');
  return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
};

const sanitizeNumber = (value: string): string => {
  if (!value) return "";
  const normalized = value.trim().replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? String(parsed) : "";
};

const sanitizeInteger = (value: string, fallback = "1"): string => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return String(parsed);
};

const parseFlag = (value: string): boolean => {
  if (!value) return false;
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\u0131\u0130]/g, "i")
    .replace(/[\u015f\u015e]/g, "s")
    .replace(/[\u011f\u011e]/g, "g")
    .replace(/[\u00fc\u00dc]/g, "u")
    .replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[\u00e7\u00c7]/g, "c");
  // Dogaclama yok: Hucre doluysa ve negatif bir ifade (0, yok, hayir) icermiyorsa direkt isaretle
  if (
    normalized === "" ||
    normalized === "0" ||
    normalized === "yok" ||
    normalized === "hayir" ||
    normalized === "false" ||
    normalized === "no" ||
    normalized === "n"
  ) {
    return false;
  }
  return true;
};

const normalizeHeader = (header: string): string => {
  return header
    .trim()
    .toLowerCase()
    .replace(/[\u0131\u0130]/g, "i")
    .replace(/[\u015f\u015e]/g, "s")
    .replace(/[\u011f\u011e]/g, "g")
    .replace(/[\u00fc\u00dc]/g, "u")
    .replace(/[\u00f6\u00d6]/g, "o")
    .replace(/[\u00e7\u00c7]/g, "c")
    .replace(/[^a-z0-9]/g, "");
};

const mapHeaderToKey = (normalizedHeader: string): keyof MeasureRow | null => {
  if (["boy", "length", "plength"].includes(normalizedHeader)) return "boy";
  if (["en", "width", "pwidth"].includes(normalizedHeader)) return "en";
  if (["adet", "qty", "quantity", "count", "minq", "pminq"].includes(normalizedHeader)) return "adet";
  if (["grain", "graini", "damar", "pgrain", "pgraini"].includes(normalizedHeader)) return "grain";
  if (["u1", "ust1", "ustkenar1", "upperstripmat", "pedgematup"].includes(normalizedHeader)) return "u1";
  if (["u2", "ust2", "ustkenar2", "lowerstripmat", "pedgematlo", "pegdematlo"].includes(normalizedHeader)) return "u2";
  if (["k1", "kenar1", "altkenar1", "leftstripmat", "pedgematsx"].includes(normalizedHeader)) return "k1";
  if (["k2", "kenar2", "altkenar2", "rightstripmat", "pedgematdx"].includes(normalizedHeader)) return "k2";
  if (["delik1", "delik01", "hole1", "piidesc", "iidescription"].includes(normalizedHeader)) return "delik1";
  if (["delik2", "delik02", "hole2", "pdesc1", "description1"].includes(normalizedHeader)) return "delik2";
  if (["bilgi", "not", "aciklama", "info", "description", "pidesc"].includes(normalizedHeader)) return "info";
  return null;
};

const parseDelimitedLine = (line: string, delimiter: Delimiter): string[] => {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
};

const detectDelimiter = (line: string): Delimiter => {
  const candidates: Delimiter[] = [",", ";", "\t"];
  const counts = candidates.map((delimiter) => ({
    delimiter,
    count: line.split(delimiter).length - 1,
  }));

  counts.sort((a, b) => b.count - a.count);
  return counts[0].delimiter;
};

const mapColumnsToMeasure = (
  columns: string[],
  indexByKey: Partial<Record<keyof MeasureRow, number>>,
  id: number
): MeasureRow => {
  const read = (key: keyof MeasureRow): string => {
    const index = indexByKey[key];
    if (index === undefined || index < 0 || index >= columns.length) return "";
    return columns[index] ?? "";
  };

  return {
    id,
    boy: sanitizeNumber(read("boy")),
    en: sanitizeNumber(read("en")),
    adet: sanitizeInteger(read("adet"), "1"),
    grain: sanitizeInteger(read("grain"), "0"),
    u1: parseFlag(read("u1")),
    u2: parseFlag(read("u2")),
    k1: parseFlag(read("k1")),
    k2: parseFlag(read("k2")),
    delik1: sanitizeNumber(read("delik1")),
    delik2: sanitizeNumber(read("delik2")),
    info: read("info"),
  };
};

const parseHtmlTableImport = (rawText: string): MeasureRow[] => {
  if (typeof DOMParser === "undefined") return [];

  const parser = new DOMParser();
  const html = parser.parseFromString(rawText, "text/html");
  const tableRows = Array.from(html.querySelectorAll("table tr"));
  if (tableRows.length === 0) return [];

  const rowCells = tableRows
    .map((row) => Array.from(row.querySelectorAll("th,td")).map((cell) => (cell.textContent || "").trim()))
    .filter((cells) => cells.some((cell) => cell.length > 0));

  if (rowCells.length === 0) return [];

  const firstRowKeys = rowCells[0].map((cell) => mapHeaderToKey(normalizeHeader(cell)));
  const hasHeader = firstRowKeys.some((key) => key !== null);
  const indexByKey: Partial<Record<keyof MeasureRow, number>> = {};

  if (hasHeader) {
    firstRowKeys.forEach((key, index) => {
      if (key) indexByKey[key] = index;
    });
  } else {
    indexByKey.boy = 0;
    indexByKey.en = 1;
    indexByKey.adet = 2;
    indexByKey.grain = 3;
    indexByKey.u1 = 4;
    indexByKey.u2 = 5;
    indexByKey.k1 = 6;
    indexByKey.k2 = 7;
    indexByKey.delik1 = 8;
    indexByKey.delik2 = 9;
    indexByKey.info = 10;
  }

  const dataRows = hasHeader ? rowCells.slice(1) : rowCells;
  return dataRows
    .map((columns, rowIndex) => mapColumnsToMeasure(columns, indexByKey, rowIndex + 1))
    .filter((row) => row.boy || row.en || row.info);
};

export const buildMeasuresCsv = (rows: MeasureRow[]): string => {
  const lines = [CSV_HEADERS.join(",")];

  rows.forEach((row) => {
    lines.push(
      [
        row.boy,
        row.en,
        row.adet,
        row.grain,
        row.u1 ? "1" : "0",
        row.u2 ? "1" : "0",
        row.k1 ? "1" : "0",
        row.k2 ? "1" : "0",
        row.delik1,
        row.delik2,
        row.info,
      ]
        .map((value) => escapeCsv(String(value ?? "")))
        .join(",")
    );
  });

  return lines.join("\n");
};

export const buildMeasuresExcelHtml = (
  rows: MeasureRow[],
  meta: { customerName: string; customerPhone: string; plateSize: string; thickness: number }
): string => {
  const rowHtml = rows
    .map(
      (row) => `
      <tr>
        <td>${row.id}</td>
        <td>${row.boy}</td>
        <td>${row.en}</td>
        <td>${row.adet}</td>
        <td>${row.grain}</td>
        <td>${row.u1 ? "1" : "0"}</td>
        <td>${row.u2 ? "1" : "0"}</td>
        <td>${row.k1 ? "1" : "0"}</td>
        <td>${row.k2 ? "1" : "0"}</td>
        <td>${row.delik1}</td>
        <td>${row.delik2}</td>
        <td>${row.info}</td>
      </tr>
      `
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; margin: 16px; }
      h1 { margin: 0 0 8px 0; }
      .meta { margin-bottom: 12px; color: #444; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #d1d5db; padding: 6px; text-align: left; }
      th { background: #f3f4f6; }
    </style>
  </head>
  <body>
    <h1>Siparis Olculeri</h1>
    <div class="meta">
      Musteri: ${meta.customerName || "-"} | Telefon: ${meta.customerPhone || "-"} | Plaka: ${meta.plateSize} | Kalinlik: ${meta.thickness} mm
    </div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Boy</th>
          <th>En</th>
          <th>Adet</th>
          <th>Grain</th>
          <th>U1</th>
          <th>U2</th>
          <th>K1</th>
          <th>K2</th>
          <th>Delik-1</th>
          <th>Delik-2</th>
          <th>Bilgi</th>
        </tr>
      </thead>
      <tbody>${rowHtml}</tbody>
    </table>
  </body>
</html>
  `.trim();
};

export const downloadTextFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export const parseImportedMeasures = (rawText: string): ParsedImport => {
  const warnings: string[] = [];
  const text = rawText.replace(/^\uFEFF/, "").trim();

  if (!text) {
    return { rows: [], warnings: ["Dosya bos."] };
  }

  if (text.includes("<table")) {
    const htmlRows = parseHtmlTableImport(text);
    if (htmlRows.length > 0) {
      return { rows: htmlRows, warnings };
    }
    warnings.push("HTML tablo okunamadi. Metin ayristirma denenecek.");
  }

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return { rows: [], warnings: ["Dosyada satir bulunamadi."] };
  }

  const delimiter = detectDelimiter(lines[0]);
  const firstLineColumns = parseDelimitedLine(lines[0], delimiter);
  const firstLineKeys = firstLineColumns.map((column) => mapHeaderToKey(normalizeHeader(column)));
  const hasHeader = firstLineKeys.some((key) => key !== null);
  const indexByKey: Partial<Record<keyof MeasureRow, number>> = {};

  if (hasHeader) {
    firstLineKeys.forEach((key, index) => {
      if (key) indexByKey[key] = index;
    });
  } else {
    indexByKey.boy = 0;
    indexByKey.en = 1;
    indexByKey.adet = 2;
    indexByKey.grain = 3;
    indexByKey.u1 = 4;
    indexByKey.u2 = 5;
    indexByKey.k1 = 6;
    indexByKey.k2 = 7;
    indexByKey.delik1 = 8;
    indexByKey.delik2 = 9;
    indexByKey.info = 10;
  }

  const dataLines = hasHeader ? lines.slice(1) : lines;
  const rows = dataLines
    .map((line) => parseDelimitedLine(line, delimiter))
    .map((columns, rowIndex) => mapColumnsToMeasure(columns, indexByKey, rowIndex + 1))
    .filter((row) => row.boy || row.en || row.info);

  if (rows.length === 0) {
    warnings.push("Gecerli olcu satiri bulunamadi.");
  }

  return { rows, warnings };
};

export const parseImportedArray = (dataRows: any[][]): ParsedImport => {
  const warnings: string[] = [];
  if (!dataRows || dataRows.length === 0) {
    return { rows: [], warnings: ["Dosya icerigi bos."] };
  }

  let thickness: number | undefined;
  let plateSize: string | undefined;
  let material: string | undefined;

  // Header/veri baslangicini bulana kadar tara
  let headerRowIndex = -1;
  let firstDataRowIndex = -1;
  let detectedOffset: 0 | 1 = 0;
  let firstLineKeys: (keyof MeasureRow | null)[] = [];

  for (let i = 0; i < Math.min(100, dataRows.length); i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    const cols = row.map((c) => String(c ?? ""));
    if (!cols.some((c) => c.trim().length > 0)) continue;

    const firstColStr = String(row[0] || "").toUpperCase();

    // Metadata sadece ilk satirlardan okunur
    if (i < 10) {
      if (!thickness) {
        const thickMatch = firstColStr.match(/(\d+)\s*MM/);
        if (thickMatch) {
          thickness = parseInt(thickMatch[1], 10);
        } else {
          const num = parseInt(firstColStr, 10);
          if (!isNaN(num) && num >= 1 && num <= 60) {
            thickness = num;
          }
        }
      }

      if (!plateSize) {
        const plateMatch = firstColStr.match(/(\d+)\s*[*X]\s*(\d+)/);
        if (plateMatch) {
          let w = parseInt(plateMatch[1], 10);
          let h = parseInt(plateMatch[2], 10);
          if (w < 1000) w *= 10;
          if (h < 1000) h *= 10;
          plateSize = `${w}x${h}`;
        }
      }

      if (!material) {
        for (const col of row) {
          const colStr = String(col || "").trim();
          const upper = colStr.toUpperCase();
          if (upper.startsWith("RENK") || upper.startsWith("MALZEME")) {
            const parts = colStr.split(/[:=]/);
            if (parts.length > 1 && parts[1].trim()) {
              material = parts[1].trim();
            } else {
              const colIndex = row.indexOf(col);
              if (colIndex < row.length - 1 && row[colIndex + 1]) {
                material = String(row[colIndex + 1]).trim();
              }
            }
            break;
          }
        }
      }
    }

    if (headerRowIndex === -1) {
      const keys = cols.map((column) => mapHeaderToKey(normalizeHeader(column)));
      if (keys.some((key) => key !== null)) {
        headerRowIndex = i;
        firstLineKeys = keys;
      }
    }

    if (firstDataRowIndex === -1) {
      const hasStandardData =
        cols.length >= 3 &&
        !isNaN(parseFloat(cols[0])) &&
        !isNaN(parseFloat(cols[1])) &&
        !isNaN(parseFloat(cols[2]));
      const hasTemplateOffsetData =
        cols.length >= 4 &&
        !isNaN(parseFloat(cols[1])) &&
        !isNaN(parseFloat(cols[2])) &&
        !isNaN(parseFloat(cols[3]));

      if (hasStandardData || hasTemplateOffsetData) {
        firstDataRowIndex = i;
        detectedOffset = hasTemplateOffsetData && !hasStandardData ? 1 : 0;
      }
    }
  }

  if (headerRowIndex === -1 && firstDataRowIndex === -1) {
    return { rows: [], warnings: ["Dosya icinde veri satiri bulunamadi."] };
  }

  const indexByKey: Partial<Record<keyof MeasureRow, number>> = {};
  let dataStartIndex = 0;

  if (headerRowIndex !== -1) {
    firstLineKeys.forEach((key, index) => {
      if (key && indexByKey[key] === undefined) indexByKey[key] = index;
    });
    dataStartIndex = headerRowIndex + 1;

    if (indexByKey.boy === undefined || indexByKey.en === undefined || indexByKey.adet === undefined) {
      const fallbackRow = firstDataRowIndex === -1 ? [] : dataRows[firstDataRowIndex].map((c) => String(c ?? ""));
      const hasOffsetFallback =
        fallbackRow.length >= 4 &&
        !isNaN(parseFloat(fallbackRow[1] ?? "")) &&
        !isNaN(parseFloat(fallbackRow[2] ?? "")) &&
        !isNaN(parseFloat(fallbackRow[3] ?? ""));

      if (hasOffsetFallback) {
        indexByKey.boy = 1;
        indexByKey.en = 2;
        indexByKey.adet = 3;
        indexByKey.grain = indexByKey.grain ?? 4;
        indexByKey.u1 = indexByKey.u1 ?? 5;
        indexByKey.u2 = indexByKey.u2 ?? 6;
        indexByKey.k1 = indexByKey.k1 ?? 7;
        indexByKey.k2 = indexByKey.k2 ?? 8;
        indexByKey.delik1 = indexByKey.delik1 ?? 9;
        indexByKey.delik2 = indexByKey.delik2 ?? 10;
        indexByKey.info = indexByKey.info ?? 11;
      } else {
        indexByKey.boy = 0;
        indexByKey.en = 1;
        indexByKey.adet = 2;
        indexByKey.grain = indexByKey.grain ?? 3;
        indexByKey.u1 = indexByKey.u1 ?? 4;
        indexByKey.u2 = indexByKey.u2 ?? 5;
        indexByKey.k1 = indexByKey.k1 ?? 6;
        indexByKey.k2 = indexByKey.k2 ?? 7;
        indexByKey.delik1 = indexByKey.delik1 ?? 8;
        indexByKey.delik2 = indexByKey.delik2 ?? 9;
        indexByKey.info = indexByKey.info ?? 10;
      }
    }
  } else {
    dataStartIndex = firstDataRowIndex === -1 ? 0 : firstDataRowIndex;

    if (detectedOffset === 1) {
      indexByKey.boy = 1;
      indexByKey.en = 2;
      indexByKey.adet = 3;
      indexByKey.grain = 4;
      indexByKey.u1 = 5;
      indexByKey.u2 = 6;
      indexByKey.k1 = 7;
      indexByKey.k2 = 8;
      indexByKey.delik1 = 9;
      indexByKey.delik2 = 10;
      indexByKey.info = 11;
    } else {
      indexByKey.boy = 0;
      indexByKey.en = 1;
      indexByKey.adet = 2;
      indexByKey.grain = 3;
      indexByKey.u1 = 4;
      indexByKey.u2 = 5;
      indexByKey.k1 = 6;
      indexByKey.k2 = 7;
      indexByKey.delik1 = 8;
      indexByKey.delik2 = 9;
      indexByKey.info = 10;
    }
  }

  const dataLines = dataRows.slice(dataStartIndex);

  const rows = dataLines
    .filter((row) => row && row.length > 0)
    .map((row) => row.map((c) => String(c ?? "")))
    .map((columns, rowIndex) => mapColumnsToMeasure(columns, indexByKey, rowIndex + 1))
    .filter((row) => row.boy || row.en);

  if (rows.length === 0) {
    warnings.push("Gecerli olcu satiri bulunamadi.");
  }

  return { rows, warnings, meta: { thickness, plateSize, material } };
};

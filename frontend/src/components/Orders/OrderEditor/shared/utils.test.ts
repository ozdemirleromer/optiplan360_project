import { describe, expect, it } from "vitest";
import { parseImportedArray } from "./utils";

describe("parseImportedArray", () => {
  it("parses OptiPlanning template style rows with machine headers", () => {
    const result = parseImportedArray([
      [
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
      ],
      [
        "Material",
        "Length",
        "Width",
        "Min Q.",
        "GrainI",
        "Description",
        "Upper strip mat.",
        "Lower strip mat.",
        "Left strip mat.",
        "Right strip mat.",
        "II Description",
        "Description 1",
      ],
      ["18MM 210*280", 606, 496, 4, "3-Material", "", "1MM", "1MM", "1MM", "1MM", "", ""],
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      boy: "606",
      en: "496",
      adet: "4",
      grain: "3",
      u1: true,
      u2: true,
      k1: true,
      k2: true,
    });
    expect(result.meta?.thickness).toBe(18);
    expect(result.meta?.plateSize).toBe("2100x2800");
  });

  it("parses standard data rows without header from index 0", () => {
    const result = parseImportedArray([
      [500, 300, 2, "1", "1", "", "0", "false", "", "", "raf"],
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      boy: "500",
      en: "300",
      adet: "2",
      grain: "1",
      u1: true,
      u2: false,
      k1: false,
      k2: false,
      info: "raf",
    });
  });

  it("extracts material metadata", () => {
    const result = parseImportedArray([
      ["Renk: Beyaz"],
      ["Boy", "En", "Adet", "Grain"],
      [500, 300, 2, "0"],
    ]);

    expect(result.meta?.material).toBe("Beyaz");
    expect(result.rows).toHaveLength(1);
  });
});

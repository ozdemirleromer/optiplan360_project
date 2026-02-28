import { describe, expect, it } from "vitest";
import type { RulesConfig } from "../../src/config/loadConfig";
import { ERROR_CODES } from "../../src/domain/errors";
import { TransformerService } from "../../src/services/transformerService";

const RULES: RulesConfig = {
  cm_to_mm_multiplier: 10,
  trimByThickness: {
    "18": 10,
    "3": 5,
    "4": 5,
    "5": 5,
    "8": 5,
  },
  backingThicknesses: [3, 4, 5, 8],
  edgeMapping: {
    "Bant Yok": null,
    "040": 0.4,
    "1mm": 1,
    "2mm": 2,
  },
  grainMapping: {
    "0": 0,
    "1": 1,
    "2": 2,
    "3": 3,
  },
  mergePolicy: {
    defaultDisabled: true,
    requiresOperatorApproval: true,
  },
  defaultPlateSize: {
    width_mm: 2100,
    height_mm: 2800,
  },
  retry_count_max: 3,
  retry_backoff_minutes: [1, 3, 9],
  optiModeDefault: "C",
  timeouts: {
    optiXmlMinutes: 20,
    osiAckMinutes: 5,
  },
  ackMode: "file_move",
};

describe("TransformerService", () => {
  it("GOVDE ve ARKALIK partlarini ayri batchlere boler, arkalik edge alanlarini null yapar", () => {
    const service = new TransformerService();
    const result = service.transform(
      [
        {
          id: "g1",
          part_type: "GOVDE",
          material_code: "MAT-01",
          length_cm: 120.5,
          width_cm: 40,
          quantity: 2,
          grain: 1,
          color: "Beyaz",
          thickness_mm: 18,
          edge_up: "1mm",
          edge_lo: "1mm",
          edge_sx: "040",
          edge_dx: "Bant Yok",
        },
        {
          id: "a1",
          part_type: "ARKALIK",
          material_code: "MAT-ARK",
          length_cm: 100,
          width_cm: 60,
          quantity: 1,
          grain: 0,
          color: "Beyaz",
          thickness_mm: 5,
          edge_up: "1mm",
          edge_lo: "040",
          edge_sx: "2mm",
          edge_dx: "1mm",
        },
      ],
      RULES,
      { width_mm: 2100, height_mm: 2800 },
    );

    expect(result.batches).toHaveLength(2);
    expect(result.backing_edge_reset_count).toBe(1);

    const backingRow = result.batches.find((batch) => batch.part_type === "ARKALIK")?.rows[0];
    expect(backingRow?.P_EDGE_MAT_UP).toBeNull();
    expect(backingRow?.P_EGDE_MAT_LO).toBeNull();
    expect(backingRow?.P_EDGE_MAT_SX).toBeNull();
    expect(backingRow?.P_EDGE_MAT_DX).toBeNull();
  });

  it("arkalik kalinligi izinli listede degilse HOLD hatasi firlatir", () => {
    const service = new TransformerService();

    expect(() =>
      service.transform(
        [
          {
            id: "a2",
            part_type: "ARKALIK",
            material_code: "MAT-ARK",
            length_cm: 100,
            width_cm: 60,
            quantity: 1,
            grain: 0,
            color: "Ceviz",
            thickness_mm: 12,
          },
        ],
        RULES,
        { width_mm: 2100, height_mm: 2800 },
      ),
    ).toThrow(ERROR_CODES.E_BACKING_THICKNESS_UNKNOWN);
  });

  it("trim map disi thickness geldiginde hata firlatir", () => {
    const service = new TransformerService();

    expect(() =>
      service.transform(
        [
          {
            id: "g2",
            part_type: "GOVDE",
            material_code: "MAT-01",
            length_cm: 100,
            width_cm: 50,
            quantity: 1,
            grain: 1,
            color: "Antrasit",
            thickness_mm: 16,
          },
        ],
        RULES,
        { width_mm: 2100, height_mm: 2800 },
      ),
    ).toThrow(ERROR_CODES.E_TRIM_RULE_MISSING);
  });
});

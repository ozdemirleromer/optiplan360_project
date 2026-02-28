import { describe, it, expect } from "vitest";
import { toHumanCount, toPercent } from "../useAIOpsData";

describe("toHumanCount", () => {
  it("returns '--' for null", () => {
    expect(toHumanCount(null)).toBe("--");
  });

  it("returns '--' for undefined", () => {
    expect(toHumanCount(undefined)).toBe("--");
  });

  it("formats zero as '0'", () => {
    expect(toHumanCount(0)).toBe("0");
  });

  it("formats a small number without separator", () => {
    expect(toHumanCount(42)).toBe("42");
  });

  it("formats thousands with Turkish locale separator", () => {
    // tr-TR uses '.' as thousands separator
    expect(toHumanCount(1000)).toBe("1.000");
  });

  it("formats large number correctly", () => {
    expect(toHumanCount(1_234_567)).toBe("1.234.567");
  });
});

describe("toPercent", () => {
  it("returns '--' for null", () => {
    expect(toPercent(null)).toBe("--");
  });

  it("returns '--' for undefined", () => {
    expect(toPercent(undefined)).toBe("--");
  });

  it("formats 0 as '0%'", () => {
    expect(toPercent(0)).toBe("0%");
  });

  it("rounds float values", () => {
    expect(toPercent(85.6)).toBe("86%");
    expect(toPercent(85.4)).toBe("85%");
  });

  it("formats 100 as '100%'", () => {
    expect(toPercent(100)).toBe("100%");
  });
});

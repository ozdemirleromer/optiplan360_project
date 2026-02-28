import { beforeEach, describe, expect, it } from "vitest";
import { THEMES } from "./themes";
import { syncRuntimeTheme } from "./themeRuntime";
import { COLORS, getRuntimeTheme, primaryRgba } from "./components/Shared/constants";

describe("themeRuntime", () => {
  beforeEach(() => {
    const root = document.documentElement;
    root.removeAttribute("style");
    root.removeAttribute("data-ui-theme");
  });

  it("applies selected theme values to runtime constants and css variables", () => {
    const target = THEMES.industrialGrid;

    const applied = syncRuntimeTheme("industrialGrid");
    const root = document.documentElement;

    expect(applied.name).toBe("industrialGrid");
    expect(getRuntimeTheme().name).toBe("industrialGrid");

    expect(COLORS.primary.DEFAULT).toBe(target.colors.primary.DEFAULT);
    expect(primaryRgba(0.2)).toBe(`rgba(${target.primaryRgb},0.2)`);

    expect(root.style.getPropertyValue("--primary")).toBe(target.colors.primary.DEFAULT);
    expect(root.style.getPropertyValue("--accent")).toBe(target.colors.accent.DEFAULT);
    expect(root.style.getPropertyValue("--bg-main")).toBe(target.colors.bg.main);
    expect(root.style.getPropertyValue("--radius-lg")).toBe(`${target.design.radius.lg}px`);
    expect(root.style.getPropertyValue("--shadow-glow")).toBe(target.design.shadows.glow);
    expect(root.getAttribute("data-ui-theme")).toBe("industrialGrid");
  });

  it("supports switching themes at runtime without reset", () => {
    syncRuntimeTheme("minimalStudio");
    syncRuntimeTheme("neoCorporate");

    const root = document.documentElement;

    expect(getRuntimeTheme().name).toBe("neoCorporate");
    expect(root.style.getPropertyValue("--primary")).toBe(THEMES.neoCorporate.colors.primary.DEFAULT);
    expect(root.style.getPropertyValue("--text-main")).toBe(THEMES.neoCorporate.colors.text);
    expect(root.getAttribute("data-ui-theme")).toBe("neoCorporate");
  });
});

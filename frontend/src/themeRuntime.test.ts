import { beforeEach, describe, expect, it } from "vitest";
import { THEMES } from "./themes";
import { syncRuntimeTheme } from "./themeRuntime";
import { COLORS, getRuntimeTheme } from "./components/Shared/constants";

describe("themeRuntime", () => {
  beforeEach(() => {
    const root = document.documentElement;
    root.removeAttribute("style");
    root.removeAttribute("data-ui-theme");
  });

  it("applies selected theme values to runtime constants and css variables", () => {
    const target = THEMES.dark;
    const applied = syncRuntimeTheme("dark");
    const root = document.documentElement;

    expect(applied.name).toBe("dark");
    expect(getRuntimeTheme().name).toBe("dark");
    expect(COLORS.primary).toBe(target.colors.primary);
    expect(root.style.getPropertyValue("--primary")).toBe(target.colors.primary);
    expect(root.getAttribute("data-ui-theme")).toBe("dark");
  });

  it("supports switching themes at runtime without reset", () => {
    syncRuntimeTheme("light");
    syncRuntimeTheme("dark");

    const root = document.documentElement;
    expect(getRuntimeTheme().name).toBe("dark");
    expect(root.style.getPropertyValue("--primary")).toBe(THEMES.dark.colors.primary);
    expect(root.getAttribute("data-ui-theme")).toBe("dark");
  });
});




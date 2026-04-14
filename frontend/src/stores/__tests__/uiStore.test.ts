import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../themeRuntime", () => ({ syncRuntimeTheme: vi.fn() }));

import { useUIStore } from "../uiStore";

beforeEach(() => {
  useUIStore.setState({
    theme: "dark",
    themeName: "dark",
    sidebarCollapsed: false,
  });
});

describe("useUIStore", () => {
  it("varsayılan state doğru", () => {
    const state = useUIStore.getState();
    expect(state.theme).toBe("dark");
    expect(state.sidebarCollapsed).toBe(false);
    expect(state.themeName).toBe("dark");
  });

  it("toggleTheme dark→light geçiş yapar", () => {
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("light");
  });

  it("toggleTheme light→dark geçiş yapar", () => {
    useUIStore.setState({ theme: "light" });
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("toggleSidebar false→true yapar", () => {
    useUIStore.getState().toggleSidebar();
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
  });

  it("setSidebarCollapsed doğrudan değer atar", () => {
    useUIStore.getState().setSidebarCollapsed(true);
    expect(useUIStore.getState().sidebarCollapsed).toBe(true);
    useUIStore.getState().setSidebarCollapsed(false);
    expect(useUIStore.getState().sidebarCollapsed).toBe(false);
  });

  it("setThemeName dark çağrısı dark yapar", () => {
    useUIStore.getState().setThemeName("dark");
    expect(useUIStore.getState().themeName).toBe("dark");
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("setThemeName light çağrısı light yapar", () => {
    useUIStore.getState().setThemeName("light");
    expect(useUIStore.getState().themeName).toBe("light");
    expect(useUIStore.getState().theme).toBe("dark");
  });

  it("toggleTheme dark→light themeName değerini değiştirmez", () => {
    useUIStore.getState().toggleTheme();
    expect(useUIStore.getState().theme).toBe("light");
    expect(useUIStore.getState().themeName).toBe("dark");
  });
});

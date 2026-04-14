import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TelemetryFiltersBar } from "./TelemetryFiltersBar";

function styleFactory() {
  return {};
}

describe("TelemetryFiltersBar", () => {
  it("alan değişimlerini callback'e taşır", () => {
    const onKayitUuidChange = vi.fn();
    const onFromLocalChange = vi.fn();
    const onToLocalChange = vi.fn();
    const onLimitChange = vi.fn();
    const onOffsetChange = vi.fn();

    render(
      <TelemetryFiltersBar
        kayitUuid=""
        fromLocal=""
        toLocal=""
        limit=""
        offset=""
        loading={false}
        onKayitUuidChange={onKayitUuidChange}
        onFromLocalChange={onFromLocalChange}
        onToLocalChange={onToLocalChange}
        onLimitChange={onLimitChange}
        onOffsetChange={onOffsetChange}
        onApplyPreset={vi.fn()}
        onClear={vi.fn()}
        onRefresh={vi.fn()}
        fieldStyle={styleFactory}
        labelStyle={styleFactory}
      />, 
    );

    fireEvent.change(screen.getByTestId("telemetry-kayit-uuid-filter"), { target: { value: "wf-42" } });
    fireEvent.change(screen.getByTestId("telemetry-from-filter"), { target: { value: "2026-03-12T09:00" } });
    fireEvent.change(screen.getByTestId("telemetry-to-filter"), { target: { value: "2026-03-12T10:00" } });
    fireEvent.change(screen.getByTestId("telemetry-limit-filter"), { target: { value: "25" } });
    fireEvent.change(screen.getByTestId("telemetry-offset-filter"), { target: { value: "5" } });

    expect(onKayitUuidChange).toHaveBeenCalledWith("wf-42");
    expect(onFromLocalChange).toHaveBeenCalledWith("2026-03-12T09:00");
    expect(onToLocalChange).toHaveBeenCalledWith("2026-03-12T10:00");
    expect(onLimitChange).toHaveBeenCalledWith("25");
    expect(onOffsetChange).toHaveBeenCalledWith("5");
  });

  it("preset ve aksiyon butonlarını tetikler", () => {
    const onApplyPreset = vi.fn();
    const onClear = vi.fn();
    const onRefresh = vi.fn();

    render(
      <TelemetryFiltersBar
        kayitUuid="wf-1"
        fromLocal="2026-03-12T09:00"
        toLocal="2026-03-12T10:00"
        limit="20"
        offset="0"
        loading={false}
        onKayitUuidChange={vi.fn()}
        onFromLocalChange={vi.fn()}
        onToLocalChange={vi.fn()}
        onLimitChange={vi.fn()}
        onOffsetChange={vi.fn()}
        onApplyPreset={onApplyPreset}
        onClear={onClear}
        onRefresh={onRefresh}
        fieldStyle={styleFactory}
        labelStyle={styleFactory}
      />, 
    );

    fireEvent.click(screen.getByRole("button", { name: "Son 1 Saat" }));
    fireEvent.click(screen.getByRole("button", { name: "Filtreleri Temizle" }));
    fireEvent.click(screen.getByRole("button", { name: "Telemetry Yenile" }));

    expect(onApplyPreset).toHaveBeenCalledWith("LAST_1_HOUR");
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("loading durumunda yenile metnini değiştirir", () => {
    render(
      <TelemetryFiltersBar
        kayitUuid=""
        fromLocal=""
        toLocal=""
        limit=""
        offset=""
        loading
        onKayitUuidChange={vi.fn()}
        onFromLocalChange={vi.fn()}
        onToLocalChange={vi.fn()}
        onLimitChange={vi.fn()}
        onOffsetChange={vi.fn()}
        onApplyPreset={vi.fn()}
        onClear={vi.fn()}
        onRefresh={vi.fn()}
        fieldStyle={styleFactory}
        labelStyle={styleFactory}
      />, 
    );

    expect(screen.getByRole("button", { name: "Yükleniyor..." })).toBeDisabled();
    expect(screen.getByTestId("telemetry-paging-helper")).toHaveTextContent("limit=20, offset=0");
    expect(screen.getByTestId("telemetry-kayit-uuid-helper")).toHaveTextContent("2-128 karakter");
  });

  it("limit/offset inputlarında sadece sayısal karakterleri callbacke taşır", () => {
    const onLimitChange = vi.fn();
    const onOffsetChange = vi.fn();

    render(
      <TelemetryFiltersBar
        kayitUuid=""
        fromLocal=""
        toLocal=""
        limit=""
        offset=""
        loading={false}
        onKayitUuidChange={vi.fn()}
        onFromLocalChange={vi.fn()}
        onToLocalChange={vi.fn()}
        onLimitChange={onLimitChange}
        onOffsetChange={onOffsetChange}
        onApplyPreset={vi.fn()}
        onClear={vi.fn()}
        onRefresh={vi.fn()}
        fieldStyle={styleFactory}
        labelStyle={styleFactory}
      />, 
    );

    fireEvent.change(screen.getByTestId("telemetry-limit-filter"), { target: { value: "2a5" } });
    fireEvent.change(screen.getByTestId("telemetry-offset-filter"), { target: { value: "#12" } });

    expect(onLimitChange).toHaveBeenCalledWith("25");
    expect(onOffsetChange).toHaveBeenCalledWith("12");
  });
});

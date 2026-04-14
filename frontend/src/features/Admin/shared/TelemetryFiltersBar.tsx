import type { CSSProperties } from "react";
import { Button } from "../../../components/Shared";
import {
  TELEMETRY_PAGING_DEFAULTS,
  TELEMETRY_PRESET_RANGES,
  type TelemetryPresetRangeId,
} from "./utils";

type TelemetryFiltersBarProps = {
  kayitUuid: string;
  fromLocal: string;
  toLocal: string;
  limit: string;
  offset: string;
  loading: boolean;
  onKayitUuidChange: (value: string) => void;
  onFromLocalChange: (value: string) => void;
  onToLocalChange: (value: string) => void;
  onLimitChange: (value: string) => void;
  onOffsetChange: (value: string) => void;
  onApplyPreset: (presetId: TelemetryPresetRangeId) => void;
  onClear: () => void;
  onRefresh: () => void;
  fieldStyle: () => CSSProperties;
  labelStyle: () => CSSProperties;
};

export function TelemetryFiltersBar({
  kayitUuid,
  fromLocal,
  toLocal,
  limit,
  offset,
  loading,
  onKayitUuidChange,
  onFromLocalChange,
  onToLocalChange,
  onLimitChange,
  onOffsetChange,
  onApplyPreset,
  onClear,
  onRefresh,
  fieldStyle,
  labelStyle,
}: TelemetryFiltersBarProps) {
  return (
    <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {TELEMETRY_PRESET_RANGES.map((preset) => (
          <Button key={preset.id} variant="ghost" size="sm" onClick={() => onApplyPreset(preset.id)} disabled={loading}>
            {preset.label}
          </Button>
        ))}
        <Button variant="secondary" size="sm" onClick={onClear} disabled={loading}>
          Filtreleri Temizle
        </Button>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
          {loading ? "Yükleniyor..." : "Telemetry Yenile"}
        </Button>
      </div>

      <div style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
        <div>
          <label style={labelStyle()}>kayit_uuid (opsiyonel)</label>
          <input
            data-testid="telemetry-kayit-uuid-filter"
            value={kayitUuid}
            onChange={(event) => onKayitUuidChange(event.target.value)}
            style={fieldStyle()}
            placeholder="wf-1 veya d3f4b620-8d1e-4ef8-a705-57f33df8fa0f"
          />
        </div>
        <div>
          <label style={labelStyle()}>from (datetime-local)</label>
          <input
            data-testid="telemetry-from-filter"
            type="datetime-local"
            value={fromLocal}
            onChange={(event) => onFromLocalChange(event.target.value)}
            style={fieldStyle()}
            placeholder="2026-03-12T00:00"
          />
        </div>
        <div>
          <label style={labelStyle()}>to (datetime-local)</label>
          <input
            data-testid="telemetry-to-filter"
            type="datetime-local"
            value={toLocal}
            onChange={(event) => onToLocalChange(event.target.value)}
            style={fieldStyle()}
            placeholder="2026-03-12T23:59"
          />
        </div>
        <div>
          <label style={labelStyle()}>limit (1..200)</label>
          <input
            data-testid="telemetry-limit-filter"
            value={limit}
            onChange={(event) => onLimitChange(event.target.value.replace(/\D+/g, ""))}
            style={fieldStyle()}
            placeholder="20"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={3}
          />
        </div>
        <div>
          <label style={labelStyle()}>offset (≥0)</label>
          <input
            data-testid="telemetry-offset-filter"
            value={offset}
            onChange={(event) => onOffsetChange(event.target.value.replace(/\D+/g, ""))}
            style={fieldStyle()}
            placeholder="0"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
          />
        </div>
      </div>

      <div
        data-testid="telemetry-paging-helper"
        style={{
          color: "var(--text-dim, #71717a)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        Boş değerlerde varsayılanlar kullanılır: limit={TELEMETRY_PAGING_DEFAULTS.limit}, offset={TELEMETRY_PAGING_DEFAULTS.offset}.
      </div>

      <div
        data-testid="telemetry-kayit-uuid-helper"
        style={{
          color: "var(--text-dim, #71717a)",
          fontSize: 12,
          lineHeight: 1.5,
        }}
      >
        kayit_uuid formatı: 2-128 karakter; harf/rakam ve . _ : - karakterleri.
      </div>
    </div>
  );
}

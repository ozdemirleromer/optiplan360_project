/**
 * OrderEditor - Measure Table Tab
 */

import { Button } from "../../Shared/Button";
import { Card } from "../../Shared/Card";
import { COLORS, RADIUS, TYPOGRAPHY, TRANSITIONS } from "../../Shared/constants";
import { type MeasureRow, calculateEstimatedArea, calculateTotalParts } from "./shared";

interface MeasureTableProps {
  rows: MeasureRow[];
  isArk: boolean;
  selectedGrain: string;
  onRowUpdate: (id: number, field: string, value: string | number | boolean) => void;
  onAddRow: () => void;
  onRemoveRow: (id: number) => void;
}

export function MeasureTable({
  rows,
  isArk,
  selectedGrain,
  onRowUpdate,
  onAddRow,
  onRemoveRow,
}: MeasureTableProps) {
  const totalParts = calculateTotalParts(rows);
  const estimatedArea = calculateEstimatedArea(rows);

  const inputStyle: React.CSSProperties = {
    padding: "7px 10px",
    borderRadius: RADIUS.md,
    border: `1px solid ${COLORS.border2}`,
    fontSize: 13,
    outline: "none",
    transition: TRANSITIONS.fast,
    background: "rgba(255,255,255,.04)",
    color: COLORS.text,
  };

  const cbStyle: React.CSSProperties = {
    width: 16,
    height: 16,
    cursor: "pointer",
    accentColor: COLORS.accent[400],
  };

  return (
    <Card>
      {isArk && (
        <div
          style={{
            padding: "10px 16px",
            background: COLORS.info.light,
            fontSize: 13,
            color: COLORS.info.dark,
          }}
        >
          Arkalık grubunda bant alanları kapalıdır (Kural #9)
        </div>
      )}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div style={{ fontSize: 13, color: COLORS.gray[500] }}>
          {rows.length} satır / {totalParts} parça
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={onAddRow}>
            + Satır Ekle
          </Button>
        </div>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                borderBottom: `1px solid ${COLORS.border2}`,
                background: "rgba(255,255,255,.02)",
              }}
            >
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center", width: 40 }}>#</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "left" }}>Boy</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "left" }}>En</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "left" }}>Adet</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center" }}>Desen</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center" }}>U1</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center" }}>U2</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center" }}>K1</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center" }}>K2</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center", width: 90 }}>DELİK-1</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center", width: 90 }}>DELİK-2</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "left" }}>Bilgi</th>
              <th style={{ padding: "10px 8px", fontSize: 11, fontWeight: TYPOGRAPHY.fontWeight.semibold, color: COLORS.gray[400], textAlign: "center", width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r.id}
                style={{
                  borderBottom: `1px solid ${COLORS.border}`,
                  background: idx % 2 === 0 ? "transparent" : "rgba(255,255,255,.02)",
                }}
              >
                <td style={{ padding: "6px 8px", textAlign: "center", fontSize: 12, color: COLORS.gray[400] }}>{r.id}</td>
                <td style={{ padding: "4px 6px" }}>
                  <input
                    type="number"
                    value={r.boy || ""}
                    onChange={(e) => onRowUpdate(r.id, "boy", e.target.value)}
                    style={{ ...inputStyle, width: 80, textAlign: "center" }}
                  />
                </td>
                <td style={{ padding: "4px 6px" }}>
                  <input
                    type="number"
                    value={r.en || ""}
                    onChange={(e) => onRowUpdate(r.id, "en", e.target.value)}
                    style={{ ...inputStyle, width: 80, textAlign: "center" }}
                  />
                </td>
                <td style={{ padding: "4px 6px" }}>
                  <input
                    type="number"
                    value={r.adet || ""}
                    onChange={(e) => onRowUpdate(r.id, "adet", e.target.value)}
                    style={{ ...inputStyle, width: 60, textAlign: "center" }}
                  />
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center" }}>
                  <select
                    value={r.grain || selectedGrain}
                    onChange={(e) => onRowUpdate(r.id, "grain", e.target.value)}
                    style={{ ...inputStyle, width: 60, padding: "5px 2px", textAlign: "center" }}
                  >
                    <option value="0">0</option>
                    <option value="1">1</option>
                    <option value="2">2</option>
                    <option value="3">3</option>
                  </select>
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center" }}>
                  {!isArk ? (
                    <input type="checkbox" checked={!!r.u1} onChange={(e) => onRowUpdate(r.id, "u1", e.target.checked)} style={cbStyle} />
                  ) : (
                    <span style={{ color: COLORS.gray[500] }}>—</span>
                  )}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center" }}>
                  {!isArk ? (
                    <input type="checkbox" checked={!!r.u2} onChange={(e) => onRowUpdate(r.id, "u2", e.target.checked)} style={cbStyle} />
                  ) : (
                    <span style={{ color: COLORS.gray[500] }}>—</span>
                  )}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center" }}>
                  {!isArk ? (
                    <input type="checkbox" checked={!!r.k1} onChange={(e) => onRowUpdate(r.id, "k1", e.target.checked)} style={cbStyle} />
                  ) : (
                    <span style={{ color: COLORS.gray[500] }}>—</span>
                  )}
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center" }}>
                  {!isArk ? (
                    <input type="checkbox" checked={!!r.k2} onChange={(e) => onRowUpdate(r.id, "k2", e.target.checked)} style={cbStyle} />
                  ) : (
                    <span style={{ color: COLORS.gray[500] }}>—</span>
                  )}
                </td>
                <td style={{ padding: "4px 6px" }}>
                  <input
                    type="number"
                    value={r.delik1 || ""}
                    onChange={(e) => onRowUpdate(r.id, "delik1", e.target.value)}
                    style={{ ...inputStyle, width: 80, textAlign: "center" }}
                  />
                </td>
                <td style={{ padding: "4px 6px" }}>
                  <input
                    type="number"
                    value={r.delik2 || ""}
                    onChange={(e) => onRowUpdate(r.id, "delik2", e.target.value)}
                    style={{ ...inputStyle, width: 80, textAlign: "center" }}
                  />
                </td>
                <td style={{ padding: "4px 6px" }}>
                  <input
                    value={r.info || ""}
                    onChange={(e) => onRowUpdate(r.id, "info", e.target.value)}
                    style={{ ...inputStyle, width: "100%" }}
                    placeholder="Parça bilgi"
                  />
                </td>
                <td style={{ padding: "4px 6px", textAlign: "center" }}>
                  <button
                    onClick={() => onRemoveRow(r.id)}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: COLORS.error.DEFAULT,
                      fontSize: 16,
                      lineHeight: 1,
                    }}
                    title="Satırı sil"
                  >
                    ×
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "10px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: `1px solid ${COLORS.border}`, fontSize: 12 }}>
        <div style={{ display: "flex", gap: 20 }}>
          <span style={{ color: COLORS.muted }}>
            Satır: <strong style={{ color: COLORS.text }}>{rows.length}</strong>
          </span>
          <span style={{ color: COLORS.muted }}>
            Parça: <strong style={{ color: COLORS.accent[400] }}>{totalParts}</strong>
          </span>
          <span style={{ color: COLORS.muted }}>
            Tahmini m²: <strong style={{ color: COLORS.primary[500] }}>{estimatedArea}</strong>
          </span>
        </div>
        <span style={{ color: COLORS.gray[400], fontSize: 11 }}>
          Bant payı UI'da hesaplanmaz — tik değerleri gönderilir
        </span>
      </div>
    </Card>
  );
}

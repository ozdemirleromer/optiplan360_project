import type { CSSProperties } from "react";
import { Modal } from "../../../../components/Shared/Modal";
import { Button } from "../../../../components/Shared";
import { COLORS } from "../../../../components/Shared/constants";
import type { OrderEntryItem } from "../shared/types";

interface MergePreviewModalProps {
  open: boolean;
  original: OrderEntryItem[];
  merged: OrderEntryItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

export function MergePreviewModal({
  open,
  original,
  merged,
  onConfirm,
  onCancel,
}: MergePreviewModalProps) {
  const mergedCount = original.length - merged.length;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title="Satır Birleştirme Önizlemesi"
      subtitle={`${original.length} satır → ${merged.length} satır (${mergedCount} birleştirme)`}
      wide
    >
      <div style={{ display: "grid", gap: 16 }}>
        <div style={panelRowStyle}>
          <section style={panelStyle}>
            <div style={panelTitleStyle}>
              Birleştirme Öncesi — {original.length} satır
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Malzeme</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Boy</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>En</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Adet</th>
                  <th style={thStyle}>Bilgi</th>
                </tr>
              </thead>
              <tbody>
                {original.map((item) => (
                  <tr key={item.id} style={trStyle}>
                    <td style={tdStyle}>{item.stok_kod || item.material || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{item.length}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{item.width}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>{item.quantity}</td>
                    <td style={tdStyle}>{item.info || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={panelStyle}>
            <div style={{ ...panelTitleStyle, color: COLORS.success ?? "#059669" }}>
              Birleştirme Sonrası — {merged.length} satır
            </div>
            <table style={tableStyle}>
              <thead>
                <tr>
                  <th style={thStyle}>Malzeme</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Boy</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>En</th>
                  <th style={{ ...thStyle, textAlign: "right" }}>Adet</th>
                  <th style={thStyle}>Bilgi</th>
                </tr>
              </thead>
              <tbody>
                {merged.map((item) => (
                  <tr key={item.id} style={trStyle}>
                    <td style={tdStyle}>{item.stok_kod || item.material || "—"}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{item.length}</td>
                    <td style={{ ...tdStyle, textAlign: "right" }}>{item.width}</td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600, color: COLORS.success ?? "#059669" }}>{item.quantity}</td>
                    <td style={tdStyle}>{item.info || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, paddingTop: 4 }}>
          <Button type="button" variant="ghost" onClick={onCancel}>
            Geri Dön
          </Button>
          <Button type="button" onClick={onConfirm}>
            Onayla ve Export Et
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const panelRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 16,
};

const panelStyle: CSSProperties = {
  border: `1px solid ${COLORS.border}`,
  borderRadius: 8,
  overflow: "hidden",
};

const panelTitleStyle: CSSProperties = {
  padding: "10px 14px",
  fontSize: 13,
  fontWeight: 700,
  color: COLORS.muted,
  borderBottom: `1px solid ${COLORS.border}`,
  background: COLORS.bg.elevated ?? COLORS.bg.main,
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
};

const thStyle: CSSProperties = {
  padding: "8px 12px",
  fontSize: 11,
  fontWeight: 700,
  color: COLORS.muted,
  textAlign: "left",
  borderBottom: `1px solid ${COLORS.border}`,
};

const trStyle: CSSProperties = {
  borderBottom: `1px solid ${COLORS.border}`,
};

const tdStyle: CSSProperties = {
  padding: "8px 12px",
  fontSize: 13,
  color: COLORS.text,
};

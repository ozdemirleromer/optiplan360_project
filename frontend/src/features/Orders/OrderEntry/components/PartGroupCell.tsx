import React from "react";
import { COLORS } from "../../../../components/Shared/constants";

interface PartGroupCellProps {
  cellId: string;
  value?: "GOVDE" | "ARKALIK";
  disabled?: boolean;
  onChange: (value: "GOVDE" | "ARKALIK") => void;
}

export const PartGroupCell: React.FC<PartGroupCellProps> = ({
  cellId,
  value,
  disabled,
  onChange,
}) => {
  return (
    <select
      id={cellId}
      value={value ?? ""}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value as "GOVDE" | "ARKALIK")}
      style={{
        width: "100%",
        height: "100%",
        border: "none",
        background: "transparent",
        color: value ? COLORS.text : COLORS.muted,
        fontSize: 12,
        outline: "none",
        cursor: disabled ? "default" : "pointer",
        padding: "0 4px",
        appearance: "none",
      }}
    >
      <option value="" disabled>Seç...</option>
      <option value="GOVDE">Gövde</option>
      <option value="ARKALIK">Arkalık</option>
    </select>
  );
};

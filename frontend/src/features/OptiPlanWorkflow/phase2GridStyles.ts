import type { CSSProperties } from "react";

type CreatePhase2GridStyleGettersParams = {
  tdStyle: CSSProperties;
  phase2NumericInputBaseStyle: CSSProperties;
  sl700: string;
  colorWarning: string;
  colorWarningLight: string;
  colorSuccess: string;
};

export function createPhase2GridStyleGetters({
  tdStyle,
  phase2NumericInputBaseStyle,
  sl700,
  colorWarning,
  colorWarningLight,
  colorSuccess,
}: CreatePhase2GridStyleGettersParams) {
  const phase2CellStyleCache = new Map<string, CSSProperties>();
  const phase2NumericInputStyleCache = new Map<string, CSSProperties>();
  const phase2ApproveButtonStyleCache = new Map<string, CSSProperties>();
  const phase2ScoreTextStyleCache = new Map<string, CSSProperties>();

  function getPhase2CellStyle(isNumeric: boolean, low: boolean, approved: boolean, scoreColor: string): CSSProperties {
    const key = `${isNumeric ? "n" : "b"}:${low ? 1 : 0}:${approved ? 1 : 0}:${scoreColor}`;
    const cached = phase2CellStyleCache.get(key);
    if (cached) return cached;

    const style: CSSProperties = {
      ...tdStyle,
      background: low && !approved ? `${colorWarning}${colorWarningLight}` : "transparent",
      border: `1px solid ${low && !approved ? scoreColor : "transparent"}`,
      padding: "5px 6px",
      borderLeft: isNumeric
        ? `2px solid ${low && !approved ? scoreColor : `${colorWarning}20`}`
        : `1px solid ${sl700}`,
    };

    phase2CellStyleCache.set(key, style);
    return style;
  }

  function getPhase2NumericInputStyle(low: boolean, approved: boolean, scoreColor: string): CSSProperties {
    const key = `${low ? 1 : 0}:${approved ? 1 : 0}:${scoreColor}`;
    const cached = phase2NumericInputStyleCache.get(key);
    if (cached) return cached;

    const style: CSSProperties = {
      ...phase2NumericInputBaseStyle,
      border: `1px solid ${low && !approved ? scoreColor : sl700}`,
    };

    phase2NumericInputStyleCache.set(key, style);
    return style;
  }

  function getPhase2ApproveButtonStyle(scoreColor: string): CSSProperties {
    const cached = phase2ApproveButtonStyleCache.get(scoreColor);
    if (cached) return cached;

    const style: CSSProperties = {
      padding: "1px 6px",
      borderRadius: 999,
      border: `1px solid ${scoreColor}`,
      background: `${scoreColor}18`,
      color: scoreColor,
      fontSize: 9,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap",
    };

    phase2ApproveButtonStyleCache.set(scoreColor, style);
    return style;
  }

  function getPhase2ScoreTextStyle(approved: boolean, scoreColor: string): CSSProperties {
    const key = `${approved ? 1 : 0}:${scoreColor}`;
    const cached = phase2ScoreTextStyleCache.get(key);
    if (cached) return cached;

    const style: CSSProperties = {
      fontSize: 9,
      fontWeight: 700,
      color: approved ? colorSuccess : scoreColor,
    };

    phase2ScoreTextStyleCache.set(key, style);
    return style;
  }

  return {
    getPhase2CellStyle,
    getPhase2NumericInputStyle,
    getPhase2ApproveButtonStyle,
    getPhase2ScoreTextStyle,
  };
}

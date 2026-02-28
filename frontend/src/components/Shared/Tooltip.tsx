import { useState } from "react";
import { COLORS, RADIUS, SHADOWS, Z_INDEX } from "./constants";

interface TooltipProps {
  text: string;
  children: React.ReactNode;
}

export const Tooltip = ({ text, children }: TooltipProps) => {
  const [show, setShow] = useState(false);

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <span
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "50%",
            transform: "translateX(-50%)",
            padding: "6px 10px",
            borderRadius: RADIUS.md,
            fontSize: 11,
            whiteSpace: "nowrap",
            background: "rgba(9,9,11,.92)",
            border: `1px solid ${COLORS.border2}`,
            color: COLORS.text,
            boxShadow: SHADOWS.md,
            zIndex: Z_INDEX.tooltip,
            animation: "fadeIn .12s ease",
          }}
        >
          {text}
          <span
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              borderLeft: "5px solid transparent",
              borderRight: "5px solid transparent",
              borderTop: "5px solid rgba(9,9,11,.92)",
            }}
          />
        </span>
      )}
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(-50%) translateY(4px);
          }
          to {
            opacity: 1;
            transform: translateX(-50%) translateY(0);
          }
        }
      `}</style>
    </span>
  );
};

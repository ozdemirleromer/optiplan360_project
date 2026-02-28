import { useState } from "react";
import { PriorityBadge } from "../Shared";
import { COLORS, RADIUS, SHADOWS, TYPOGRAPHY } from "../Shared/constants";
import type { Order } from "../../types";
import { getPartCount } from "../../utils/orderParts";

interface KanbanCardProps {
  order: Order;
  onEdit?: (order: Order) => void;
  onDragStart?: (order: Order) => void;
  isDragging?: boolean;
}

export const KanbanCard = ({ order, onEdit, onDragStart, isDragging }: KanbanCardProps) => {
  const [hov, setHov] = useState(false);
  const partCount = getPartCount(order.parts, 0);

  return (
    <div
      draggable
      onDragStart={() => onDragStart?.(order)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => onEdit && onEdit(order)}
      style={{
        padding: 14,
        borderRadius: RADIUS.lg,
        cursor: isDragging ? "grabbing" : "grab",
        background: hov ? "rgba(255,255,255,.06)" : COLORS.surface,
        border: `1px solid ${hov ? COLORS.border2 : COLORS.border}`,
        boxShadow: hov ? SHADOWS.md : SHADOWS.xs,
        transition: "all .15s ease",
        transform: hov ? "translateY(-2px)" : "none",
        opacity: isDragging ? 0.5 : 1,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span
          style={{
            fontFamily: TYPOGRAPHY.fontFamily.mono,
            fontSize: 12,
            fontWeight: TYPOGRAPHY.fontWeight.semibold,
            color: COLORS.primary[500],
          }}
        >
          {order.id}
        </span>
        <PriorityBadge priority={order.priority} />
      </div>
      <div style={{ fontSize: 13, fontWeight: TYPOGRAPHY.fontWeight.medium, color: COLORS.text, marginBottom: 6 }}>{order.cust}</div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, color: COLORS.muted }}>
          {partCount} parÃ§a | {order.thick}mm
        </span>
        <span style={{ fontSize: 10, color: COLORS.gray[400] }}>{order.upd}</span>
      </div>
      {order.mat ? (
        <div
          style={{
            marginTop: 8,
            padding: "4px 8px",
            borderRadius: RADIUS.sm,
            background: "rgba(255,255,255,.03)",
            fontSize: 11,
            color: COLORS.gray[400],
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {order.mat}
        </div>
      ) : null}
    </div>
  );
};




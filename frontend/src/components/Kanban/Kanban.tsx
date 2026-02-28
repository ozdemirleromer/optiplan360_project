import React, { useState } from "react";
import { TopBar } from "../Layout/TopBar";
import { Card } from "../Shared";
import { COLORS, RADIUS, TYPOGRAPHY, primaryRgba } from "../Shared/constants";
import type { Order, OrderStatus } from "../../types";
import { useToast } from "../../contexts/ToastContext";
import { useOrdersStore } from "../../stores/ordersStore";
import { KanbanCard } from "./KanbanCard";
import { useRealtime } from "../../hooks/useRealtime";

interface KanbanProps {
  onEdit?: (order: Order) => void;
}

export const Kanban: React.FC<KanbanProps> = ({ onEdit }) => {
  const orders = useOrdersStore((state) => state.orders);
  const saveOrder = useOrdersStore((state) => state.saveOrder);
  const fetchOrders = useOrdersStore((state) => state.fetchOrders);
  const [draggedOrder, setDraggedOrder] = useState<Order | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const { addToast } = useToast();

  useRealtime((event) => {
    if (event.type === 'STATION_SCAN' || event.type === 'ORDER_UPDATED') {
      fetchOrders();
    }
  });

  const columns = [
    { id: "new", title: "Yeni", status: "NEW" as OrderStatus },
    { id: "production", title: "Uretimde", status: "IN_PRODUCTION" as OrderStatus },
    { id: "ready", title: "Hazir", status: "READY" as OrderStatus },
    { id: "complete", title: "Tamamlandi", status: "DELIVERED" as OrderStatus },
  ];

  const handleDrop = async (event: React.DragEvent, newStatus: OrderStatus) => {
    event.preventDefault();
    setDragOverColumn(null);
    if (!draggedOrder) return;
    if (draggedOrder.status === newStatus) {
      setDraggedOrder(null);
      return;
    }

    const updatedOrder = { ...draggedOrder, status: newStatus };
    const result = await saveOrder(updatedOrder);
    if (result.ok) {
      const label =
        newStatus === "NEW"
          ? "Yeni"
          : newStatus === "IN_PRODUCTION"
            ? "Uretimde"
            : newStatus === "READY"
              ? "Hazir"
              : "Tamamlandi";
      addToast(`Siparis durumu "${label}" olarak guncellendi`, "success");
    } else {
      addToast(`Hata: ${result.message}`, "error");
    }
    setDraggedOrder(null);
  };

  return (
    <div className="electric-page">
      <TopBar
        title="Uretim Akisi"
        subtitle="Siparislerin asama bazli dagilimi"
        breadcrumbs={["Ana Islemler", "Uretim Akisi"]}
      />
      <div className="app-page-container">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
          {columns.map((column) => {
            const columnOrders = orders.filter((order) => order.status === column.status);
            const isOverColumn = dragOverColumn === column.id && draggedOrder?.status !== column.status;
            return (
              <Card
                key={column.id}
                title={`${column.title} (${columnOrders.length})`}
                style={{
                  background: isOverColumn ? primaryRgba(0.15) : undefined,
                  borderColor: isOverColumn ? COLORS.primary[500] : undefined,
                  transition: "all .2s ease",
                }}
              >
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverColumn(column.id);
                  }}
                  onDragLeave={() => setDragOverColumn(null)}
                  onDrop={(e) => void handleDrop(e, column.status)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    minHeight: 120,
                    padding: isOverColumn ? 8 : 0,
                    borderRadius: RADIUS.md,
                    transition: "all .2s ease",
                  }}
                >
                  {columnOrders.map((order) => (
                    <KanbanCard
                      key={order.id}
                      order={order}
                      onEdit={onEdit}
                      onDragStart={setDraggedOrder}
                      isDragging={draggedOrder?.id === order.id}
                    />
                  ))}
                  {columnOrders.length === 0 ? (
                    <div
                      style={{
                        textAlign: "center",
                        padding: "20px 10px",
                        border: `1px dashed ${COLORS.border2}`,
                        borderRadius: RADIUS.md,
                        color: COLORS.muted,
                        fontSize: 12,
                        letterSpacing: ".02em",
                        fontWeight: TYPOGRAPHY.fontWeight.medium,
                      }}
                    >
                      Kayit yok
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

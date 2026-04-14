import { FC, ReactNode } from "react";
import { TopBar } from "../../../components/Layout";
import { ORDER_ROUTE_META } from "../../../components/Layout/orderNavigationContract";
import { OrderEntryScreen } from "../OrderEntry";
import { OptiPlanStrictOrderEntry } from "../OrderOptimization/OptiPlanStrictOrderEntry";
import type { Order } from "../../../types";

interface OrderEditorProps {
  order?: Pick<Order, "id">;
}

/**
 * OrderEditor — Mevcut sipariş veya yeni sipariş akışını render eden container.
 * - Sipariş varsa: OrderEntryScreen (mevcut sipariş düzenleme)
 * - Sipariş yoksa: OptiPlanStrictOrderEntry (yeni sipariş akışı)
 */
export const OrderEditor: FC<OrderEditorProps> = ({ order }) => {
  const isNewOrder = !order;
  const breadcrumbs: string[] = [
    ORDER_ROUTE_META.orderList.title,
    isNewOrder ? ORDER_ROUTE_META.newOrder.title : ORDER_ROUTE_META.orderForm.title,
  ];

  const content: ReactNode = isNewOrder ? (
    <OptiPlanStrictOrderEntry />
  ) : (
    <OrderEntryScreen orderId={order.id} />
  );

  return (
    <div>
      <TopBar
        title={isNewOrder ? ORDER_ROUTE_META.newOrder.title : ORDER_ROUTE_META.orderForm.title}
        subtitle=""
        breadcrumbs={breadcrumbs}
      />
      {content}
    </div>
  );
};

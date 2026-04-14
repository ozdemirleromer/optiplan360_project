import { FC } from "react";

interface OrderEntryScreenProps {
  orderId: string;
}

export const OrderEntryScreen: FC<OrderEntryScreenProps> = ({ orderId }) => {
  return (
    <div style={{ padding: "1rem" }}>
      <p>Sipariş düzenleme ekranı — ID: {orderId}</p>
    </div>
  );
};

import type { CSSProperties } from "react";
import { AccountsWorkspace } from "../CRM/AccountsWorkspace";
import { ORDER_ROUTE_META } from "../../components/Layout/orderNavigationContract";

const styles: Record<string, CSSProperties> = {
  page: { display: "flex", flexDirection: "column", height: "100vh", background: "#0f172a", color: "#f1f5f9" },
  header: { padding: "16px 24px", borderBottom: "1px solid #334155" },
  title: { margin: 0, fontSize: "18px", fontWeight: 600, color: "#f1f5f9" },
  info: { padding: "12px 24px", background: "#1e293b", borderBottom: "1px solid #334155", fontSize: "12px", color: "#94a3b8" },
  body: { flex: 1, overflow: "hidden" },
};

export default function CariKartiPage() {
  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <h1 style={styles.title}>{ORDER_ROUTE_META.customerCard.title}</h1>
      </div>
      <div style={styles.info}>
        <span>Adres Modeli</span>
        {" · "}
        <span>Yetkili Sahipligi</span>
        {" · "}
        <span>Coklu adres ile sevk-fatura ayrimi analizde child model olarak acik</span>
      </div>
      <div style={styles.body}>
        <AccountsWorkspace />
      </div>
    </div>
  );
}

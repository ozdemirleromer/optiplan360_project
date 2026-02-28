import { useMemo, useState, useCallback, useEffect } from "react";
import { Plus } from "lucide-react";
import { TopBar } from "../Layout/TopBar";
import { Badge, Button, Card } from "../Shared";
import { DataTable, TableColumn } from "../Shared/DataTable";
import { PriorityBadge } from "../Shared/PriorityBadge";
import { COLORS, RADIUS, TYPOGRAPHY } from "../Shared/constants";
import { useToast } from "../../contexts/ToastContext";
import { useOrdersStore } from "../../stores/ordersStore";
import { ordersService } from "../../services/ordersService";
import type { Order, OrderStatus } from "../../types";
import { getPartCount } from "../../utils/orderParts";

interface OrdersProps {
  onEdit: (order: Order | null) => void;
}

export function Orders({ onEdit }: OrdersProps) {
  const { addToast } = useToast();
  const { orders, saveOrder, fetchOrders, initialized } = useOrdersStore();

  useEffect(() => {
    if (!initialized) {
      fetchOrders();
    }
  }, [initialized, fetchOrders]);

  const [filter, setFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<keyof Order>("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedRows, setSelectedRows] = useState<Set<string | number>>(new Set());
  const [bulkStatus] = useState<"ALL" | "NEW" | "IN_PRODUCTION" | "READY" | "HOLD">("ALL");

  const filteredOrders = useMemo(
    () => orders.filter((o) => filter === "ALL" || o.status === filter),
    [orders, filter]
  );

  const filters = [
    { key: "ALL", label: "Tümü", count: orders.length },
    { key: "NEW", label: "Yeni", count: orders.filter((o) => o.status === "NEW").length },
    { key: "IN_PRODUCTION", label: "Üretimde", count: orders.filter((o) => o.status === "IN_PRODUCTION").length },
    { key: "READY", label: "Hazır", count: orders.filter((o) => o.status === "READY").length },
    { key: "DELIVERED", label: "Teslim", count: orders.filter((o) => o.status === "DELIVERED").length },
    { key: "DONE", label: "Tamamlanan", count: orders.filter((o) => o.status === "DONE").length },
    { key: "HOLD", label: "Bekletme", count: orders.filter((o) => o.status === "HOLD").length },
    { key: "CANCELLED", label: "İptal", count: orders.filter((o) => o.status === "CANCELLED").length },
  ];

  const handleSort = (key: keyof Order | string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key as keyof Order);
    setSortDir("desc");
  };

  const handleBulkStatusUpdate = useCallback(async (newStatus: string) => {
    if (selectedRows.size === 0) return;

    const selectedOrders = orders.filter((o) => selectedRows.has(o.id));
    let successCount = 0;

    for (const order of selectedOrders) {
      const result = await saveOrder({ ...order, status: newStatus as OrderStatus });
      if (result.ok) successCount++;
    }

    addToast(`${successCount}/${selectedRows.size} sipariş başarıyla güncellendi`, successCount === selectedRows.size ? "success" : "warning");
    setSelectedRows(new Set());
  }, [selectedRows, orders, saveOrder, addToast]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedRows.size === 0) return;
    if (!confirm(`${selectedRows.size} sipariş silmek istediğinizden emin misiniz?`)) return;

    let successCount = 0;
    for (const id of selectedRows) {
      try {
        await ordersService.remove(String(id));
        successCount++;
      } catch { /* bireysel hata sessizce geçilir */ }
    }

    if (successCount > 0) {
      addToast(`${successCount}/${selectedRows.size} sipariş silindi`, successCount === selectedRows.size ? "success" : "warning");
      setSelectedRows(new Set());
      void fetchOrders();
    } else {
      addToast("Siparişler silinemedi (sadece NEW durumundaki siparişler silinebilir)", "error");
    }
  }, [selectedRows, addToast, fetchOrders]);

  const columns: TableColumn<Order>[] = [
    {
      key: "id",
      label: "Sipariş No",
      sortable: true,
      render: (_val, row) => (
        <span style={{ color: COLORS.primary[500], fontFamily: TYPOGRAPHY.fontFamily.mono }}>{row.orderNo || row.id}</span>
      ),
    },
    {
      key: "cust",
      label: "Müşteri",
      sortable: true,
      render: (_val, row) => (
        <div>
          <div style={{ fontSize: 13 }}>{row.cust}</div>
          <div style={{ fontSize: 11, color: COLORS.gray[400] }}>{row.phone}</div>
        </div>
      ),
    },
    {
      key: "mat",
      label: "Malzeme",
      render: (_val, row) => <span style={{ color: COLORS.muted, fontSize: 13 }}>{row.mat}</span>,
    },
    {
      key: "thick",
      label: "Kalınlık",
      sortable: true,
      render: (_val, row) => <span style={{ color: COLORS.muted, fontSize: 13 }}>{row.thick}mm</span>,
    },
    {
      key: "parts",
      label: "Parça",
      sortable: true,
      render: (_val, row) => (
        <span style={{ fontWeight: TYPOGRAPHY.fontWeight.bold, color: COLORS.accent[400] }}>{getPartCount(row.parts, 0)}</span>
      ),
    },
    {
      key: "priority",
      label: "Öncelik",
      render: (_val, row) => <PriorityBadge priority={row.priority} />,
    },
    {
      key: "status",
      label: "Durum",
      sortable: true,
      render: (_val, row) => <Badge status={row.status} />,
    },
    {
      key: "date",
      label: "Tarih",
      sortable: true,
      render: (_val, row) => <span style={{ color: COLORS.gray[400], fontSize: 12 }}>{row.date}</span>,
    },
  ];

  return (
    <div className="electric-page">
      <TopBar title="Siparişler" subtitle={`${orders.length} aktif sipariş`} breadcrumbs={["Ana İşlemler", "Siparişler"]}>
        <Button variant="primary" icon={<Plus size={16} aria-hidden="true" />} onClick={() => onEdit(null)}>
          Yeni Sipariş
        </Button>
      </TopBar>

      <div className="app-page-container">
        <div style={{ display: "flex", gap: "2px", marginBottom: "24px", borderBottom: `1px solid ${COLORS.border}`, flexWrap: "wrap" }}>
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "12px 24px",
                fontSize: 14,
                fontWeight: filter === f.key ? 700 : 400,
                color: filter === f.key ? COLORS.primary.DEFAULT : COLORS.muted,
                background: filter === f.key ? `${COLORS.primary.DEFAULT}08` : "transparent",
                border: "none",
                borderBottom: filter === f.key ? `3px solid ${COLORS.primary.DEFAULT}` : "3px solid transparent",
                cursor: "pointer",
                fontFamily: TYPOGRAPHY.fontFamily.base,
                marginBottom: "-1px",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>

        {selectedRows.size > 0 && (
          <Card
            style={{
              marginBottom: 16,
              background: "linear-gradient(135deg, rgba(var(--primary-rgb), 0.16), rgba(124,58,237,0.14))",
              borderColor: "rgba(var(--primary-rgb), 0.45)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {selectedRows.size} sipariş seçildi
              </span>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={bulkStatus}
                  onChange={(e) => handleBulkStatusUpdate(e.target.value)}
                  style={{ padding: "6px 8px", fontSize: 12, borderRadius: RADIUS.md, border: `1px solid ${COLORS.border}`, background: COLORS.surface }}
                >
                  <option value="NEW">Durumu değiştir: Yeni</option>
                  <option value="IN_PRODUCTION">Durumu değiştir: Üretimde</option>
                  <option value="READY">Durumu değiştir: Hazır</option>
                  <option value="DELIVERED">Durumu değiştir: Teslim</option>
                  <option value="DONE">Durumu değiştir: Tamamlandı</option>
                  <option value="HOLD">Durumu değiştir: Bekletme</option>
                  <option value="CANCELLED">Durumu değiştir: İptal</option>
                </select>
                <Button size="sm" variant="secondary" onClick={() => setSelectedRows(new Set())}>Seçimi Temizle</Button>
                <Button size="sm" variant="danger" onClick={handleBulkDelete} disabled={selectedRows.size === 0}>Sil ({selectedRows.size})</Button>
              </div>
            </div>
          </Card>
        )}

        <Card title="Sipariş Listesi" subtitle={`${filteredOrders.length} kayıt`}>
          <DataTable
            columns={columns}
            data={filteredOrders}
            searchable
            searchKeys={["id", "cust", "phone", "mat"]}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            paginated
            pageSize={20}
            emptyMessage="Kayıt bulunamadı."
            onRowClick={onEdit}
            selectable
            selectedRows={selectedRows}
            onSelectRows={setSelectedRows}
            actions={[
              {
                label: "Düzenle",
                variant: "ghost",
                onClick: (row) => onEdit(row),
              },
              {
                label: "XLSX Indir",
                variant: "secondary",
                onClick: async (row) => {
                  try {
                    const result = await ordersService.exportOpti(row.id);
                    if (result.files.length > 0) {
                      const filenames: string[] = [];
                      result.files.forEach((f) => {
                        filenames.push(f.filename);
                        const url = ordersService.getExportDownloadUrl(f.filename);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = f.filename;
                        document.body.appendChild(a);
                        a.click();
                        document.body.removeChild(a);
                      });
                      addToast(
                        `OptiPlanning XLSX olusturuldu: ${filenames.join(", ")}`,
                        "success"
                      );
                    } else {
                      addToast("XLSX dosyasi olusturulamadi — siparis parcalari eksik olabilir", "error");
                    }
                  } catch {
                    addToast("XLSX export sirasinda hata olustu", "error");
                  }
                },
              },
              {
                label: "Sil",
                variant: "danger",
                onClick: async (row) => {
                  if (!confirm(`"${row.cust || row.id}" siparişini silmek istediğinizden emin misiniz?`)) return;
                  try {
                    await ordersService.remove(row.id);
                    addToast("Sipariş silindi", "success");
                    void fetchOrders();
                  } catch {
                    addToast("Sipariş silinemedi (sadece NEW durumundaki siparişler silinebilir)", "error");
                  }
                },
              },
            ]}
          />
        </Card>
      </div>
    </div>
  );
}

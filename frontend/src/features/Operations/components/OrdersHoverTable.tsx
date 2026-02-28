import { Edit2, Trash2 } from "lucide-react";

export interface MissionOrderRow {
  id: string;
  name: string;
  station: string;
  status: "confirmed" | "processing" | "queued" | "blocked";
  eta: string;
}

interface OrdersHoverTableProps {
  rows: MissionOrderRow[];
}

function getStatusLabel(status: MissionOrderRow["status"]): string {
  switch (status) {
    case "confirmed":
      return "Onaylandı";
    case "processing":
      return "Hazırlanıyor";
    case "queued":
      return "Kuyrukta";
    default:
      return "Beklemede";
  }
}

export function OrdersHoverTable({ rows }: OrdersHoverTableProps) {
  return (
    <div className="ai-ops-orders-table-wrap">
      <table className="ai-ops-orders-table" role="table" aria-label="Sipariş listesi">
        <thead>
          <tr>
            <th>Sipariş</th>
            <th>İstasyon</th>
            <th>Durum</th>
            <th>Tahmini Süre</th>
            <th aria-label="Aksiyonlar" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} tabIndex={0}>
              <td>
                <strong>{row.id}</strong>
                <span>{row.name}</span>
              </td>
              <td>{row.station}</td>
              <td>
                <span className={`ai-ops-status-pill ai-ops-status-${row.status}`}>
                  {getStatusLabel(row.status)}
                </span>
              </td>
              <td>{row.eta}</td>
              <td>
                <div className="ai-ops-order-actions">
                  <button type="button" aria-label={`${row.id} düzenle`}>
                    <Edit2 size={13} aria-hidden="true" />
                  </button>
                  <button type="button" aria-label={`${row.id} sil`}>
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


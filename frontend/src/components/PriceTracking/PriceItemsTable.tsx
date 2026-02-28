import { useMemo, useState } from "react";
import type { PriceItem } from "../../types";
import { Card, COLORS } from "../Shared";

interface PriceItemsTableProps {
  items: PriceItem[];
  loading: boolean;
}

function formatNumber(value: number | null, currency?: string): string {
  if (value === null || Number.isNaN(value)) return "-";
  return new Intl.NumberFormat("tr-TR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value) + (currency ? ` ${currency}` : "");
}

export function PriceItemsTable({ items, loading }: PriceItemsTableProps) {
  const [query, setQuery] = useState("");
  const [currency, setCurrency] = useState<string>("ALL");

  const currencies = useMemo(() => {
    const set = new Set(items.map((item) => item.paraBirimi).filter(Boolean));
    return ["ALL", ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((item) => {
      if (currency !== "ALL" && item.paraBirimi !== currency) return false;
      if (!q) return true;
      return (
        (item.urunAdi || "").toLowerCase().includes(q) ||
        (item.urunKodu || "").toLowerCase().includes(q) ||
        (item.kategori || "").toLowerCase().includes(q) ||
        (item.marka || "").toLowerCase().includes(q)
      );
    });
  }, [items, query, currency]);

  const hasValue = useMemo(() => {
    return (key: keyof PriceItem) => {
      return items.some((item) => {
        const val = item[key];
        return val !== null && val !== undefined && val !== "" && val !== 0; // 0'i bos kabul etme karari (opsiyonel)
      });
    };
  }, [items]);

  return (
    <Card
      title="Urunler"
      subtitle={`${filtered.length} / ${items.length} satir`}
      actions={
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Urun, kod, kategori ara"
            style={{ width: 220 }}
            aria-label="Urun arama"
          />
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            aria-label="Para birimi filtre"
          >
            {currencies.map((opt) => (
              <option key={opt} value={opt}>
                {opt === "ALL" ? "Tum PB" : opt}
              </option>
            ))}
          </select>
        </div>
      }
    >
      <div style={{ overflowX: "auto" }}>
        <table style={{ minWidth: 980 }}>
          <thead>
            <tr>
              {/* Dinamik sütunlar — Veri varsa göster */}
              <th>Kod</th>
              <th>Urun Adi</th>
              {hasValue("boyut") && <th>Boyut</th>}
              {hasValue("renk") && <th>Renk</th>}
              <th>Birim</th>
              {hasValue("listeFiyati") && <th>Liste</th>}
              {hasValue("iskontoOrani") && <th>Iskonto</th>}
              {hasValue("netFiyat") && <th>Net</th>}
              {hasValue("kdvOrani") && <th>KDV</th>}
              {hasValue("kdvDahilFiyat") && <th>KDV Dahil</th>}
              {hasValue("kategori") && <th>Kategori</th>}
              {hasValue("marka") && <th>Marka</th>}
              <th>Tedarikci</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", color: COLORS.muted, padding: 20 }}>
                  Urunler yukleniyor...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ textAlign: "center", color: COLORS.muted, padding: 20 }}>
                  Gosterilecek urun bulunamadi.
                </td>
              </tr>
            ) : (
              filtered.map((item) => (
                <tr key={item.id}>
                  <td>{item.urunKodu || "-"}</td>
                  <td>{item.urunAdi}</td>
                  {hasValue("boyut") && <td>{item.boyut || "-"}</td>}
                  {hasValue("renk") && <td>{item.renk || "-"}</td>}
                  <td>{item.birim}</td>
                  {hasValue("listeFiyati") && <td>{formatNumber(item.listeFiyati, item.paraBirimi)}</td>}
                  {hasValue("iskontoOrani") && <td>{formatNumber(item.iskontoOrani, "%")}</td>}
                  {hasValue("netFiyat") && <td>{formatNumber(item.netFiyat, item.paraBirimi)}</td>}
                  {hasValue("kdvOrani") && <td>{formatNumber(item.kdvOrani, "%")}</td>}
                  {hasValue("kdvDahilFiyat") && <td>{formatNumber(item.kdvDahilFiyat, item.paraBirimi)}</td>}
                  {hasValue("kategori") && <td>{item.kategori || "-"}</td>}
                  {hasValue("marka") && <td>{item.marka || "-"}</td>}
                  <td>{item.tedarikci}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

export default PriceItemsTable;

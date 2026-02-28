import { useEffect, useState } from "react";
import "../styles/public-tracking.css";
import { getApiBaseUrl } from "../services/apiClient";

interface PublicOrder {
  ts_code: string;
  customer_snapshot: string;
  status: string;
  thickness_mm: number;
  color: string;
  material_name: string;
  total_parts: number;
  created_at: string;
}

const statusMap: Record<string, { label: string; step: number }> = {
  NEW: { label: "Siparis Alindi", step: 1 },
  PREPARED: { label: "Uretime Hazirlaniyor", step: 2 },
  OPTI_RUNNING: { label: "Optimizasyonda", step: 3 },
  IN_PRODUCTION: { label: "Uretimde", step: 4 },
  WAITING_ASSEMBLY: { label: "Montaj Bekliyor", step: 5 },
  READY: { label: "Teslimata Hazir", step: 6 },
  DELIVERED: { label: "Teslim Edildi", step: 7 },
  CANCELLED: { label: "Iptal Edildi", step: -1 },
};

export default function PublicOrderTracking({ token }: { token: string }) {
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchOrder = async () => {
      try {
        const res = await fetch(`${getApiBaseUrl()}/public/track/${token}`);
        if (!res.ok) {
          throw new Error("Siparis bulunamadi veya gecersiz takip kodu.");
        }
        const data = await res.json();
        setOrder(data);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchOrder();
  }, [token]);

  if (loading) {
    return (
      <div className="public-tracking-container loading">
        <div className="spinner"></div>
        <p>Siparis durumu sorgulaniyor...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="public-tracking-container error">
        <h2>OptiPlan360 - Siparis Takip</h2>
        <div className="error-box">
          <p>{error || "Bilinmeyen bir hata olustu"}</p>
        </div>
      </div>
    );
  }

  const currentStepInfo = statusMap[order.status] || { label: order.status, step: 0 };
  const currentStep = currentStepInfo.step;
  const totalSteps = 7;

  return (
    <div className="public-tracking-container">
      <div className="tracking-card">
        <div className="tracking-header">
          <h2>OptiPlan360 - Siparis Takip</h2>
          <p className="order-code">{order.ts_code}</p>
        </div>

        <div className="customer-info">
          <p>
            <strong>Musteri:</strong> {order.customer_snapshot}
          </p>
          <p>
            <strong>Tarih:</strong> {new Date(order.created_at).toLocaleDateString("tr-TR")}
          </p>
        </div>

        <div className="order-details">
          <div className="detail-item">
            <span>Malzeme</span>
            <strong>
              {order.material_name} ({order.thickness_mm}mm)
            </strong>
          </div>
          <div className="detail-item">
            <span>Renk</span>
            <strong>{order.color}</strong>
          </div>
          <div className="detail-item">
            <span>Parca Sayisi</span>
            <strong>{order.total_parts} adet</strong>
          </div>
        </div>

        <div className="progress-container">
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{
                width: `${currentStep > 0 ? (currentStep / totalSteps) * 100 : 0}%`,
                backgroundColor: currentStep === -1 ? "red" : "",
              }}
            ></div>
          </div>
          <div className="progress-status">
            Durum: <strong>{currentStepInfo.label}</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

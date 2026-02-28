import logging

from app.models import Order, Station
from sqlalchemy import func
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

# İstasyonların ortalama saatlik parça işleme kapasiteleri (Mock veriler)
STATION_CAPACITIES = {
    "HAZIRLIK": 150,
    "EBATLAMA": 120,
    "BANTLAMA": 80,  # Genelde mobilya sektöründeki darboğaz
    "KONTROL": 200,
    "TESLIM": 100,
}


def analyze_bottlenecks(db: Session) -> dict:
    """
    Sistemdeki sipariş yükünü ve istasyonların durumunu analiz ederek
    AI destekli darboğaz tahminleri, olasılıklar ve kapasite planı üretir.
    Faz 2 - Madde 1 (Predictive AI Engine).
    """
    try:
        active_orders = (
            db.query(func.count(Order.id))
            .filter(Order.status.in_(["NEW", "IN_PRODUCTION"]))
            .scalar()
            or 0
        )
        ready_orders = db.query(func.count(Order.id)).filter(Order.status == "READY").scalar() or 0

        active_stations = (
            db.query(func.count(Station.id)).filter(Station.active == True).scalar() or 0
        )
        total_stations = db.query(func.count(Station.id)).scalar() or 0
        inactive_stations = total_stations - active_stations

        # Basit AI/Kural Tabanlı Analiz Modeli:
        # Eğer aktif sipariş sayısı, saatlik toplam kapasiteyi büyük oranda aşıyorsa YÜKSEK RİSK
        average_capacity = (
            sum(STATION_CAPACITIES.values()) / len(STATION_CAPACITIES)
            if STATION_CAPACITIES
            else 100
        )
        # varsayım: 1 order = 5 parça
        current_load_ratio = (active_orders * 5) / (average_capacity * max(active_stations, 1))

        probability_insights = []

        if current_load_ratio > 1.4:
            probability_insights.append(
                {
                    "label": "Bantlama İstasyonunda Darboğaz",
                    "probability": f"{min(98, int(current_load_ratio * 30))}%",
                    "impact": "Yüksek",
                    "action": "Bantlama hızını artır veya ek personel kaydır",
                }
            )
        else:
            probability_insights.append(
                {
                    "label": "Gün içi kapasite durumu",
                    "probability": f"{min(80, int(current_load_ratio * 15))}%",
                    "impact": "Orta" if current_load_ratio > 0.8 else "Düşük",
                    "action": "Normal operasyon seyrinde devam",
                }
            )

        if inactive_stations > 0:
            probability_insights.append(
                {
                    "label": "Kritik makine arıza/yavaşlama riski",
                    "probability": f"{min(90, inactive_stations * 35)}%",
                    "impact": "Kritik",
                    "action": f"{inactive_stations} istasyon kapalı, derhal bakım talep edin!",
                }
            )

        # SLA (Teslimat) Gecikmesi tahmini
        sla_risk = 20 + int(active_orders / max(ready_orders, 1) * 12)
        probability_insights.append(
            {
                "label": "SLA hedeflerinde sapma olasılığı",
                "probability": f"{min(85, sla_risk)}%",
                "impact": "Yüksek" if sla_risk > 50 else "Düşük",
                "action": "VIP/Acil siparişleri öne al" if sla_risk > 50 else "Rutin izleme",
            }
        )

        # Kapasite Planlaması Üretimi
        avg_demand = int(active_orders / 4) + 2
        capacity_plan = [
            {
                "slot": "08:00-12:00",
                "demand": avg_demand,
                "capacity": active_stations * 10,
                "utilization": f"{min(140, int((avg_demand / max(active_stations*10, 1))*100))}%",
                "risk": "Yüksek" if avg_demand > active_stations * 8 else "Düşük",
            },
            {
                "slot": "12:00-16:00",
                "demand": avg_demand + 4,
                "capacity": active_stations * 10,
                "utilization": f"{min(140, int(((avg_demand+4) / max(active_stations*10, 1))*100))}%",
                "risk": "Çok Yüksek" if avg_demand + 4 > active_stations * 9 else "Orta",
            },
        ]

        overview_facts = [
            {"label": "Sistemdeki Sipariş Yükü", "value": f"{active_orders} Aktif"},
            {"label": "Tahmini Çıkış Beklentisi", "value": f"{int(active_orders * 0.75)} Adet"},
            {"label": "Olası Darboğaz", "value": "BANTLAMA" if current_load_ratio > 1.1 else "YOK"},
            {
                "label": "Yapay Zeka Yük Durumu",
                "value": "AŞIRI YÜKLÜ" if current_load_ratio > 1.4 else "OPTİMAL",
            },
        ]

        return {
            "probability_insights": probability_insights,
            "capacity_plan": capacity_plan,
            "overview_facts": overview_facts,
        }

    except Exception as e:
        logger.error(f"AI Analiz Hatası: {e}")
        return {"probability_insights": [], "capacity_plan": [], "overview_facts": []}

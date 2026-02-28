"""
OptiPlan 360 - Export Service
Excel ve PDF export fonksiyonları
"""

import csv
import io
from datetime import datetime
from typing import Any, Dict, List

from app.exceptions import BusinessRuleError


class ExportService:
    """Veri export servisi"""

    @staticmethod
    def export_to_csv(data: List[Dict[str, Any]], filename: str = "export") -> tuple:
        """Veriyi CSV olarak export et"""
        if not data:
            raise BusinessRuleError("Export edilecek veri yok")

        output = io.StringIO()
        writer = csv.DictWriter(output, fieldnames=data[0].keys())
        writer.writeheader()
        writer.writerows(data)

        output.seek(0)
        return output.getvalue(), f"{filename}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"

    @staticmethod
    def export_orders_to_excel_format(orders: List[Any]) -> List[Dict]:
        """Siparişleri Excel formatına dönüştür"""
        return [
            {
                "Sipariş No": order.id,
                "Müşteri": order.customer.name if hasattr(order, "customer") else "",
                "Durum": order.status,
                "Tarih": (
                    order.created_at.strftime("%d.%m.%Y") if hasattr(order, "created_at") else ""
                ),
                "Teslim Tarihi": (
                    order.delivery_date.strftime("%d.%m.%Y")
                    if hasattr(order, "delivery_date") and order.delivery_date
                    else ""
                ),
                "Toplam Tutar": order.total_amount if hasattr(order, "total_amount") else 0,
                "Açıklama": order.description if hasattr(order, "description") else "",
            }
            for order in orders
        ]

    @staticmethod
    def export_customers_to_excel_format(customers: List[Any]) -> List[Dict]:
        """Müşterileri Excel formatına dönüştür"""
        return [
            {
                "ID": customer.id,
                "İsim": customer.name,
                "Email": customer.email if hasattr(customer, "email") else "",
                "Telefon": customer.phone if hasattr(customer, "phone") else "",
                "Adres": customer.address if hasattr(customer, "address") else "",
                "Vergi No": customer.tax_id if hasattr(customer, "tax_id") else "",
                "Kayıt Tarihi": (
                    customer.created_at.strftime("%d.%m.%Y")
                    if hasattr(customer, "created_at")
                    else ""
                ),
            }
            for customer in customers
        ]

    @staticmethod
    def export_invoices_to_excel_format(invoices: List[Any]) -> List[Dict]:
        """Faturaları Excel formatına dönüştür"""
        return [
            {
                "Fatura No": invoice.id,
                "Müşteri": invoice.customer.name if hasattr(invoice, "customer") else "",
                "Tutar": invoice.amount,
                "Para Birimi": invoice.currency if hasattr(invoice, "currency") else "TRY",
                "Durum": invoice.status,
                "Fatura Tarihi": (
                    invoice.invoice_date.strftime("%d.%m.%Y")
                    if hasattr(invoice, "invoice_date")
                    else ""
                ),
                "Son Ödeme": (
                    invoice.due_date.strftime("%d.%m.%Y") if hasattr(invoice, "due_date") else ""
                ),
            }
            for invoice in invoices
        ]


# Singleton instance
export_service = ExportService()

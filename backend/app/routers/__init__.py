"""Lazy exports for router modules.

Router imports should not eagerly load the entire API surface, especially when
some routes depend on optional integrations. Expose router modules lazily so
tests and aggregators can import only what they need.
"""

from importlib import import_module
from typing import Any

_ROUTERS = {
    "admin_router": "app.routers.admin_router",
    "ai_assistant_router": "app.routers.ai_assistant_router",
    "ai_config_router": "app.routers.ai_config_router",
    "auth_router": "app.routers.auth_router",
    "aws_textract_router": "app.routers.aws_textract_router",
    "azure_router": "app.routers.azure_router",
    "biesse_router": "app.routers.biesse_router",
    "compliance_router": "app.routers.compliance_router",
    "config_router": "app.routers.config_router",
    "crm_router": "app.routers.crm_router",
    "customers_router": "app.routers.customers_router",
    "email_ocr_router": "app.routers.email_ocr_router",
    "google_vision_router": "app.routers.google_vision_router",
    "integration_router": "app.routers.integration_router",
    "materials_router": "app.routers.materials_router",
    "mikro_router": "app.routers.mikro_router",
    "ocr_router": "app.routers.ocr_router",
    "optiplanning_router": "app.routers.optiplanning_router",
    "orchestrator_router": "app.routers.orchestrator_router",
    "orders_router": "app.routers.orders_router",
    "payment_router": "app.routers.payment_router",
    "portal": "app.routers.portal",
    "price_tracking_router": "app.routers.price_tracking_router",
    "product_router": "app.routers.product_router",
    "public_tracking_router": "app.routers.public_tracking_router",
    "scanner_device_router": "app.routers.scanner_device_router",
    "sql_router": "app.routers.sql_router",
    "stations_router": "app.routers.stations_router",
    "stock_cards_router": "app.routers.stock_cards_router",
    "telegram_ocr_router": "app.routers.telegram_ocr_router",
    "whatsapp_router": "app.routers.whatsapp_router",
}

__all__ = sorted(_ROUTERS)


def __getattr__(name: str) -> Any:
    if name not in _ROUTERS:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    module = import_module(_ROUTERS[name])
    globals()[name] = module
    return module


def __dir__() -> list[str]:
    return sorted(set(globals()) | set(__all__))

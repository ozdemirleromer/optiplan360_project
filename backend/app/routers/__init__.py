from . import (
    admin_router,
    ai_assistant_router,
    ai_config_router,
    auth_router,
    aws_textract_router,
    azure_router,
    compliance_router,
    crm_router,
    customers_router,
    email_ocr_router,
    google_vision_router,
    integration_router,
    materials_router,
    mikro_router,
    ocr_router,
    orchestrator_router,
    orders_router,
    payment_router,
    price_tracking_router,
    product_router,
    scanner_device_router,
    sql_router,
    stations_router,
    stock_cards_router,
    telegram_ocr_router,
    whatsapp_router,
)

__all__ = [
    "auth_router",
    "admin_router",
    "orders_router",
    "customers_router",
    "stations_router",
    "materials_router",
    "whatsapp_router",
    "ocr_router",
    "azure_router",
    "google_vision_router",
    "aws_textract_router",
    "telegram_ocr_router",
    "email_ocr_router",
    "scanner_device_router",
    "compliance_router",
    "sql_router",
    "crm_router",
    "payment_router",
    "integration_router",
    "mikro_router",
    "stock_cards_router",
    "orchestrator_router",
    "product_router",
    "price_tracking_router",
    "ai_assistant_router",
    "ai_config_router",
]

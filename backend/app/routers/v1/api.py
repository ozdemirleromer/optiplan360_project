"""
API v1 Router Aggregator
Centralizes all v1 routes without changing existing router prefixes.
"""
from fastapi import APIRouter

from app.routers import (
    auth_router,
    admin_router,
    orders_router,
    customers_router,
    stations_router,
    materials_router,
    whatsapp_router,
    ocr_router,
    azure_router,
    google_vision_router,
    aws_textract_router,
    telegram_ocr_router,
    email_ocr_router,
    scanner_device_router,
    compliance_router,
    sql_router,
    crm_router,
    payment_router,
    integration_router,
    mikro_router,
    stock_cards_router,
    orchestrator_router,
    product_router,
    price_tracking_router,
    ai_assistant_router,
    ai_config_router,
    biesse_router,
    optiplanning_router,
    portal,
)
from app.routers.config_router import router as _config_router

router = APIRouter()

@router.get("/api/v1", tags=["system"])
def v1_root():
    return {
        "message": "OPTIPLAN360 API v1",
        "auth": "/api/v1/auth",
        "docs": "/docs",
        "health": "/health",
    }

# Authentication and admin
router.include_router(auth_router.router)
router.include_router(admin_router.router)

# Config / permissions
router.include_router(_config_router)

# Core operations
router.include_router(orders_router.router)
router.include_router(customers_router.router)
router.include_router(stations_router.router)
router.include_router(stock_cards_router.router)
router.include_router(materials_router.router)

# Integrations and automation
router.include_router(integration_router.router)
router.include_router(mikro_router.router)
router.include_router(whatsapp_router.router)

# OCR and external providers
router.include_router(ocr_router.router)
router.include_router(azure_router.router)
router.include_router(google_vision_router.router)
router.include_router(aws_textract_router.router)
router.include_router(telegram_ocr_router.router)
router.include_router(email_ocr_router.router)
router.include_router(scanner_device_router.router)

# Business modules
router.include_router(crm_router.router)
router.include_router(payment_router.router)
router.include_router(compliance_router.router)
router.include_router(sql_router.router)

# Orchestrator bridge
router.include_router(orchestrator_router.router)

# Product catalog
router.include_router(product_router.router)

# Price tracking
router.include_router(price_tracking_router.router)

# AI Assistant
router.include_router(ai_assistant_router.router)

# AI Configuration
router.include_router(ai_config_router.router)

# Biesse/OptiPlanning Integration
router.include_router(biesse_router.router)
router.include_router(optiplanning_router.router)

# Customer Portal
router.include_router(portal.router)

# Public Tracking
from app.routers import public_tracking_router
router.include_router(public_tracking_router.router)

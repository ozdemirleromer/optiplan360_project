"""
API v1 Router Aggregator

Centralizes all v1 routes through feature groups without changing endpoint paths.
"""

from fastapi import APIRouter

from app.features.v1_router_groups import include_grouped_routers

router = APIRouter()


@router.get("/api/v1", tags=["system"])
def v1_root():
    return {
        "message": "OPTIPLAN360 API v1",
        "auth": "/api/v1/auth",
        "docs": "/docs",
        "health": "/health",
    }


# Hybrid architecture composition:
# - Vertical: feature groups in app.features.v1_router_groups
# - Horizontal: existing routers/services/models stay unchanged
include_grouped_routers(router)

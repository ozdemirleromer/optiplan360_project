"""
V1 router grouping for hybrid architecture.

Goal:
- Vertical partitioning: feature groups/domains.
- Horizontal partitioning: routers remain transport layer, services/models stay separate.

This module centralizes v1 route composition without changing existing endpoint paths.
"""

from importlib import import_module
from typing import Dict, Iterable, Sequence, Tuple

from fastapi import APIRouter

GroupMap = Dict[str, Tuple[str, ...]]


V1_ROUTER_GROUPS: GroupMap = {
    "auth_admin": (
        "app.features.auth.transport.http.router",
        "app.features.admin.transport.http.router",
    ),
    "config": (
        "app.features.config.transport.http.router",
    ),
    "core_operations": (
        "app.features.orders.transport.http.router",
        "app.features.customers.transport.http.router",
        "app.features.stations.transport.http.router",
        "app.features.stock.transport.http.router",
        "app.features.materials.transport.http.router",
    ),
    "integrations": (
        "app.features.integration.transport.http.router",
        "app.features.mikro.transport.http.router",
        "app.features.whatsapp.transport.http.router",
    ),
    "ocr_external": (
        "app.features.ocr.transport.http.router",
        "app.features.azure.transport.http.router",
        "app.features.google_vision.transport.http.router",
        "app.features.aws_textract.transport.http.router",
        "app.features.telegram_ocr.transport.http.router",
        "app.features.email_ocr.transport.http.router",
        "app.features.scanner_device.transport.http.router",
    ),
    "business_modules": (
        "app.features.crm.transport.http.router",
        "app.features.payment.transport.http.router",
        "app.features.compliance.transport.http.router",
        "app.features.sql.transport.http.router",
    ),
    "orchestration": (
        "app.features.orchestrator.transport.http.router",
        "app.features.biesse.transport.http.router",
        "app.features.optiplanning.transport.http.router",
    ),
    "catalog_tracking": (
        "app.features.product.transport.http.router",
        "app.features.price_tracking.transport.http.router",
    ),
    "ai": (
        "app.features.ai_assistant.transport.http.router",
        "app.features.ai_config.transport.http.router",
    ),
    "portal_public": (
        "app.features.portal.transport.http.router",
        "app.features.public_tracking.transport.http.router",
    ),
}


def _load_router(module_path: str) -> APIRouter:
    module = import_module(module_path)
    router = getattr(module, "router", None)
    if router is None:
        raise AttributeError(f"{module_path} has no 'router' attribute")
    return router


def iter_group_routers(group_names: Sequence[str] | None = None) -> Iterable[APIRouter]:
    selected = group_names or tuple(V1_ROUTER_GROUPS.keys())
    for group_name in selected:
        if group_name not in V1_ROUTER_GROUPS:
            raise KeyError(f"Unknown v1 router group: {group_name}")
        for module_path in V1_ROUTER_GROUPS[group_name]:
            yield _load_router(module_path)


def include_grouped_routers(api_router: APIRouter, group_names: Sequence[str] | None = None) -> None:
    for feature_router in iter_group_routers(group_names):
        api_router.include_router(feature_router)

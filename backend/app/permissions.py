"""
Permissions Configuration
Single source of truth for role-based permissions
Used by both backend (authentication/authorization) and frontend (UI rendering)
"""

import logging
from enum import Enum

logger = logging.getLogger(__name__)


class Permission(str, Enum):
    """All available permissions in the system"""

    # ── OPERATIONS ──
    ORDERS_VIEW = "orders:view"
    ORDERS_CREATE = "orders:create"
    ORDERS_EDIT = "orders:edit"
    ORDERS_DELETE = "orders:delete"

    KANBAN_VIEW = "kanban:view"
    KANBAN_EDIT = "kanban:edit"

    CRM_VIEW = "crm:view"
    CRM_CREATE = "crm:create"
    CRM_EDIT = "crm:edit"

    PAYMENT_VIEW = "payment:view"
    PAYMENT_CREATE = "payment:create"
    PAYMENT_EDIT = "payment:edit"
    PAYMENT_EXPORT = "payment:export"

    REPORTS_VIEW = "reports:view"
    REPORTS_EXPORT = "reports:export"

    # ── INVENTORY ──
    STOCK_VIEW = "stock:view"
    STOCK_CREATE = "stock:create"
    STOCK_EDIT = "stock:edit"
    STOCK_IMPORT = "stock:import"

    # ── SYSTEM ──
    SETTINGS_VIEW = "settings:view"
    SETTINGS_EDIT = "settings:edit"

    INTEGRATIONS_VIEW = "integrations:view"
    INTEGRATIONS_MANAGE = "integrations:manage"

    ORGANIZATION_VIEW = "organization:view"
    ORGANIZATION_EDIT = "organization:edit"

    STATIONS_VIEW = "stations:view"
    STATIONS_MANAGE = "stations:manage"

    # ── USERS & SECURITY ──
    USERS_VIEW = "users:view"
    USERS_MANAGE = "users:manage"

    ROLES_VIEW = "roles:view"
    ROLES_MANAGE = "roles:manage"

    ACTIVITY_VIEW = "activity:view"

    # ── PRODUCT CATALOG ──
    PRODUCT_VIEW = "product:view"
    PRODUCT_CREATE = "product:create"
    PRODUCT_EDIT = "product:edit"

    # ── ORCHESTRATOR ──
    ORCHESTRATOR_VIEW = "orchestrator:view"
    ORCHESTRATOR_MANAGE = "orchestrator:manage"

    # ── WHATSAPP ──
    WHATSAPP_VIEW = "whatsapp:view"
    WHATSAPP_SEND = "whatsapp:send"
    WHATSAPP_CONFIG = "whatsapp:config"

    # ── PRICE TRACKING ──
    PRICE_TRACKING_VIEW = "price_tracking:view"
    PRICE_TRACKING_UPLOAD = "price_tracking:upload"
    PRICE_TRACKING_EXPORT = "price_tracking:export"
    PRICE_TRACKING_DELETE = "price_tracking:delete"

    # ── MONITORING ──
    LOGS_VIEW = "logs:view"
    AUDIT_VIEW = "audit:view"
    ANALYTICS_VIEW = "analytics:view"


# ── ROLE-PERMISSION MAPPING ──
# Single source of truth - used everywhere
ROLE_PERMISSIONS = {
    "ADMIN": [
        # Operations (full access)
        Permission.ORDERS_VIEW,
        Permission.ORDERS_CREATE,
        Permission.ORDERS_EDIT,
        Permission.ORDERS_DELETE,
        Permission.KANBAN_VIEW,
        Permission.KANBAN_EDIT,
        Permission.CRM_VIEW,
        Permission.CRM_CREATE,
        Permission.CRM_EDIT,
        Permission.PAYMENT_VIEW,
        Permission.PAYMENT_CREATE,
        Permission.PAYMENT_EDIT,
        Permission.PAYMENT_EXPORT,
        Permission.REPORTS_VIEW,
        Permission.REPORTS_EXPORT,
        # Inventory
        Permission.STOCK_VIEW,
        Permission.STOCK_CREATE,
        Permission.STOCK_EDIT,
        Permission.STOCK_IMPORT,
        # System
        Permission.SETTINGS_VIEW,
        Permission.SETTINGS_EDIT,
        Permission.INTEGRATIONS_VIEW,
        Permission.INTEGRATIONS_MANAGE,
        Permission.ORGANIZATION_VIEW,
        Permission.ORGANIZATION_EDIT,
        Permission.STATIONS_VIEW,
        Permission.STATIONS_MANAGE,
        # Product Catalog
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_CREATE,
        Permission.PRODUCT_EDIT,
        # Orchestrator
        Permission.ORCHESTRATOR_VIEW,
        Permission.ORCHESTRATOR_MANAGE,
        # Users & Security
        Permission.USERS_VIEW,
        Permission.USERS_MANAGE,
        Permission.ROLES_VIEW,
        Permission.ROLES_MANAGE,
        Permission.ACTIVITY_VIEW,
        # WhatsApp
        Permission.WHATSAPP_VIEW,
        Permission.WHATSAPP_SEND,
        Permission.WHATSAPP_CONFIG,
        # Price Tracking
        Permission.PRICE_TRACKING_VIEW,
        Permission.PRICE_TRACKING_UPLOAD,
        Permission.PRICE_TRACKING_EXPORT,
        Permission.PRICE_TRACKING_DELETE,
        # Monitoring
        Permission.LOGS_VIEW,
        Permission.AUDIT_VIEW,
        Permission.ANALYTICS_VIEW,
    ],
    "OPERATOR": [
        # Operations (limited)
        Permission.ORDERS_VIEW,
        Permission.ORDERS_CREATE,
        Permission.ORDERS_EDIT,  # Own orders only
        Permission.KANBAN_VIEW,
        Permission.KANBAN_EDIT,
        Permission.CRM_VIEW,
        Permission.CRM_CREATE,
        Permission.CRM_EDIT,
        Permission.PAYMENT_VIEW,
        Permission.PAYMENT_CREATE,
        Permission.PAYMENT_EDIT,
        Permission.REPORTS_VIEW,
        # Inventory
        Permission.STOCK_VIEW,
        Permission.STOCK_CREATE,
        Permission.STOCK_EDIT,
        # Product Catalog
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_CREATE,
        # Orchestrator
        Permission.ORCHESTRATOR_VIEW,
        Permission.ORCHESTRATOR_MANAGE,
        # WhatsApp
        Permission.WHATSAPP_VIEW,
        Permission.WHATSAPP_SEND,
        # Price Tracking
        Permission.PRICE_TRACKING_VIEW,
        Permission.PRICE_TRACKING_UPLOAD,
        Permission.PRICE_TRACKING_EXPORT,
        # Monitoring
        Permission.ACTIVITY_VIEW,
        Permission.LOGS_VIEW,
    ],
    "STATION": [
        # Operations (minimal)
        Permission.ORDERS_VIEW,
        Permission.KANBAN_VIEW,
        Permission.KANBAN_EDIT,  # Scan operations
        # Stations (barkod okutma için zorunlu)
        Permission.STATIONS_VIEW,
        # Monitoring
        Permission.ACTIVITY_VIEW,
    ],
    # Kiosk: sadece üretim akışını görür, barkod okutabilir
    "KIOSK": [
        Permission.KANBAN_VIEW,
        Permission.KANBAN_EDIT,
        # Stations (barkod okutma için zorunlu)
        Permission.STATIONS_VIEW,
        Permission.ACTIVITY_VIEW,
    ],
    # Sales: müşteri/ürün arama + sipariş oluşturma
    "SALES": [
        Permission.ORDERS_VIEW,
        Permission.ORDERS_CREATE,
        Permission.KANBAN_VIEW,
        Permission.CRM_VIEW,
        Permission.CRM_CREATE,
        Permission.CRM_EDIT,
        Permission.PRODUCT_VIEW,
        Permission.PRODUCT_CREATE,
        Permission.REPORTS_VIEW,
        Permission.STOCK_VIEW,
        Permission.WHATSAPP_VIEW,
        Permission.WHATSAPP_SEND,
        Permission.ACTIVITY_VIEW,
    ],
    # Viewer: salt okuma; yönetim, düzenleme, silme yetkileri yok
    "VIEWER": [
        Permission.ORDERS_VIEW,
        Permission.KANBAN_VIEW,
        Permission.CRM_VIEW,
        Permission.PAYMENT_VIEW,
        Permission.REPORTS_VIEW,
        Permission.STOCK_VIEW,
        Permission.PRODUCT_VIEW,
        Permission.PRICE_TRACKING_VIEW,
        Permission.ACTIVITY_VIEW,
    ],
}

# Geçerli rollerin set'i — hızlı kontrol için
KNOWN_ROLES: frozenset[str] = frozenset(ROLE_PERMISSIONS.keys())


def get_permissions_for_role(role: str) -> list[str]:
    """Rol için izin string listesi döndürür. Bilinmeyen rol için uyarı verir."""
    if role not in KNOWN_ROLES:
        logger.warning(
            "Bilinmeyen rol: %r — boş yetki listesi döndürülüyor. " "KNOWN_ROLES: %s",
            role,
            sorted(KNOWN_ROLES),
        )
        return []
    return [p.value for p in ROLE_PERMISSIONS[role]]


def has_permission(role: str, permission: Permission) -> bool:
    """Rolün belirli bir izni var mı kontrol eder."""
    return permission in ROLE_PERMISSIONS.get(role, [])


def check_permission(role: str, *permissions: Permission) -> bool:
    """Rolün TÜM belirtilen izinlere sahip olup olmadığını kontrol eder."""
    role_permissions = ROLE_PERMISSIONS.get(role, [])
    return all(perm in role_permissions for perm in permissions)


def check_any_permission(role: str, *permissions: Permission) -> bool:
    """Rolün belirtilen izinlerden HERHANGİ BİRİNE sahip olup olmadığını kontrol eder."""
    role_permissions = ROLE_PERMISSIONS.get(role, [])
    return any(perm in role_permissions for perm in permissions)

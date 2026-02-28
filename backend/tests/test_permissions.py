"""
OptiPlan 360 — Rol/İzin Matrisi Testleri
Çalıştır: pytest tests/test_permissions.py -v
"""
import logging
import pytest

from app.permissions import (
    Permission,
    ROLE_PERMISSIONS,
    KNOWN_ROLES,
    get_permissions_for_role,
    has_permission,
    check_permission,
    check_any_permission,
)


# ── Temel testler (önceki testler korundu) ───────────────────────────────────

def test_admin_has_core_permissions():
    permissions = get_permissions_for_role("ADMIN")
    assert Permission.ORDERS_VIEW.value in permissions
    assert Permission.PAYMENT_VIEW.value in permissions
    assert Permission.INTEGRATIONS_MANAGE.value in permissions


def test_operator_limited_permissions():
    assert has_permission("OPERATOR", Permission.ORDERS_VIEW)
    assert has_permission("OPERATOR", Permission.PAYMENT_VIEW)
    assert not has_permission("OPERATOR", Permission.INTEGRATIONS_MANAGE)


def test_station_minimal_permissions():
    assert has_permission("STATION", Permission.KANBAN_VIEW)
    assert not has_permission("STATION", Permission.PAYMENT_EDIT)


# ── KNOWN_ROLES ──────────────────────────────────────────────────────────────

class TestKnownRoles:
    def test_all_expected_roles_present(self):
        assert KNOWN_ROLES == {"ADMIN", "OPERATOR", "STATION", "KIOSK", "VIEWER", "SALES"}

    def test_is_frozenset(self):
        assert isinstance(KNOWN_ROLES, frozenset)

    def test_role_permissions_keys_match(self):
        assert set(ROLE_PERMISSIONS.keys()) == KNOWN_ROLES


# ── get_permissions_for_role ─────────────────────────────────────────────────

class TestGetPermissionsForRole:
    def test_admin_has_full_access(self):
        perms = get_permissions_for_role("ADMIN")
        for perm in ["orders:view", "orders:create", "orders:edit", "orders:delete",
                     "users:manage", "roles:manage", "audit:view", "logs:view"]:
            assert perm in perms, f"ADMIN eksik izin: {perm}"

    def test_operator_no_delete_no_system_admin(self):
        perms = get_permissions_for_role("OPERATOR")
        assert "orders:delete" not in perms
        assert "settings:edit" not in perms
        assert "roles:manage" not in perms

    def test_viewer_is_strictly_readonly(self):
        perms = get_permissions_for_role("VIEWER")
        write_perms = [p for p in perms if any(
            p.endswith(s) for s in (":create", ":edit", ":delete", ":manage", ":import")
        )]
        assert write_perms == [], f"VIEWER yazma yetkisi içeriyor: {write_perms}"

    def test_kiosk_exactly_four_permissions(self):
        perms = get_permissions_for_role("KIOSK")
        assert "kanban:view" in perms
        assert "kanban:edit" in perms
        assert "stations:view" in perms
        assert "activity:view" in perms
        assert "orders:view" not in perms
        assert len(perms) == 4

    def test_unknown_role_returns_empty_list(self):
        assert get_permissions_for_role("GHOST") == []

    def test_unknown_role_logs_warning(self, caplog):
        with caplog.at_level(logging.WARNING):
            get_permissions_for_role("UNKNOWN_ROLE_XYZ")
        assert "UNKNOWN_ROLE_XYZ" in caplog.text

    def test_returns_strings_not_enums(self):
        for p in get_permissions_for_role("OPERATOR"):
            assert isinstance(p, str), f"İzin string değil: {p!r}"


# ── has_permission ────────────────────────────────────────────────────────────

class TestHasPermission:
    @pytest.mark.parametrize("role,perm,expected", [
        ("ADMIN",    Permission.ORDERS_DELETE,  True),
        ("ADMIN",    Permission.ROLES_MANAGE,   True),
        ("OPERATOR", Permission.ORDERS_DELETE,  False),
        ("OPERATOR", Permission.ORDERS_VIEW,    True),
        ("VIEWER",   Permission.ORDERS_VIEW,    True),
        ("VIEWER",   Permission.ORDERS_CREATE,  False),
        ("KIOSK",    Permission.KANBAN_EDIT,    True),
        ("KIOSK",    Permission.ORDERS_VIEW,    False),
        ("SALES",    Permission.PRODUCT_VIEW,   True),
        ("SALES",    Permission.PRODUCT_CREATE, True),
        ("SALES",    Permission.ORDERS_CREATE,  True),
        ("SALES",    Permission.ORDERS_DELETE,  False),
        ("SALES",    Permission.SETTINGS_EDIT,  False),
        ("GHOST",    Permission.ORDERS_VIEW,    False),
    ])
    def test_parametrized(self, role, perm, expected):
        assert has_permission(role, perm) is expected


# ── check_permission (ALL) ───────────────────────────────────────────────────

class TestCheckPermission:
    def test_admin_passes_multi(self):
        assert check_permission("ADMIN",
            Permission.ORDERS_VIEW, Permission.ORDERS_DELETE, Permission.AUDIT_VIEW
        ) is True

    def test_operator_fails_when_one_missing(self):
        assert check_permission("OPERATOR",
            Permission.ORDERS_VIEW, Permission.ORDERS_DELETE
        ) is False

    def test_no_permissions_given_returns_true(self):
        assert check_permission("VIEWER") is True  # all() boş = True


# ── check_any_permission (OR) ────────────────────────────────────────────────

class TestCheckAnyPermission:
    def test_operator_has_at_least_one(self):
        assert check_any_permission("OPERATOR",
            Permission.ORDERS_DELETE, Permission.ORDERS_VIEW
        ) is True

    def test_viewer_no_write(self):
        assert check_any_permission("VIEWER",
            Permission.ORDERS_CREATE, Permission.ORDERS_EDIT, Permission.ORDERS_DELETE
        ) is False

    def test_ghost_has_none(self):
        assert check_any_permission("GHOST", Permission.ORDERS_VIEW) is False


# ── Rol hiyerarşi tutarlılık ─────────────────────────────────────────────────

class TestRoleHierarchy:
    def test_operator_subset_of_admin(self):
        admin_perms = set(get_permissions_for_role("ADMIN"))
        op_perms = set(get_permissions_for_role("OPERATOR"))
        extras = op_perms - admin_perms
        assert extras == set(), f"OPERATOR, ADMIN'de olmayan izinlere sahip: {extras}"

    def test_sales_subset_of_operator(self):
        op_perms = set(get_permissions_for_role("OPERATOR"))
        sales_perms = set(get_permissions_for_role("SALES"))
        extras = sales_perms - op_perms
        assert extras == set(), f"SALES, OPERATOR'de olmayan izinlere sahip: {extras}"

    def test_viewer_subset_of_operator(self):
        op_perms = set(get_permissions_for_role("OPERATOR"))
        viewer_perms = set(get_permissions_for_role("VIEWER"))
        extras = viewer_perms - op_perms
        assert extras == set(), f"VIEWER, OPERATOR'de olmayan izinlere sahip: {extras}"

    def test_no_duplicate_permissions_per_role(self):
        for role, perms in ROLE_PERMISSIONS.items():
            values = [p.value for p in perms]
            assert len(values) == len(set(values)), (
                f"{role} rolünde duplicate izin: {values}"
            )

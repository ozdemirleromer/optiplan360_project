import sys
from pathlib import Path

from fastapi import APIRouter

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.features.v1_router_groups import V1_ROUTER_GROUPS, include_grouped_routers


def test_v1_router_groups_have_unique_modules():
    modules = [module for group in V1_ROUTER_GROUPS.values() for module in group]
    assert len(modules) == len(set(modules))


def test_include_grouped_routers_registers_routes():
    router = APIRouter()
    include_grouped_routers(router)
    # API root haric route'lar include edildiginde route sayisi sifirdan buyuk olmalidir.
    assert len(router.routes) > 0

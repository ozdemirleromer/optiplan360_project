import importlib
import sys
from pathlib import Path


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))


def test_services_package_imports_without_eager_optional_dependencies():
    services = importlib.import_module("app.services")
    assert hasattr(services, "payment_service")
    assert hasattr(services, "integration_service")


def test_routers_package_imports_lazily():
    routers = importlib.import_module("app.routers")
    assert hasattr(routers, "orders_router")
    assert hasattr(routers, "payment_router")

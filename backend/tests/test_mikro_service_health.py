import json
import os

from app.services import mikro_service


class _CursorStub:
    def __init__(self, row):
        self.row = row
        self.executed = []
        self.closed = False

    def execute(self, query, params=None):
        self.executed.append((query, params))

    def fetchone(self):
        return self.row

    def close(self):
        self.closed = True


class _ConnectionStub:
    def __init__(self, row):
        self.cursor_obj = _CursorStub(row)
        self.closed = False

    def cursor(self):
        return self.cursor_obj

    def close(self):
        self.closed = True


def test_test_connection_returns_forced_ok_without_db(monkeypatch):
    monkeypatch.setenv("MIKRO_HEALTH_FORCE_OK", "1")

    def _boom():
        raise AssertionError("DB baglantisi cagirilmamali")

    monkeypatch.setattr(mikro_service, "_get_db_connection", _boom)

    result = mikro_service.test_connection()

    assert result["status"] == "ok"
    assert result.get("forced") is True
    assert result.get("latency_ms") == 0.0


def test_test_connection_returns_error_when_db_fails(monkeypatch):
    monkeypatch.delenv("MIKRO_HEALTH_FORCE_OK", raising=False)

    def _fail():
        raise RuntimeError("db down")

    monkeypatch.setattr(mikro_service, "_get_db_connection", _fail)

    result = mikro_service.test_connection()

    assert result["status"] == "error"
    assert "db down" in result.get("detail", "")


def test_load_mikro_config_supports_legacy_env_names(monkeypatch):
    monkeypatch.delenv("MIKRO_SERVER", raising=False)
    monkeypatch.delenv("MIKRO_DATABASE", raising=False)
    monkeypatch.delenv("MIKRO_USER", raising=False)
    monkeypatch.delenv("MIKRO_PASSWORD", raising=False)
    monkeypatch.setenv("MIKRO_DB_HOST", "legacy-host")
    monkeypatch.setenv("MIKRO_DB_DATABASE", "legacy-db")
    monkeypatch.setenv("MIKRO_DB_USERNAME", "legacy-user")
    monkeypatch.setenv("MIKRO_DB_PASSWORD", "legacy-pass")
    monkeypatch.setenv("MIKRO_DB_PORT", "1435")
    monkeypatch.setenv("MIKRO_DB_INSTANCE", "SQLEXPRESS")
    monkeypatch.setattr(mikro_service, "CONFIG_PATH", "__missing__.json")
    monkeypatch.setattr(mikro_service, "LEGACY_CONFIG_PATH", "__missing_legacy__.json")

    cfg = mikro_service._load_mikro_config()

    assert cfg["server"] == "legacy-host"
    assert cfg["database"] == "legacy-db"
    assert cfg["username"] == "legacy-user"
    assert cfg["password"] == "legacy-pass"
    assert cfg["port"] == "1435"
    assert cfg["instance"] == "SQLEXPRESS"


def test_load_mikro_config_supports_legacy_nested_file(monkeypatch, tmp_path):
    legacy_path = tmp_path / "mikro_config.json"
    legacy_path.write_text(
        json.dumps(
            {
                "sql_server": {
                    "host": "legacy-file-host",
                    "port": 1555,
                    "database": "legacy-file-db",
                    "username": "legacy-file-user",
                    "password": "legacy-file-pass",
                    "connection_timeout": 19,
                    "trust_server_certificate": True,
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(mikro_service, "CONFIG_PATH", "__missing__.json")
    monkeypatch.setattr(mikro_service, "LEGACY_CONFIG_PATH", str(legacy_path))

    cfg = mikro_service._load_mikro_config()

    assert cfg["server"] == "legacy-file-host"
    assert cfg["database"] == "legacy-file-db"
    assert cfg["username"] == "legacy-file-user"
    assert cfg["password"] == "legacy-file-pass"
    assert cfg["port"] == "1555"
    assert cfg["timeout"] == "19"
    assert cfg["trust_cert"] is True


def test_validate_stok_kodu_checks_database_by_stock_code(monkeypatch):
    connection = _ConnectionStub((1,))
    monkeypatch.setattr(mikro_service, "_get_db_connection", lambda: connection)

    assert mikro_service.validate_stok_kodu("STK-001") is True
    assert connection.cursor_obj.executed == [
        ("SELECT COUNT(1) FROM STOKLAR WHERE STOK_KOD = ?", ("STK-001",))
    ]
    assert connection.cursor_obj.closed is True
    assert connection.closed is True


def test_validate_stok_kodu_falls_back_to_cached_materials_when_db_fails(monkeypatch):
    def _boom():
        raise RuntimeError("db down")

    monkeypatch.setattr(mikro_service, "_get_db_connection", _boom)
    monkeypatch.setattr(
        mikro_service,
        "get_all_materials",
        lambda: [{"raw_name": "STK-LEGACY"}, {"stock_code": "STK-002"}],
    )

    assert mikro_service.validate_stok_kodu("STK-002") is True
    assert mikro_service.validate_stok_kodu("STK-LEGACY") is True
    assert mikro_service.validate_stok_kodu("STK-404") is False

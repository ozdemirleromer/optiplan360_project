import os

from app.services import mikro_service


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

    cfg = mikro_service._load_mikro_config()

    assert cfg["server"] == "legacy-host"
    assert cfg["database"] == "legacy-db"
    assert cfg["username"] == "legacy-user"
    assert cfg["password"] == "legacy-pass"
    assert cfg["port"] == "1435"
    assert cfg["instance"] == "SQLEXPRESS"

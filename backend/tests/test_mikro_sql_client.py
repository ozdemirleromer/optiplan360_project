import json
import sys
from pathlib import Path

# Add parent directory to Python path for app module imports
sys.path.insert(0, str(Path(__file__).parent.parent))

import pytest
import app.integrations.mikro_sql_client as mikro_sql_module

from app.exceptions import (
    MikroAuthError,
    MikroConnectionError,
    MikroDataError,
    MikroDataIntegrityError,
    MikroIntegrationError,
    MikroQueryError,
    MikroTimeoutError,
)
from app.integrations.mikro_sql_client import MikroSQLClient, get_mikro_client


class _FakeCursor:
    def execute(self, _query):
        return None

    def fetchone(self):
        return ["Microsoft SQL Server Test Version"]

    def close(self):
        return None


class _FakeConnection:
    def cursor(self):
        return _FakeCursor()


class _BoomConnection:
    def cursor(self):
        raise RuntimeError("cursor patladi")


class _LongVersionCursor:
    def execute(self, _query):
        return None

    def fetchone(self):
        return ["X" * 240]

    def close(self):
        return None


class _LongVersionConnection:
    def cursor(self):
        return _LongVersionCursor()


class _ClosableConnection:
    def __init__(self):
        self.closed = False

    def close(self):
        self.closed = True


class _FailingCloseConnection:
    def close(self):
        raise RuntimeError("connection reset by peer")


def _client() -> MikroSQLClient:
    return MikroSQLClient(
        {
            "host": "localhost",
            "port": 1433,
            "database": "MIKRO_TEST",
            "username": "sa",
            "password": "pwd",
            "connection_timeout": 7,
        }
    )


def test_test_connection_success_when_query_returns_version(monkeypatch):
    client = _client()
    client.connection = _FakeConnection()

    result = client.test_connection()

    assert result["success"] is True
    assert result["database"] == "MIKRO_TEST"
    assert "version" in result


def test_test_connection_timeout_error_payload(monkeypatch):
    client = _client()

    def _raise_timeout():
        raise MikroTimeoutError(7, operation="connect")

    monkeypatch.setattr(client, "connect", _raise_timeout)

    result = client.test_connection()

    assert result["success"] is False
    assert "timeout" in result["error"].lower()


def test_test_connection_auth_error_payload(monkeypatch):
    client = _client()

    def _raise_auth():
        raise MikroAuthError("login failed")

    monkeypatch.setattr(client, "connect", _raise_auth)

    result = client.test_connection()

    assert result["success"] is False
    assert result["error"] == "Kimlik doğrulama başarısız"


def test_test_connection_connection_error_payload(monkeypatch):
    client = _client()

    def _raise_conn():
        raise MikroConnectionError("server down", host="localhost")

    monkeypatch.setattr(client, "connect", _raise_conn)

    result = client.test_connection()

    assert result["success"] is False
    assert "bağlantı" in result["error"].lower() or "baglanti" in result["error"].lower()


def test_test_connection_query_error_payload():
    client = _client()
    client.connection = _BoomConnection()

    result = client.test_connection()

    assert result["success"] is False
    assert "cursor patladi" in result["error"]


def test_normalize_test_connection_error_for_query_exception():
    client = _client()

    result = client._normalize_test_connection_error(
        MikroQueryError("syntax error", query="SELECT * FROM X")
    )

    assert result["success"] is False
    assert "sorgu" in result["error"].lower()


def test_test_connection_version_field_is_truncated_to_100_chars():
    client = _client()
    client.connection = _LongVersionConnection()

    result = client.test_connection()

    assert result["success"] is True
    assert len(result["version"]) == 100


def test_read_only_mode_defaults_true_when_not_provided():
    client = _client()
    assert client.read_only_mode is True


def test_read_only_mode_reads_from_config_when_env_missing():
    client = MikroSQLClient(
        {
            "host": "localhost",
            "database": "MIKRO_TEST",
            "username": "sa",
            "password": "pwd",
            "read_only_mode": "false",
        }
    )
    assert client.read_only_mode is False


def test_read_only_mode_env_overrides_config(monkeypatch):
    monkeypatch.setenv("MIKRO_READ_ONLY_MODE", "true")
    client = MikroSQLClient(
        {
            "host": "localhost",
            "database": "MIKRO_TEST",
            "username": "sa",
            "password": "pwd",
            "read_only_mode": False,
        }
    )

    assert client.read_only_mode is True


def test_ensure_write_allowed_raises_permission_error_in_read_only_mode():
    client = _client()

    with pytest.raises(PermissionError, match="MIKRO_READ_ONLY_MODE aktif"):
        client._ensure_write_allowed("create_account")


def test_raise_mikro_exception_maps_timeout_to_mikro_timeout_error():
    client = _client()

    with pytest.raises(MikroTimeoutError):
        client._raise_mikro_exception(TimeoutError("operation timeout"), operation="connect")


def test_raise_mikro_exception_maps_login_failed_to_mikro_auth_error():
    client = _client()

    with pytest.raises(MikroAuthError):
        client._raise_mikro_exception(RuntimeError("Login failed for user"), operation="connect")


def test_raise_mikro_exception_maps_duplicate_to_integrity_error():
    client = _client()

    with pytest.raises(MikroDataIntegrityError):
        client._raise_mikro_exception(
            RuntimeError("duplicate key value violates pk_account"),
            operation="create_account",
            table="CARI_HESAPLAR",
        )


def test_raise_mikro_exception_maps_not_null_to_integrity_error():
    client = _client()

    with pytest.raises(MikroDataIntegrityError):
        client._raise_mikro_exception(
            RuntimeError("cannot insert null into CARI_UNVAN"),
            operation="create_account",
            table="CARI_HESAPLAR",
        )


def test_raise_mikro_exception_maps_invalid_syntax_to_query_error():
    client = _client()

    with pytest.raises(MikroQueryError):
        client._raise_mikro_exception(
            RuntimeError("invalid syntax near from"),
            operation="query",
            query="SELECT * FROM CARI_HESAPLAR",
        )


def test_raise_mikro_exception_maps_connection_issue_to_connection_error():
    client = _client()

    with pytest.raises(MikroConnectionError):
        client._raise_mikro_exception(
            RuntimeError("could not open connection to server"),
            operation="connect",
        )


def test_raise_mikro_exception_maps_conversion_issue_to_data_error():
    client = _client()

    with pytest.raises(MikroDataError):
        client._raise_mikro_exception(
            RuntimeError("conversion failed due to type mismatch"),
            operation="query",
            table="CARI_HESAPLAR",
        )


def test_raise_mikro_exception_falls_back_to_integration_error_for_unknown_case():
    client = _client()

    with pytest.raises(MikroIntegrationError):
        client._raise_mikro_exception(RuntimeError("unknown low level failure"), operation="query")


class _PyodbcConnectionSpy:
    def __init__(self, fail_on_setattr: bool = False):
        self.fail_on_setattr = fail_on_setattr
        self.setattr_calls = []

    def setattr(self, attr, mode):
        if self.fail_on_setattr:
            raise RuntimeError("attr desteklenmiyor")
        self.setattr_calls.append((attr, mode))


class _PyodbcModuleSpy:
    SQL_ATTR_ACCESS_MODE = 88
    SQL_MODE_READ_ONLY = 99

    def __init__(self, connection: _PyodbcConnectionSpy, failures: list[Exception] | None = None):
        self._connection = connection
        self.connection_string = ""
        self.connection_strings: list[str] = []
        self.failures = failures or []

    def connect(self, connection_string: str):
        self.connection_string = connection_string
        self.connection_strings.append(connection_string)
        if self.failures:
            raise self.failures.pop(0)
        return self._connection


def test_connect_builds_read_only_connection_string_and_sets_access_mode(monkeypatch):
    client = _client()
    connection = _PyodbcConnectionSpy()
    module_spy = _PyodbcModuleSpy(connection)
    monkeypatch.setattr(mikro_sql_module, "pyodbc", module_spy)

    assert client.connect() is True
    assert "DRIVER={ODBC Driver 18 for SQL Server};" in module_spy.connection_string
    assert "ApplicationIntent=ReadOnly;" in module_spy.connection_string
    assert "TrustServerCertificate=yes;" in module_spy.connection_string
    assert connection.setattr_calls == [(module_spy.SQL_ATTR_ACCESS_MODE, module_spy.SQL_MODE_READ_ONLY)]


def test_connect_builds_read_write_connection_string_when_read_only_disabled(monkeypatch):
    client = MikroSQLClient(
        {
            "host": "localhost",
            "port": 1433,
            "database": "MIKRO_TEST",
            "username": "sa",
            "password": "pwd",
            "read_only_mode": False,
            "trust_server_certificate": False,
        }
    )
    connection = _PyodbcConnectionSpy()
    module_spy = _PyodbcModuleSpy(connection)
    monkeypatch.setattr(mikro_sql_module, "pyodbc", module_spy)

    assert client.connect() is True
    assert "DRIVER={ODBC Driver 18 for SQL Server};" in module_spy.connection_string
    assert "ApplicationIntent=ReadWrite;" in module_spy.connection_string
    assert "TrustServerCertificate=yes;" not in module_spy.connection_string
    assert connection.setattr_calls == []


def test_connect_ignores_setattr_error_and_still_succeeds(monkeypatch):
    client = _client()
    connection = _PyodbcConnectionSpy(fail_on_setattr=True)
    module_spy = _PyodbcModuleSpy(connection)
    monkeypatch.setattr(mikro_sql_module, "pyodbc", module_spy)

    assert client.connect() is True
    assert "ApplicationIntent=ReadOnly;" in module_spy.connection_string


def test_connect_raises_integration_error_when_pyodbc_missing(monkeypatch):
    client = _client()
    monkeypatch.setattr(mikro_sql_module, "pyodbc", None)

    with pytest.raises(MikroIntegrationError, match="connect failed"):
        client.connect()


def test_connect_falls_back_to_driver_17_when_driver_18_missing(monkeypatch):
    client = _client()
    connection = _PyodbcConnectionSpy()
    module_spy = _PyodbcModuleSpy(
        connection,
        failures=[RuntimeError("[IM002] Data source name not found and no default driver specified")],
    )
    monkeypatch.setattr(mikro_sql_module, "pyodbc", module_spy)

    assert client.connect() is True
    assert len(module_spy.connection_strings) == 2
    assert "DRIVER={ODBC Driver 18 for SQL Server};" in module_spy.connection_strings[0]
    assert "DRIVER={ODBC Driver 17 for SQL Server};" in module_spy.connection_strings[1]


def test_connect_uses_only_configured_driver_without_fallback(monkeypatch):
    client = MikroSQLClient(
        {
            "host": "localhost",
            "port": 1433,
            "database": "MIKRO_TEST",
            "username": "sa",
            "password": "pwd",
            "driver": "ODBC Driver 17 for SQL Server",
        }
    )
    connection = _PyodbcConnectionSpy()
    module_spy = _PyodbcModuleSpy(connection)
    monkeypatch.setattr(mikro_sql_module, "pyodbc", module_spy)

    assert client.connect() is True
    assert len(module_spy.connection_strings) == 1
    assert "DRIVER={ODBC Driver 17 for SQL Server};" in module_spy.connection_strings[0]


def test_connect_does_not_retry_for_non_driver_errors(monkeypatch):
    client = _client()
    connection = _PyodbcConnectionSpy()
    module_spy = _PyodbcModuleSpy(connection, failures=[RuntimeError("login failed for user")])
    monkeypatch.setattr(mikro_sql_module, "pyodbc", module_spy)

    with pytest.raises(MikroAuthError):
        client.connect()

    assert len(module_spy.connection_strings) == 1


def test_build_driver_candidates_prefers_env_priority_when_config_missing(monkeypatch):
    monkeypatch.setenv(
        "MIKRO_ODBC_DRIVER_PRIORITY",
        "ODBC Driver 17 for SQL Server, ODBC Driver 18 for SQL Server",
    )
    client = _client()

    assert client._build_driver_candidates() == [
        "ODBC Driver 17 for SQL Server",
        "ODBC Driver 18 for SQL Server",
    ]


def test_build_driver_candidates_dedupes_and_ignores_empty_env_tokens(monkeypatch):
    monkeypatch.setenv(
        "MIKRO_ODBC_DRIVER_PRIORITY",
        " , ODBC Driver 18 for SQL Server, ODBC Driver 18 for SQL Server, , ODBC Driver 17 for SQL Server ",
    )
    client = _client()

    assert client._build_driver_candidates() == [
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
    ]


def test_build_driver_candidates_uses_defaults_when_env_empty_and_no_config(monkeypatch):
    monkeypatch.delenv("MIKRO_ODBC_DRIVER_PRIORITY", raising=False)
    client = _client()

    assert client._build_driver_candidates() == [
        "ODBC Driver 18 for SQL Server",
        "ODBC Driver 17 for SQL Server",
    ]


def test_build_driver_candidates_config_driver_overrides_env(monkeypatch):
    monkeypatch.setenv("MIKRO_ODBC_DRIVER_PRIORITY", "ODBC Driver 18 for SQL Server")
    client = MikroSQLClient(
        {
            "host": "localhost",
            "database": "MIKRO_TEST",
            "username": "sa",
            "password": "pwd",
            "driver": "ODBC Driver 13 for SQL Server",
        }
    )

    assert client._build_driver_candidates() == ["ODBC Driver 13 for SQL Server"]


def test_disconnect_closes_connection_and_resets_state():
    client = _client()
    connection = _ClosableConnection()
    client.connection = connection

    client.disconnect()

    assert connection.closed is True
    assert client.connection is None


def test_get_mikro_client_reads_canonical_flat_config(tmp_path, monkeypatch):
    canonical_path = tmp_path / "mikro_connection.json"
    legacy_path = tmp_path / "mikro_config.json"
    canonical_path.write_text(
        json.dumps(
            {
                "host": "flat-host",
                "port": 1444,
                "database": "MIKRO_FLAT",
                "username": "flat-user",
                "password": "flat-pass",
                "timeout_seconds": 17,
                "trust_server_certificate": False,
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(
        mikro_sql_module,
        "_DEFAULT_CONFIG_CANDIDATES",
        (str(canonical_path), str(legacy_path)),
    )

    client = get_mikro_client()

    assert client.config["host"] == "flat-host"
    assert client.config["port"] == 1444
    assert client.config["database"] == "MIKRO_FLAT"
    assert client.config["connection_timeout"] == 17
    assert client.config["trust_server_certificate"] is False
    assert client.read_only_mode is True


def test_get_mikro_client_falls_back_to_legacy_nested_config(tmp_path, monkeypatch):
    missing_canonical = tmp_path / "missing_connection.json"
    legacy_path = tmp_path / "mikro_config.json"
    legacy_path.write_text(
        json.dumps(
            {
                "sql_server": {
                    "host": "legacy-host",
                    "port": 1433,
                    "database": "MIKRO_LEGACY",
                    "username": "legacy-user",
                    "password": "legacy-pass",
                    "connection_timeout": 23,
                    "read_only_mode": False,
                }
            }
        ),
        encoding="utf-8",
    )
    monkeypatch.setattr(
        mikro_sql_module,
        "_DEFAULT_CONFIG_CANDIDATES",
        (str(missing_canonical), str(legacy_path)),
    )

    client = get_mikro_client()

    assert client.config["host"] == "legacy-host"
    assert client.config["database"] == "MIKRO_LEGACY"
    assert client.config["connection_timeout"] == 23
    assert client.read_only_mode is False


def test_disconnect_is_noop_when_connection_missing():
    client = _client()
    client.connection = None

    client.disconnect()

    assert client.connection is None


def test_disconnect_maps_close_failures_to_mikro_connection_error():
    client = _client()
    client.connection = _FailingCloseConnection()

    with pytest.raises(MikroConnectionError):
        client.disconnect()

    assert client.connection is None


def test_driver_fallback_error_predicate_accepts_known_driver_errors():
    assert MikroSQLClient._is_driver_fallback_error(
        RuntimeError("[IM002] Data source name not found and no default driver specified")
    ) is True
    assert MikroSQLClient._is_driver_fallback_error(
        RuntimeError("Can't open lib 'ODBC Driver 18 for SQL Server' : file not found")
    ) is True


def test_driver_fallback_error_predicate_rejects_non_driver_errors():
    assert MikroSQLClient._is_driver_fallback_error(
        RuntimeError("login failed for user")
    ) is False
    assert MikroSQLClient._is_driver_fallback_error(
        RuntimeError("connection reset by peer")
    ) is False

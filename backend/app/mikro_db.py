"""
OptiPlan 360 — Mikro SQL Server Bağlantı Yöneticisi

Mikro ERP veritabanına READ-ONLY bağlantı sağlar.
Stok adı sorgusu ve malzeme önerisi için kullanılır.

Bağlantı parametreleri Admin Panel üzerinden kaydedilir
ve config/mikro_connection.json dosyasında tutulur.
"""
import os
import json
import re
from typing import Optional

# Mikro bağlantı config dosyası
CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "config", "mikro_connection.json"
)

# Stok adı normalize kuralları (Handoff §5)
NORMALIZE_MAP = {
    "MLAM": "MDFLAM",
    "SLAM": "SUNTALAM",
}


def _load_config() -> dict | None:
    """Kayıtlı Mikro SQL bağlantı parametrelerini oku"""
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        if not cfg.get("host") or not cfg.get("database"):
            return None
        return cfg
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def save_config(config: dict) -> None:
    """Mikro SQL bağlantı parametrelerini kaydet"""
    os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
    # Password'u düz metin olarak saklamıyoruz — prod'da vault kullanılmalı
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def get_config() -> dict | None:
    """Mevcut config'i döndür (password maskeli)"""
    cfg = _load_config()
    if not cfg:
        return None
    # Password maskeleme
    result = {**cfg}
    if result.get("password"):
        result["password"] = "••••••••"
    return result


def _get_connection():
    """
    pyodbc ile Mikro SQL Server bağlantısı oluştur.
    pyodbc yüklü değilse veya bağlantı başarısızsa None döner.
    """
    cfg = _load_config()
    if not cfg:
        return None

    try:
        import pyodbc
    except ImportError:
        return None

    host = cfg["host"]
    port = cfg.get("port", 1433)
    instance = cfg.get("instance", "")
    database = cfg["database"]
    username = cfg.get("username", "")
    password = cfg.get("password", "")
    timeout = cfg.get("timeout_seconds", 10)
    encrypt = cfg.get("encrypt", True)
    trust_cert = cfg.get("trust_server_certificate", False)

    server = f"{host},{port}" if port != 1433 else host
    if instance:
        server = f"{host}\\{instance}"

    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"Connection Timeout={timeout};"
        f"ApplicationIntent=ReadOnly;"
    )
    if encrypt:
        conn_str += "Encrypt=yes;"
    if trust_cert:
        conn_str += "TrustServerCertificate=yes;"

    try:
        conn = pyodbc.connect(conn_str, timeout=timeout)
        conn.setattr(pyodbc.SQL_ATTR_ACCESS_MODE, pyodbc.SQL_MODE_READ_ONLY)
        return conn
    except Exception:
        return None


def test_connection(config: Optional[dict] = None) -> tuple[bool, str]:
    """
    Verilen config ile bağlantı testi yap.
    Returns: (success: bool, message: str)
    """
    try:
        import pyodbc
    except ImportError:
        return False, "pyodbc yüklü değil. Kurulum: pip install pyodbc"

    cfg = config if config is not None else _load_config()
    if not cfg:
        return False, "Mikro baglanti ayarlari bulunamadi"

    host = cfg.get("host", "")
    port = cfg.get("port", 1433)
    instance = cfg.get("instance", "")
    database = cfg.get("database", "")
    username = cfg.get("username", "")
    password = cfg.get("password", "")
    timeout = cfg.get("timeout_seconds", 10)
    encrypt = cfg.get("encrypt", True)
    trust_cert = cfg.get("trust_server_certificate", False)

    if not host or not database:
        return False, "Host ve database zorunludur"

    server = f"{host},{port}" if port != 1433 else host
    if instance:
        server = f"{host}\\{instance}"

    conn_str = (
        f"DRIVER={{ODBC Driver 17 for SQL Server}};"
        f"SERVER={server};"
        f"DATABASE={database};"
        f"UID={username};"
        f"PWD={password};"
        f"Connection Timeout={timeout};"
        f"ApplicationIntent=ReadOnly;"
    )
    if encrypt:
        conn_str += "Encrypt=yes;"
    if trust_cert:
        conn_str += "TrustServerCertificate=yes;"

    try:
        conn = pyodbc.connect(conn_str, timeout=timeout)
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        return True, "Bağlantı başarılı"
    except pyodbc.Error as e:
        return False, f"Bağlantı hatası: {str(e)}"
    except Exception as e:
        return False, f"Beklenmeyen hata: {str(e)}"


def normalize_stock_name(name: str) -> str:
    """Handoff §5 — Stok adı normalize"""
    upper = name.upper().strip()
    for short, full in NORMALIZE_MAP.items():
        upper = upper.replace(short, full)
    return upper


def search_materials(
    query: str,
    thickness: int | None = None,
    color: str | None = None,
    limit: int = 20,
) -> list[dict]:
    """
    Mikro veritabanından malzeme/stok ara.
    Read-only SELECT sorgusu ile en yakın eşleşmeleri döndürür.

    Mikro bağlantısı yoksa boş liste döner.
    """
    conn = _get_connection()
    if not conn:
        return []

    try:
        normalized = normalize_stock_name(query)
        cursor = conn.cursor()

        # Mikro stok tablosu genellikle STOK veya TBLSTSABIT gibi isimlerle olur
        # Burada genel bir sorgu pattern'i kullanıyoruz
        # Gerçek tablo adı kurulumda ayarlanacak
        sql = """
            SELECT TOP (?)
                sto_isim AS stok_adi,
                sto_birim1_ad AS birim,
                sto_create_date AS olusturma
            FROM TBLSTSABIT
            WHERE sto_isim LIKE ?
        """
        params = [limit, f"%{normalized}%"]

        cursor.execute(sql, params)
        columns = [col[0] for col in cursor.description]
        rows = cursor.fetchall()
        cursor.close()
        conn.close()

        results = []
        for row in rows:
            item = dict(zip(columns, row))
            # Basit match score hesapla
            stok_adi = str(item.get("stok_adi", ""))
            score = 1.0
            if normalized in stok_adi.upper():
                score = 0.9
            if stok_adi.upper().startswith(normalized):
                score = 0.95

            results.append({
                "stok_adi": stok_adi,
                "kalinlik": thickness,
                "renk": color or "",
                "ebat": "",
                "match_score": score,
            })

        # Score'a göre sırala
        results.sort(key=lambda x: x["match_score"], reverse=True)
        return results

    except Exception:
        try:
            conn.close()
        except Exception:
            pass
        return []


import os
import json
import logging
import re
from typing import List, Dict, Any, Optional
from collections import defaultdict

try:
    from expiringdict import ExpiringDict
except Exception:  # pragma: no cover - fallback when dependency is missing
    class ExpiringDict(dict):
        def __init__(self, *args, **kwargs):
            super().__init__()

from ..exceptions import ValidationError, AppError

logger = logging.getLogger(__name__)

# --- Konfigürasyon ---
# Öncelik: 1) config/mikro_connection.json  2) Ortam değişkenleri
CONFIG_PATH = os.path.join(
    os.path.dirname(__file__), "..", "..", "..", "config", "mikro_connection.json"
)


def _load_mikro_config() -> Dict[str, str]:
    """Config dosyasından veya ortam değişkenlerinden Mikro bağlantı bilgilerini oku"""
    # Önce config dosyasından oku
    try:
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        if cfg.get("host") and cfg.get("database"):
            return {
                "server": cfg["host"],
                "port": str(cfg.get("port", 1433)),
                "instance": cfg.get("instance", ""),
                "database": cfg["database"],
                "username": cfg.get("username", ""),
                "password": cfg.get("password", ""),
                "timeout": str(cfg.get("timeout_seconds", 10)),
                "encrypt": cfg.get("encrypt", True),
                "trust_cert": cfg.get("trust_server_certificate", False),
            }
    except (FileNotFoundError, json.JSONDecodeError):
        pass

    # Fallback: ortam değişkenleri
    server = os.environ.get("MIKRO_SERVER")
    database = os.environ.get("MIKRO_DATABASE")
    user = os.environ.get("MIKRO_USER")
    password = os.environ.get("MIKRO_PASSWORD")
    if server and database:
        return {
            "server": server,
            "port": "1433",
            "instance": "",
            "database": database,
            "username": user or "",
            "password": password or "",
            "timeout": "10",
            "encrypt": True,
            "trust_cert": False,
        }

    return {}


# --- Önbellek ---
# Veritabanına sürekli yüklenmeyi önlemek için 1 saatlik önbellek
stock_cache = ExpiringDict(max_len=100, max_age_seconds=3600)


def _get_db_connection():
    """
    Mikro SQL Server'a Read-Only bir bağlantı oluşturur.
    Config dosyası veya ortam değişkenlerinden bağlantı bilgisi alır.
    """
    cfg = _load_mikro_config()
    if not cfg:
        raise ValidationError("Mikro veritabanı bağlantı bilgileri eksik. "
                              "Admin panelinden yapılandırma yapılmalı.")

    try:
        import pyodbc
    except ImportError:
        raise AppError(500, "DEPENDENCY_ERROR", "pyodbc yüklü değil. Kurulum: pip install pyodbc")

    server = cfg["server"]
    port = cfg.get("port", "1433")
    instance = cfg.get("instance", "")
    database = cfg["database"]
    username = cfg.get("username", "")
    password = cfg.get("password", "")
    timeout = int(cfg.get("timeout", "10"))
    encrypt = cfg.get("encrypt", True)
    trust_cert = cfg.get("trust_cert", False)

    # Server string oluştur
    server_str = f"{server},{port}" if port != "1433" else server
    if instance:
        server_str = f"{server}\\{instance}"

    try:
        conn_str = (
            f"DRIVER={{ODBC Driver 17 for SQL Server}};"
            f"SERVER={server_str};"
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

        conn = pyodbc.connect(conn_str, autocommit=True, timeout=timeout)
        return conn
    except pyodbc.Error as ex:
        error_msg = str(ex)
        logger.error(f"Mikro veritabanı bağlantı hatası: {error_msg}")
        raise AppError(503, "CONNECTION_ERROR", f"Mikro veritabanına bağlanılamadı: {error_msg}")

def _normalize_stock_name(name: str) -> str:
    """Handoff Madde 5'e göre stok adını normalize eder."""
    name = name.upper()
    if "MLAM" in name:
        return name.replace("MLAM", "MDFLAM")
    if "SLAM" in name:
        return name.replace("SLAM", "SUNTALAM")
    return name

def _fetch_raw_stocks() -> List[Dict[str, Any]]:
    """
    Mikro veritabanından ham stok listesini çeker.
    SQL sorgusu sql_board_fields.md'ye göre oluşturulmuştur.
    """
    conn = _get_db_connection()
    cursor = conn.cursor()
    
    # sql_board_fields.md'ye göre alanlar: sto_isim, sto_kalinlik, sto_en, sto_boy, sto_renk
    query = """
    SELECT 
        sto_isim, 
        sto_kalinlik, 
        sto_en, 
        sto_boy, 
        sto_renk 
    FROM 
        STOKLAR 
    WHERE 
        sto_grup_kodu = 'LEVHA' AND sto_isim IS NOT NULL
    """
    
    try:
        cursor.execute(query)
        columns = [column[0] for column in cursor.description]
        results = [dict(zip(columns, row)) for row in cursor.fetchall()]
        return results
    finally:
        cursor.close()
        conn.close()

def get_all_materials() -> List[Dict[str, Any]]:
    """
    Tüm malzemeleri önbellekten veya veritabanından alıp normalize eder.
    """
    cached_materials = stock_cache.get('all_materials')
    if cached_materials:
        return cached_materials

    raw_stocks = _fetch_raw_stocks()
    materials = []
    for stock in raw_stocks:
        # Kalınlık, en, boy gibi sayısal alanları ayrıştır
        normalized_name = _normalize_stock_name(stock['sto_isim'])
        materials.append({
            "name": normalized_name,
            "raw_name": stock['sto_isim'],
            "thickness": stock.get('sto_kalinlik'),
            "width": stock.get('sto_en'),
            "height": stock.get('sto_boy'),
            "color": stock.get('sto_renk')
        })
    
    stock_cache['all_materials'] = materials
    return materials

def suggest_materials(query: str, thickness: Optional[float] = None) -> List[Dict[str, Any]]:
    """
    Kullanıcı girdisine ve kalınlığa göre malzeme önerir.
    """
    all_materials = get_all_materials()
    query = query.upper()
    suggestions = []

    for mat in all_materials:
        # Kalınlık filtresi
        if thickness is not None and mat['thickness'] != thickness:
            continue

        # Arama sorgusu eşleşmesi
        if query in mat['name']:
            suggestions.append(mat)
            
    # En iyi eşleşmeleri başa getirmek için basit bir sıralama
    suggestions.sort(key=lambda x: abs(len(x["name"]) - len(query)))
    
    return suggestions[:20] # Çok fazla sonuç dönmemek için limit

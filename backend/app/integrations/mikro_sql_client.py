"""
Mikro SQL Server Client
OptiPlan360 → Mikro SQL entegrasyonu
"""
import os
import pyodbc
import json
from typing import Optional, Dict, List, Any
from datetime import datetime, date
import logging

logger = logging.getLogger(__name__)


class MikroSQLClient:
    """Mikro SQL Server veritabanı istemcisi"""

    def __init__(self, config: Dict[str, Any]):
        """
        Args:
            config: Mikro SQL bağlantı bilgileri
                {
                    "host": "192.168.1.100",
                    "port": 1433,
                    "database": "MIKRODB_2024",
                    "username": "optiplan_user",
                    "password": "password",
                    "driver": "ODBC Driver 18 for SQL Server",
                    "connection_timeout": 30,
                    "trust_server_certificate": true
                }
        """
        self.config = config
        self.connection = None
        env_ro = os.environ.get("MIKRO_READ_ONLY_MODE")
        cfg_ro = self.config.get("read_only_mode")
        if env_ro is not None:
            self.read_only_mode = self._to_bool(env_ro, default=True)
        elif cfg_ro is not None:
            self.read_only_mode = self._to_bool(cfg_ro, default=True)
        else:
            self.read_only_mode = True

    @staticmethod
    def _to_bool(value: Any, default: bool = True) -> bool:
        if isinstance(value, bool):
            return value
        if value is None:
            return default
        return str(value).strip().lower() in {"1", "true", "yes", "on"}

    def _ensure_write_allowed(self, operation: str) -> None:
        if self.read_only_mode:
            raise PermissionError(
                f"MIKRO_READ_ONLY_MODE aktif; write islemi engellendi: {operation}"
            )

    def connect(self) -> bool:
        """Mikro SQL'e bağlan"""
        try:
            driver = self.config.get("driver", "ODBC Driver 17 for SQL Server")
            host = self.config.get("host", "localhost")
            port = self.config.get("port", 1433)
            database = self.config.get("database")
            username = self.config.get("username")
            password = self.config.get("password")
            timeout = self.config.get("connection_timeout", 30)
            trust_cert = self.config.get("trust_server_certificate", True)
            
            connection_string = (
                f"DRIVER={{{driver}}};"
                f"SERVER={host},{port};"
                f"DATABASE={database};"
                f"UID={username};"
                f"PWD={password};"
                f"Connection Timeout={timeout};"
            )

            if self.read_only_mode:
                connection_string += "ApplicationIntent=ReadOnly;"
            else:
                connection_string += "ApplicationIntent=ReadWrite;"

            if trust_cert:
                connection_string += "TrustServerCertificate=yes;"

            self.connection = pyodbc.connect(connection_string)
            if self.read_only_mode:
                try:
                    self.connection.setattr(pyodbc.SQL_ATTR_ACCESS_MODE, pyodbc.SQL_MODE_READ_ONLY)
                except Exception:
                    # Bazı ODBC sürücülerinde bu attr desteklenmeyebilir.
                    pass
            logger.info(f"Mikro SQL bağlantısı başarılı: {host}:{port}/{database}")
            return True
            
        except Exception as e:
            logger.error(f"Mikro SQL bağlantı hatası: {e}")
            return False
    
    def disconnect(self):
        """Bağlantıyı kapat"""
        if self.connection:
            self.connection.close()
            self.connection = None
    
    def test_connection(self) -> Dict[str, Any]:
        """Bağlantı testi"""
        try:
            if not self.connection:
                success = self.connect()
                if not success:
                    return {"success": False, "error": "Bağlantı kurulamadı"}
            
            cursor = self.connection.cursor()
            cursor.execute("SELECT @@VERSION")
            version = cursor.fetchone()[0]
            cursor.close()
            
            return {
                "success": True,
                "database": self.config.get("database"),
                "version": version[:100]
            }
        except Exception as e:
            return {"success": False, "error": str(e)}
    
    # ═══════════════════════════════════════════════════════════
    # CARİ HESAPLAR (ACCOUNTS)
    # ═══════════════════════════════════════════════════════════
    
    def create_account(self, account_data: Dict[str, Any]) -> Optional[str]:
        """
        Cari hesap oluştur
        
        Args:
            account_data: Cari hesap verileri
                {
                    "CARI_KOD": "120.01.001",
                    "CARI_UNVAN": "ABC Mobilya A.Ş.",
                    "VERGI_NO": "1234567890",
                    "VERGI_DAIRESI": "İstanbul VD",
                    "TELEFON1": "05321234567",
                    "EMAIL": "info@abc.com",
                    "ADRES": "...",
                    "IL": "İstanbul",
                    "ILCE": "Kadıköy",
                    "KREDI_LIMIT": 50000.00,
                    "BAKIYE": 0.00
                }
        
        Returns:
            CARI_KOD başarılıysa, None hata durumunda
        """
        try:
            self._ensure_write_allowed("create_account")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            INSERT INTO CARI_HESAPLAR (
                CARI_KOD, CARI_UNVAN, VERGI_NO, VERGI_DAIRESI,
                TELEFON1, EMAIL, ADRES, IL, ILCE,
                KREDI_LIMIT, BAKIYE, KAYIT_TARIH
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """
            
            cursor.execute(query, (
                account_data.get("CARI_KOD"),
                account_data.get("CARI_UNVAN"),
                account_data.get("VERGI_NO"),
                account_data.get("VERGI_DAIRESI"),
                account_data.get("TELEFON1"),
                account_data.get("EMAIL"),
                account_data.get("ADRES"),
                account_data.get("IL"),
                account_data.get("ILCE"),
                account_data.get("KREDI_LIMIT", 0.0),
                account_data.get("BAKIYE", 0.0)
            ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Cari hesap oluşturuldu: {account_data.get('CARI_KOD')}")
            return account_data.get("CARI_KOD")
            
        except Exception as e:
            logger.error(f"Cari hesap oluşturma hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return None
    
    def update_account(self, cari_kod: str, account_data: Dict[str, Any]) -> bool:
        """Cari hesap güncelle"""
        try:
            self._ensure_write_allowed("update_account")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            UPDATE CARI_HESAPLAR SET
                CARI_UNVAN = ?, VERGI_NO = ?, VERGI_DAIRESI = ?,
                TELEFON1 = ?, EMAIL = ?, ADRES = ?, IL = ?, ILCE = ?,
                KREDI_LIMIT = ?, BAKIYE = ?, GUNCELLEME_TARIH = GETDATE()
            WHERE CARI_KOD = ?
            """
            
            cursor.execute(query, (
                account_data.get("CARI_UNVAN"),
                account_data.get("VERGI_NO"),
                account_data.get("VERGI_DAIRESI"),
                account_data.get("TELEFON1"),
                account_data.get("EMAIL"),
                account_data.get("ADRES"),
                account_data.get("IL"),
                account_data.get("ILCE"),
                account_data.get("KREDI_LIMIT"),
                account_data.get("BAKIYE"),
                cari_kod
            ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Cari hesap güncellendi: {cari_kod}")
            return True
            
        except Exception as e:
            logger.error(f"Cari hesap güncelleme hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def get_account(self, cari_kod: str) -> Optional[Dict[str, Any]]:
        """Cari hesap oku"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            query = "SELECT * FROM CARI_HESAPLAR WHERE CARI_KOD = ?"
            cursor.execute(query, (cari_kod,))
            
            columns = [column[0] for column in cursor.description]
            row = cursor.fetchone()
            cursor.close()
            
            if row:
                return dict(zip(columns, row))
            return None
            
        except Exception as e:
            logger.error(f"Cari hesap okuma hatası: {e}")
            return None
    
    # ═══════════════════════════════════════════════════════════
    # FATURALAR (INVOICES)
    # ═══════════════════════════════════════════════════════════
    
    def create_invoice(self, invoice_data: Dict[str, Any]) -> Optional[str]:
        """Fatura oluştur"""
        try:
            self._ensure_write_allowed("create_invoice")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            INSERT INTO FATURALAR (
                FATURA_NO, CARI_KOD, FATURA_TARIH, VADE_TARIH,
                TUTAR, KDV_ORAN, KDV_TUTAR, GENEL_TOPLAM,
                DURUM, ACIKLAMA, KAYIT_TARIH
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """
            
            cursor.execute(query, (
                invoice_data.get("FATURA_NO"),
                invoice_data.get("CARI_KOD"),
                invoice_data.get("FATURA_TARIH"),
                invoice_data.get("VADE_TARIH"),
                invoice_data.get("TUTAR"),
                invoice_data.get("KDV_ORAN"),
                invoice_data.get("KDV_TUTAR"),
                invoice_data.get("GENEL_TOPLAM"),
                invoice_data.get("DURUM", "PENDING"),
                invoice_data.get("ACIKLAMA")
            ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Fatura oluşturuldu: {invoice_data.get('FATURA_NO')}")
            return invoice_data.get("FATURA_NO")
            
        except Exception as e:
            logger.error(f"Fatura oluşturma hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return None
    
    def create_invoice_line(self, line_data: Dict[str, Any]) -> bool:
        """Fatura satırı oluştur"""
        try:
            self._ensure_write_allowed("create_invoice_line")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            INSERT INTO FATURA_HAREKETLERI (
                FATURA_NO, SIRA_NO, STOK_KOD, ACIKLAMA,
                MIKTAR, BIRIM, BIRIM_FIYAT, TUTAR
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            cursor.execute(query, (
                line_data.get("FATURA_NO"),
                line_data.get("SIRA_NO"),
                line_data.get("STOK_KOD"),
                line_data.get("ACIKLAMA"),
                line_data.get("MIKTAR"),
                line_data.get("BIRIM", "Adet"),
                line_data.get("BIRIM_FIYAT"),
                line_data.get("TUTAR")
            ))
            
            self.connection.commit()
            cursor.close()
            return True
            
        except Exception as e:
            logger.error(f"Fatura satırı oluşturma hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def get_invoice(self, fatura_no: str) -> Optional[Dict[str, Any]]:
        """Fatura oku"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            query = "SELECT * FROM FATURALAR WHERE FATURA_NO = ?"
            cursor.execute(query, (fatura_no,))
            
            columns = [column[0] for column in cursor.description]
            row = cursor.fetchone()
            cursor.close()
            
            if row:
                return dict(zip(columns, row))
            return None
            
        except Exception as e:
            logger.error(f"Fatura okuma hatası: {e}")
            return None
    
    # ═══════════════════════════════════════════════════════════
    # TEKLİFLER (QUOTES)
    # ═══════════════════════════════════════════════════════════
    
    def create_quote(self, quote_data: Dict[str, Any]) -> Optional[str]:
        """Teklif oluştur"""
        try:
            self._ensure_write_allowed("create_quote")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            INSERT INTO TEKLIFLER (
                TEKLIF_NO, REVIZYON, BASLIK, CARI_KOD,
                TEKLIF_TARIH, GECERLILIK_TARIH, DURUM,
                TUTAR, KDV_ORAN, KDV_TUTAR,
                ISKONTO_ORAN, ISKONTO_TUTAR, GENEL_TOPLAM,
                ACIKLAMA, KAYIT_TARIH
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """
            
            cursor.execute(query, (
                quote_data.get("TEKLIF_NO"),
                quote_data.get("REVIZYON", 1),
                quote_data.get("BASLIK"),
                quote_data.get("CARI_KOD"),
                quote_data.get("TEKLIF_TARIH"),
                quote_data.get("GECERLILIK_TARIH"),
                quote_data.get("DURUM", "DRAFT"),
                quote_data.get("TUTAR"),
                quote_data.get("KDV_ORAN"),
                quote_data.get("KDV_TUTAR"),
                quote_data.get("ISKONTO_ORAN", 0),
                quote_data.get("ISKONTO_TUTAR", 0),
                quote_data.get("GENEL_TOPLAM"),
                quote_data.get("ACIKLAMA")
            ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Teklif oluşturuldu: {quote_data.get('TEKLIF_NO')}")
            return quote_data.get("TEKLIF_NO")
            
        except Exception as e:
            logger.error(f"Teklif oluşturma hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return None
    
    def create_quote_line(self, line_data: Dict[str, Any]) -> bool:
        """Teklif satırı oluştur"""
        try:
            self._ensure_write_allowed("create_quote_line")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            INSERT INTO TEKLIF_DETAY (
                TEKLIF_NO, SIRA_NO, STOK_KOD, ACIKLAMA,
                MIKTAR, BIRIM, BIRIM_FIYAT, ISKONTO_ORAN, TUTAR,
                MALZEME, RENK, KALINLIK, OLCU, DAMAR_YON,
                BANT_DAHIL, DELME_DAHIL
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            cursor.execute(query, (
                line_data.get("TEKLIF_NO"),
                line_data.get("SIRA_NO"),
                line_data.get("STOK_KOD"),
                line_data.get("ACIKLAMA"),
                line_data.get("MIKTAR"),
                line_data.get("BIRIM", "Adet"),
                line_data.get("BIRIM_FIYAT"),
                line_data.get("ISKONTO_ORAN", 0),
                line_data.get("TUTAR"),
                line_data.get("MALZEME"),
                line_data.get("RENK"),
                line_data.get("KALINLIK"),
                line_data.get("OLCU"),
                line_data.get("DAMAR_YON", 0),
                line_data.get("BANT_DAHIL", False),
                line_data.get("DELME_DAHIL", False)
            ))
            
            self.connection.commit()
            cursor.close()
            return True
            
        except Exception as e:
            logger.error(f"Teklif satırı oluşturma hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def delete_quote_lines(self, teklif_no: str) -> bool:
        """Teklif satırlarını sil (güncelleme öncesi)"""
        try:
            self._ensure_write_allowed("delete_quote_lines")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            query = "DELETE FROM TEKLIF_DETAY WHERE TEKLIF_NO = ?"
            cursor.execute(query, (teklif_no,))
            self.connection.commit()
            cursor.close()
            return True
            
        except Exception as e:
            logger.error(f"Teklif satırları silme hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def get_quote(self, teklif_no: str) -> Optional[Dict[str, Any]]:
        """Teklif oku"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            query = "SELECT * FROM TEKLIFLER WHERE TEKLIF_NO = ?"
            cursor.execute(query, (teklif_no,))
            
            columns = [column[0] for column in cursor.description]
            row = cursor.fetchone()
            cursor.close()
            
            if row:
                return dict(zip(columns, row))
            return None
            
        except Exception as e:
            logger.error(f"Teklif okuma hatası: {e}")
            return None
    
    # ═══════════════════════════════════════════════════════════
    # SİPARİŞLER (ORDERS)
    # ═══════════════════════════════════════════════════════════
    
    def create_order(self, order_data: Dict[str, Any]) -> Optional[str]:
        """Sipariş oluştur"""
        try:
            self._ensure_write_allowed("create_order")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            INSERT INTO SIPARISLER (
                SIPARIS_NO, CARI_KOD, SIPARIS_TARIH, TESLIM_TARIH,
                DURUM, TUTAR, KDV_TUTAR, ISKONTO_TUTAR, GENEL_TOPLAM,
                ACIKLAMA, TESLIMAT_ADRES, ODEME_SEKLI, KAYIT_TARIH
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, GETDATE())
            """
            
            cursor.execute(query, (
                order_data.get("SIPARIS_NO"),
                order_data.get("CARI_KOD"),
                order_data.get("SIPARIS_TARIH"),
                order_data.get("TESLIM_TARIH"),
                order_data.get("DURUM", "PENDING"),
                order_data.get("TUTAR"),
                order_data.get("KDV_TUTAR"),
                order_data.get("ISKONTO_TUTAR", 0),
                order_data.get("GENEL_TOPLAM"),
                order_data.get("ACIKLAMA"),
                order_data.get("TESLIMAT_ADRES"),
                order_data.get("ODEME_SEKLI", "NAKIT")
            ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Sipariş oluşturuldu: {order_data.get('SIPARIS_NO')}")
            return order_data.get("SIPARIS_NO")
            
        except Exception as e:
            logger.error(f"Sipariş oluşturma hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return None
    
    def update_order(self, siparis_no: str, order_data: Dict[str, Any]) -> bool:
        """Sipariş güncelle"""
        try:
            self._ensure_write_allowed("update_order")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            UPDATE SIPARISLER SET
                DURUM = ?, TESLIM_TARIH = ?,
                ACIKLAMA = ?, GUNCELLEME_TARIH = GETDATE()
            WHERE SIPARIS_NO = ?
            """
            
            cursor.execute(query, (
                order_data.get("DURUM"),
                order_data.get("TESLIM_TARIH"),
                order_data.get("ACIKLAMA"),
                siparis_no
            ))
            
            self.connection.commit()
            cursor.close()
            
            logger.info(f"Sipariş güncellendi: {siparis_no}")
            return True
            
        except Exception as e:
            logger.error(f"Sipariş güncelleme hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def create_order_line(self, line_data: Dict[str, Any]) -> bool:
        """Sipariş satırı oluştur"""
        try:
            self._ensure_write_allowed("create_order_line")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            INSERT INTO SIPARIS_DETAY (
                SIPARIS_NO, SIRA_NO, STOK_KOD, ACIKLAMA,
                MIKTAR, BIRIM, BIRIM_FIYAT, ISKONTO_ORAN, TUTAR,
                MALZEME, RENK, OLCU
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            cursor.execute(query, (
                line_data.get("SIPARIS_NO"),
                line_data.get("SIRA_NO"),
                line_data.get("STOK_KOD"),
                line_data.get("ACIKLAMA"),
                line_data.get("MIKTAR"),
                line_data.get("BIRIM", "Adet"),
                line_data.get("BIRIM_FIYAT"),
                line_data.get("ISKONTO_ORAN", 0),
                line_data.get("TUTAR"),
                line_data.get("MALZEME"),
                line_data.get("RENK"),
                line_data.get("OLCU")
            ))
            
            self.connection.commit()
            cursor.close()
            return True
            
        except Exception as e:
            logger.error(f"Sipariş satırı oluşturma hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def delete_order_lines(self, siparis_no: str) -> bool:
        """Sipariş satırlarını sil"""
        try:
            self._ensure_write_allowed("delete_order_lines")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            query = "DELETE FROM SIPARIS_DETAY WHERE SIPARIS_NO = ?"
            cursor.execute(query, (siparis_no,))
            self.connection.commit()
            cursor.close()
            return True
            
        except Exception as e:
            logger.error(f"Sipariş satırları silme hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def get_order(self, siparis_no: str) -> Optional[Dict[str, Any]]:
        """Sipariş oku"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            query = "SELECT * FROM SIPARISLER WHERE SIPARIS_NO = ?"
            cursor.execute(query, (siparis_no,))
            
            columns = [column[0] for column in cursor.description]
            row = cursor.fetchone()
            cursor.close()
            
            if row:
                return dict(zip(columns, row))
            return None
            
        except Exception as e:
            logger.error(f"Sipariş okuma hatası: {e}")
            return None
    
    # ═══════════════════════════════════════════════════════════
    # STOKLAR (STOCKS)
    # ═══════════════════════════════════════════════════════════
    
    def get_stock(self, stok_kod: str) -> Optional[Dict[str, Any]]:
        """Stok oku"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            query = "SELECT * FROM STOKLAR WHERE STOK_KOD = ?"
            cursor.execute(query, (stok_kod,))
            
            columns = [column[0] for column in cursor.description]
            row = cursor.fetchone()
            cursor.close()
            
            if row:
                return dict(zip(columns, row))
            return None
            
        except Exception as e:
            logger.error(f"Stok okuma hatası: {e}")
            return None
    
    def create_stock_movement(self, movement_data: Dict[str, Any]) -> bool:
        """Stok hareketi oluştur"""
        try:
            self._ensure_write_allowed("create_stock_movement")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            INSERT INTO STOK_HAREKETLERI (
                HAREKET_TIP, STOK_KOD, MIKTAR, BIRIM_MALIYET,
                DEPO_KAYNAK, DEPO_HEDEF, HAREKET_TARIH,
                REFERANS_TIP, REFERANS_NO, ACIKLAMA
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """
            
            cursor.execute(query, (
                movement_data.get("HAREKET_TIP"),
                movement_data.get("STOK_KOD"),
                movement_data.get("MIKTAR"),
                movement_data.get("BIRIM_MALIYET"),
                movement_data.get("DEPO_KAYNAK"),
                movement_data.get("DEPO_HEDEF"),
                movement_data.get("HAREKET_TARIH"),
                movement_data.get("REFERANS_TIP"),
                movement_data.get("REFERANS_NO"),
                movement_data.get("ACIKLAMA")
            ))
            
            self.connection.commit()
            cursor.close()
            return True
            
        except Exception as e:
            logger.error(f"Stok hareketi oluşturma hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    def update_stock_quantity(self, stok_kod: str, delta: float) -> bool:
        """Stok miktarını güncelle"""
        try:
            self._ensure_write_allowed("update_stock_quantity")
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            query = "UPDATE STOKLAR SET MIKTAR = MIKTAR + ? WHERE STOK_KOD = ?"
            cursor.execute(query, (delta, stok_kod))
            self.connection.commit()
            cursor.close()
            return True
            
        except Exception as e:
            logger.error(f"Stok miktarı güncelleme hatası: {e}")
            if self.connection:
                self.connection.rollback()
            return False
    
    # ═══════════════════════════════════════════════════════════
    # STOK KARTI (STOCK CARD)
    # ═══════════════════════════════════════════════════════════
    
    def get_all_stocks(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        """Tüm stokları listele (sayfalandırılmış)"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            SELECT TOP (?) 
                STOK_KOD, STOK_ISIM, STOK_GRUP_KODU,
                STOK_KALINLIK, STOK_EN, STOK_BOY, STOK_RENK,
                SATINALMA_FIYATI, SATIŞ_FIYATI,
                MIKTAR, DEPO_YERI, KAYIT_TARIHI, GUNCELLEME_TARIHI
            FROM STOKLAR 
            ORDER BY STOK_ISIM
            OFFSET ? ROWS
            """
            
            cursor.execute(query, (limit, offset))
            columns = [column[0] for column in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            cursor.close()
            
            return results
            
        except Exception as e:
            logger.error(f"Stok listesi okuma hatası: {e}")
            return []
    
    def search_stocks(self, search_text: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Stok arama"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            SELECT TOP (?)
                STOK_KOD, STOK_ISIM, STOK_GRUP_KODU,
                STOK_KALINLIK, STOK_EN, STOK_BOY, STOK_RENK,
                SATINALMA_FIYATI, SATIŞ_FIYATI, MIKTAR
            FROM STOKLAR 
            WHERE STOK_KOD LIKE ? OR STOK_ISIM LIKE ?
            ORDER BY STOK_ISIM
            """
            
            search_pattern = f"%{search_text}%"
            cursor.execute(query, (limit, search_pattern, search_pattern))
            columns = [column[0] for column in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            cursor.close()
            
            return results
            
        except Exception as e:
            logger.error(f"Stok arama hatası: {e}")
            return []
    
    def get_stock_card(self, stok_kod: str) -> Optional[Dict[str, Any]]:
        """Stok kartı (detaylı bilgi) oku"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            SELECT 
                STOK_KOD, STOK_ISIM, STOK_GRUP_KODU,
                STOK_KALINLIK, STOK_EN, STOK_BOY, STOK_RENK,
                SATINALMA_FIYATI, SATIŞ_FIYATI,
                MIKTAR as TOPLAM_MIKTAR,
                DEPO_YERI, KAYIT_TARIHI, GUNCELLEME_TARIHI,
                BIRIM, ACIKLAMA
            FROM STOKLAR 
            WHERE STOK_KOD = ?
            """
            
            cursor.execute(query, (stok_kod,))
            columns = [column[0] for column in cursor.description]
            row = cursor.fetchone()
            cursor.close()
            
            if row:
                return dict(zip(columns, row))
            return None
            
        except Exception as e:
            logger.error(f"Stok kartı okuma hatası: {e}")
            return None
    
    def get_stock_movements(self, stok_kod: str, days: int = 90, limit: int = 100) -> List[Dict[str, Any]]:
        """Stok hareketleri geçmişi"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            query = """
            SELECT TOP (?)
                HAREKET_ID, HAREKET_TIP, STOK_KOD,
                MIKTAR, BIRIM_MALIYET, TOPLAM_MALIYET,
                DEPO_KAYNAK, DEPO_HEDEF,
                REFERANS_TIP, REFERANS_NO,
                HAREKET_TARIHI, ACIKLAMA
            FROM STOK_HAREKETLERI
            WHERE STOK_KOD = ? 
                AND HAREKET_TARIHI >= DATEADD(DAY, -?, CAST(GETDATE() AS DATE))
            ORDER BY HAREKET_TARIHI DESC
            """
            
            cursor.execute(query, (limit, stok_kod, days))
            columns = [column[0] for column in cursor.description]
            results = [dict(zip(columns, row)) for row in cursor.fetchall()]
            cursor.close()
            
            return results
            
        except Exception as e:
            logger.error(f"Stok hareketleri okuma hatası: {e}")
            return []
    
    def get_stock_summary(self, stok_kod: str) -> Optional[Dict[str, Any]]:
        """Stok özeti (mevcut + yakın tarih hareketleri)"""
        try:
            if not self.connection:
                self.connect()
            
            cursor = self.connection.cursor()
            
            # Temel stok bilgisi
            query = "SELECT * FROM STOKLAR WHERE STOK_KOD = ?"
            cursor.execute(query, (stok_kod,))
            columns = [column[0] for column in cursor.description]
            row = cursor.fetchone()
            
            if not row:
                return None
            
            stock_data = dict(zip(columns, row))
            
            # Son 7 gün hareketleri
            query = """
            SELECT 
                HAREKET_TIP, COUNT(*) as SAYI,
                SUM(MIKTAR) as TOPLAM_MIKTAR
            FROM STOK_HAREKETLERI
            WHERE STOK_KOD = ? AND HAREKET_TARIHI >= DATEADD(DAY, -7, GETDATE())
            GROUP BY HAREKET_TIP
            """
            
            cursor.execute(query, (stok_kod,))
            movements = cursor.fetchall()
            
            # Depo dağılımı
            query = """
            SELECT DEPO_YERI, SUM(MIKTAR) as MIKTAR
            FROM STOKLAR
            WHERE STOK_KOD = ?
            GROUP BY DEPO_YERI
            """
            
            cursor.execute(query, (stok_kod,))
            warehouses = cursor.fetchall()
            
            cursor.close()
            
            stock_data["movements_7days"] = [
                {"type": m[0], "count": m[1], "total": m[2]} 
                for m in movements
            ]
            stock_data["warehouse_distribution"] = [
                {"warehouse": w[0], "quantity": w[1]} 
                for w in warehouses
            ]
            
            return stock_data
            
        except Exception as e:
            logger.error(f"Stok özeti okuma hatası: {e}")
            return None


# Factory function
def get_mikro_client(config_path: str = None) -> MikroSQLClient:
    """Mikro SQL client oluştur"""
    if config_path is None:
        config_path = "config/mikro_config.json"
    
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        sql_server_cfg = config.get("sql_server", {})
        if "read_only_mode" not in sql_server_cfg:
            sql_server_cfg["read_only_mode"] = True
        return MikroSQLClient(sql_server_cfg)
    except Exception as e:
        logger.error(f"Mikro config yükleme hatası: {e}")
        raise
